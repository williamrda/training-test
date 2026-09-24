#!/usr/bin/env python3
"""Builds the timed voiceover track -> public/vo.wav (30.000 s, 48 kHz, stereo).

Line text and cue times live in src/vo-cues.json (the picture ducks the music with
the same cues). Each line is trimmed, fitted into its slot (gently sped up if it runs
long), levelled to ~ -16 dBFS RMS and placed at its cue.

Sources (pick one):
  python3 scripts/make_vo.py                       # Microsoft Edge neural TTS (pip install edge-tts; needs internet)
  python3 scripts/make_vo.py --voice en-US-GuyNeural
  python3 scripts/make_vo.py --engine say          # macOS built-in `say` (offline)
  python3 scripts/make_vo.py --from-dir takes/     # your own recordings: takes/01.wav ... takes/09.wav (any format ffmpeg reads)

Requires: numpy, scipy, and ffmpeg (on PATH, or `pip install imageio-ffmpeg`).
"""
import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SR = 48000
DUR = 30.0
MAX_TEMPO = 1.25


def ffmpeg_bin():
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit('ffmpeg not found: install it or `pip install imageio-ffmpeg`.')


FF = ffmpeg_bin()


def decode(path, tempo=1.0):
    af = ['highpass=f=80']
    t = tempo
    while t > 2.0:  # atempo accepts 0.5..2 per stage
        af.append('atempo=2.0')
        t /= 2.0
    if abs(t - 1.0) > 1e-3:
        af.append(f'atempo={t:.4f}')
    raw = subprocess.run(
        [FF, '-v', 'error', '-i', path, '-af', ','.join(af), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype='<f4').astype(np.float64)


def trim(x, thresh_db=-45):
    if len(x) == 0:
        return x
    win = int(0.01 * SR)
    pad = np.pad(x, (0, (-len(x)) % win))
    rms = np.sqrt(np.mean(pad.reshape(-1, win) ** 2, axis=1))
    on = np.where(20 * np.log10(rms + 1e-12) > thresh_db)[0]
    if len(on) == 0:
        return x[:0]
    a = max(0, on[0] * win - int(0.015 * SR))
    b = min(len(x), (on[-1] + 1) * win + int(0.06 * SR))
    return x[a:b]


def synth_edge(text, voice, out_path):
    try:
        import edge_tts
    except ImportError:
        sys.exit('edge-tts not installed: `pip install edge-tts` (or use --engine say / --from-dir).')

    async def run():
        await edge_tts.Communicate(text, voice, rate='+6%').save(out_path)

    asyncio.run(run())


def synth_say(text, voice, out_path):
    args = ['say', '-o', out_path]
    if voice:
        args += ['-v', voice]
    subprocess.run(args + [text], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--engine', choices=['edge', 'say'], default='edge')
    ap.add_argument('--voice', default=None, help='TTS voice (default from vo-cues.json for edge)')
    ap.add_argument('--from-dir', default=None, help='folder with 01.* .. 09.* recordings')
    a = ap.parse_args()

    cues = json.load(open(os.path.join(ROOT, 'src', 'vo-cues.json')))
    lines = cues['lines']
    cache = os.path.join(ROOT, '.vo-cache')
    os.makedirs(cache, exist_ok=True)

    out = np.zeros(int(DUR * SR))
    for i, ln in enumerate(lines):
        if a.from_dir:
            matches = [f for f in os.listdir(a.from_dir) if os.path.splitext(f)[0] == ln['id']]
            if not matches:
                sys.exit(f"missing recording for line {ln['id']} in {a.from_dir}")
            src = os.path.join(a.from_dir, matches[0])
        elif a.engine == 'edge':
            src = os.path.join(cache, f"{ln['id']}.mp3")
            synth_edge(ln['text'], a.voice or cues['voice'], src)
        else:
            src = os.path.join(cache, f"{ln['id']}.aiff")
            synth_say(ln['text'], a.voice, src)

        # slot = cue window, allowed to spill up to 60 ms before the next line
        nxt = lines[i + 1]['start'] if i + 1 < len(lines) else DUR - 0.1
        slot = nxt - 0.06 - ln['start']
        x = trim(decode(src))
        length = len(x) / SR
        tempo = 1.0
        if length > slot:
            tempo = min(MAX_TEMPO, length / slot)
            x = trim(decode(src, tempo))
            length = len(x) / SR
        if length > slot + 0.05:
            print(f"  ! line {ln['id']} is {length:.2f}s for a {slot:.2f}s slot even at {tempo:.2f}x; it will overlap.")
        # level each line
        rms = np.sqrt(np.mean(x ** 2)) + 1e-12
        x *= 10 ** (-16 / 20) / rms
        pk = np.max(np.abs(x))
        if pk > 10 ** (-1.5 / 20):
            x *= 10 ** (-1.5 / 20) / pk
        fade = int(0.008 * SR)
        x[:fade] *= np.linspace(0, 1, fade)
        x[-fade:] *= np.linspace(1, 0, fade)
        s = int(round(ln['start'] * SR))
        e = min(len(out), s + len(x))
        out[s:e] += x[: e - s]
        print(f"  {ln['id']}  {ln['start']:5.2f}s  {length:4.2f}s / slot {slot:4.2f}s  tempo {tempo:.2f}  \"{ln['text']}\"")

    # gentle presence lift + safety limit
    sos = butter(2, [2500, 6000], btype='bandpass', fs=SR, output='sos')
    out = out + 0.15 * sosfilt(sos, out)
    out = np.tanh(out * 1.05) / 1.05
    path = os.path.join(ROOT, 'public', 'vo.wav')
    pcm = (np.clip(np.stack([out, out], 1), -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f'vo.wav written ({DUR:.3f} s). Re-run `npm run render` to include it.')


if __name__ == '__main__':
    main()

"""Synthesizes the 30 s soundtrack from scratch (no samples).

128 BPM, A minor, i-VI-III-VII (Am F C G). Every sound is generated with
numpy: sine-sweep kicks, noise claps/hats, detuned-saw bass/arp/pads,
filtered-noise risers and sub-drop impacts, mixed with sidechain ducking,
a convolution reverb send and a tanh limiter.

    python3 audio.py out/soundtrack.wav
"""
import sys
import wave

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

from content import BAR, BEAT, DURATION, INTRO, TITLE, TOPICS, CHANT, OUTRO, BOOT_LINES

SR = 44100
N = int(DURATION * SR) + SR  # 1 s of tail room, trimmed at the end
rng = np.random.default_rng(7)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def t_of(bar, beat=0.0):
    return bar * BAR + beat * BEAT


def place(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf):
        return
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n] * gain


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def adsr(n, a=0.005, r=0.05):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr and nr < n:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def filt(x, kind, f, order=2):
    if isinstance(f, (list, tuple)):
        f = [min(max(v, 20), SR / 2 - 100) for v in f]
    else:
        f = min(max(f, 20), SR / 2 - 100)
    return sosfilt(butter(order, f, kind, fs=SR, output="sos"), x)


def saw(freq, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((t * freq + phase) % 1.0) - 1


def supersaw(freq, n, voices=5, detune=0.012):
    out = np.zeros(n)
    for k in range(voices):
        d = 1 + detune * (k - (voices - 1) / 2) / ((voices - 1) / 2)
        out += saw(freq * d, n, rng.random())
    return out / voices


def sweep_lp(x, f0, f1, steps=48):
    """Time-varying lowpass by crossfading blocks (cheap filter sweep)."""
    out = np.zeros_like(x)
    edges = np.linspace(0, len(x), steps + 1).astype(int)
    for k in range(steps):
        a, b = edges[k], edges[k + 1]
        f = f0 * (f1 / f0) ** (k / max(steps - 1, 1))
        seg = x[max(0, a - 2048):b]
        out[a:b] = filt(seg, "lowpass", f)[-(b - a):]
    return out


# ---- instruments -------------------------------------------------------------
def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 130 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env_exp(n, 0.16)
    click = filt(rng.standard_normal(n), "highpass", 3000) * env_exp(n, 0.004) * 0.5
    return np.tanh((body + click) * 2.2)


def clap():
    n = int(0.35 * SR)
    noise = filt(rng.standard_normal(n), "bandpass", [900, 5200])
    e = np.zeros(n)
    for off in (0, 0.011, 0.022):  # three smeared hits = clap
        i = int(off * SR)
        e[i:] += env_exp(n - i, 0.012 if off < 0.02 else 0.11)
    tone = np.sin(2 * np.pi * 190 * np.arange(n) / SR) * env_exp(n, 0.04) * 0.5
    return np.tanh((noise * e + tone) * 1.6)


def hat(open_=False):
    n = int((0.25 if open_ else 0.05) * SR)
    x = filt(rng.standard_normal(n), "highpass", 7500)
    return x * env_exp(n, 0.07 if open_ else 0.012)


def impact():
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    f = 30 + 90 * np.exp(-t / 0.12)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.7)
    crash = filt(rng.standard_normal(n), "highpass", 2500) * env_exp(n, 0.5) * 0.45
    boom = filt(rng.standard_normal(n), "lowpass", 400) * env_exp(n, 0.25) * 0.8
    return np.tanh((sub * 1.4 + crash + boom) * 1.5)


def riser(dur):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    x = sweep_lp(x, 300, 12000)
    x = filt(x, "highpass", 200)
    t = np.arange(n) / SR
    f = 200 * (8 ** (t / dur))
    tone =np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    e = (t / dur) ** 2.2
    return (x * 0.6 + tone) * e


def whoosh():
    n = int(0.5 * SR)
    x = rng.standard_normal(n)
    x = sweep_lp(x, 8000, 400, steps=24)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return x * e * 0.5


def blip(freq, dur=0.06):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sq = np.sign(np.sin(2 * np.pi * freq * t))
    return sq * env_exp(n, dur / 3) * 0.35


def formant_stab(freq, vowel, dur):
    """Robotic 'vocal' stab: supersaw pushed through vowel formant bandpasses."""
    formants = {"a": (800, 1150, 2900), "i": (270, 2290, 3010),
                "o": (450, 800, 2830), "e": (400, 1700, 2600)}[vowel]
    n = int(dur * SR)
    src = supersaw(freq, n, 7, 0.02) + supersaw(freq * 2, n, 3, 0.01) * 0.5
    out = np.zeros(n)
    for k, fc in enumerate(formants):
        out += filt(src, "bandpass", [fc * 0.85, fc * 1.15]) * (1.0, 0.6, 0.35)[k]
    return np.tanh(out * 3) * adsr(n, 0.004, 0.08) * env_exp(n, dur * 0.9)


# ---- arrangement -------------------------------------------------------------
PROG = [  # (bass midi, chord midis)
    (33, (57, 60, 64)),   # Am
    (29, (53, 57, 60)),   # F
    (36, (55, 60, 64)),   # C
    (31, (55, 59, 62)),   # G
]


def chord_for(bar):
    return PROG[bar % 4]


def build():
    drums = np.zeros(N)
    bass = np.zeros(N)
    synth = np.zeros(N)
    fx = np.zeros(N)
    duck = np.ones(N)

    K, C = kick(), clap()
    HC, HO = hat(), hat(True)
    duck_shape = 1 - 0.8 * env_exp(int(0.3 * SR), 0.07)

    def add_kick(t):
        place(drums, K, t, 1.0)
        i = int(t * SR)
        n = min(len(duck_shape), N - i)
        duck[i:i + n] = np.minimum(duck[i:i + n], duck_shape[:n])

    full_drum_bars = list(range(TITLE[0], OUTRO[0] + 1))

    # --- intro: boot blips + hats fading in + riser ---
    for k, _ in enumerate(BOOT_LINES):
        place(fx, blip(880 * (1.26 ** k)), t_of(0, k * 0.75), 0.6)
    for s in range(8):  # progress-bar roll
        place(fx, blip(1320 + 110 * s, 0.035), t_of(1, 2 + s * 0.25), 0.45)
    for s in range(16, 32):
        place(drums, HC, t_of(0, s * 0.25), 0.15 * (s - 16) / 16)
    place(fx, riser(BAR * 2), t_of(0), 0.9)
    place(drums, K, t_of(0), 0.8)

    # --- main groove ---
    for bar in full_drum_bars:
        chant = CHANT[0] <= bar < CHANT[1]
        for b in range(4):
            add_kick(t_of(bar, b))
            if b in (1, 3):
                place(drums, C, t_of(bar, b), 0.75)
            place(drums, HO, t_of(bar, b + 0.5), 0.28)
            for s in (0.25, 0.75):
                place(drums, HC, t_of(bar, b + s), 0.22 if not chant else 0.3)
        if chant:  # extra off-beat kicks drive the chant
            add_kick(t_of(bar, 3.5))

    # snare roll into the chant
    for s in range(16):
        place(drums, C, t_of(TOPICS[1] - 1, s * 0.25), 0.25 + 0.5 * s / 16)

    # --- bass: 8th-note pumping saw, sidechained ---
    for bar in range(TITLE[0], OUTRO[1] - 1):
        root, _ = chord_for(bar)
        for e in range(8):
            f = mtof(root + (12 if e % 2 else 0))
            n = int(BEAT / 2 * SR)
            note = supersaw(f, n, 3, 0.006) * 0.7 + np.sin(2 * np.pi * mtof(root) * np.arange(n) / SR) * 0.8
            note = filt(note, "lowpass", 900) * adsr(n, 0.003, 0.03)
            place(bass, np.tanh(note * 1.8), t_of(bar, e * 0.5), 0.55)

    # --- arp: 16th supersaw arpeggio with an opening filter ---
    arp = np.zeros(N)
    for bar in range(0, OUTRO[1]):
        _, ch = chord_for(bar)
        seq = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1] + 12, ch[0] + 12, ch[2] + 12]
        for s in range(16):
            m = seq[s % 8] + 12
            n = int(BEAT / 4 * SR * 0.9)
            note = supersaw(mtof(m), n, 5, 0.015) * adsr(n, 0.002, 0.02) * env_exp(n, 0.09)
            place(arp, note, t_of(bar, s * 0.25), 0.3)
    arp = sweep_lp(arp[:int(DURATION * SR)], 500, 9000, steps=64)
    synth[:len(arp)] += arp

    # --- pads: long detuned chords ---
    for bar in range(0, OUTRO[1]):
        _, ch = chord_for(bar)
        n = int(BAR * SR) + int(0.3 * SR)
        pad = sum(supersaw(mtof(m), n, 7, 0.02) for m in ch) / 3
        pad = filt(pad, "lowpass", 2400 if bar >= TITLE[0] else 900) * adsr(n, 0.08, 0.3)
        place(synth, pad, t_of(bar), 0.28)

    # --- chant stabs: one robotic vowel per word, 2 beats each ---
    for k, vowel in enumerate("iioe"):
        bar = CHANT[0] + k // 2
        root, _ = chord_for(bar)
        for rep, beat in enumerate((0, 0.75, 1.5)):  # stutter
            g = 0.9 if rep == 0 else 0.45
            place(synth, formant_stab(mtof(root + 24), vowel, BEAT * 0.7), t_of(bar, (k % 2) * 2 + beat), g)

    # --- transitions ---
    for bar in (TITLE[0], CHANT[0], OUTRO[0]):
        place(fx, impact(), t_of(bar), 1.0)
    for bar in range(TOPICS[0], TOPICS[1]):
        place(fx, whoosh(), t_of(bar) - 0.25, 0.8)
        place(fx, blip(1760, 0.05), t_of(bar), 0.4)
    place(fx, riser(BAR), t_of(TOPICS[1] - 1), 0.8)
    place(fx, riser(BAR), t_of(CHANT[1] - 1), 0.7)
    # final hit at the logo lockup's last beat
    place(fx, impact(), t_of(OUTRO[1] - 1), 0.8)
    place(drums, K, t_of(OUTRO[1] - 1), 1.0)

    # ---- mix ----
    bass *= duck
    synth *= 0.35 + 0.65 * duck
    wet = fftconvolve(synth + 0.3 * fx, reverb_ir(), mode="full")[:N] * 0.22

    L = drums + bass + synth + fx + wet
    # stereo: widen synths with a short Haas delay on the right channel
    d = int(0.012 * SR)
    side = np.concatenate([np.zeros(d), (synth + wet)[:-d]])
    R = drums + bass + fx + side + wet * 0.9
    mix = np.stack([L, R], axis=1)
    mix = filt(mix.T, "highpass", 28).T
    mix = np.tanh(mix * 1.6)  # loud: drive into soft clipper
    mix = mix[: int(DURATION * SR)]
    fade = int(0.25 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    mix /= np.abs(mix).max() / 0.93
    return mix


def reverb_ir(seconds=1.6):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * env_exp(n, seconds / 5)
    ir = filt(ir, "lowpass", 6000)
    return ir / np.sqrt((ir ** 2).sum())


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "out/soundtrack.wav"
    write_wav(out, build())
    print("wrote", out)

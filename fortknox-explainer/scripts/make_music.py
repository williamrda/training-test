#!/usr/bin/env python3
"""Synthesises the 132 BPM music bed -> public/music.wav (30.000 s, 48 kHz, stereo).

Everything is locked to the same beat grid as the picture (src/timing.ts):
66 beats = 30 s, six 11-beat (5 s) sections; camera shots start on beats 0,6,11,22,33,39,44,50,55.

  beats  0-11  threat: half-time kick, sub drone, ticking hats, riser into the reveal
  beats 11-22  FortKnox reveal: impact, full four-on-the-floor groove (A minor)
  beats 22-33  air gap: breakdown (no kick/bass), thud when the window shuts, riser
  beats 33-44  locked down: impact, groove, hits under IMMUTABLE / ENCRYPTED / WORM, key clicks
  beats 44-55  scan + recover: brighter arp lift, riser
  beats 55-66  end card: final impact, resolve chord, soft heartbeat, fade out

The bed is mastered deliberately quiet (~ -24 dBFS RMS) so the VO sits well on top.
Requires: numpy, scipy.
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
BPM = 132
BEAT = 60 / BPM
DUR = 66 * BEAT  # 30.000 s
N = int(round(DUR * SR))
SHOT_BEATS = [0, 6, 11, 22, 33, 39, 44, 50, 55]
rng = np.random.default_rng(132)

L = np.zeros(N)
R = np.zeros(N)


def t_of(beat):
    return int(round(beat * BEAT * SR))


def add(sig, beat, gain=1.0, pan=0.0, at_sample=None):
    s = at_sample if at_sample is not None else t_of(beat)
    if s >= N:
        return
    e = min(N, s + len(sig))
    seg = sig[: e - s] * gain
    L[s:e] += seg * np.sqrt(0.5 * (1 - pan))
    R[s:e] += seg * np.sqrt(0.5 * (1 + pan))


def filt(x, kind, freq, order=2):
    sos = butter(order, freq, btype=kind, fs=SR, output='sos')
    return sosfilt(sos, x)


def env_exp(n, decay):
    return np.exp(-np.arange(n) / (decay * SR))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def saw(freq, n, detune=0.0):
    t = np.arange(n) / SR
    ph = (t * freq * (1 + detune)) % 1.0
    return 2 * ph - 1


# ---------------------------------------------------------------- drums
def kick(n=int(0.42 * SR), punch=1.0):
    t = np.arange(n) / SR
    f = 44 + 120 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env_exp(n, 0.16)
    click = filt(rng.standard_normal(n), 'highpass', 2500) * env_exp(n, 0.004) * 0.35
    return np.tanh((body + click) * 1.6 * punch)


def clap():
    n = int(0.3 * SR)
    x = np.zeros(n)
    nz = filt(rng.standard_normal(n), 'bandpass', [900, 4200])
    for k, off in enumerate([0, 0.011, 0.022]):
        s = int(off * SR)
        e = env_exp(n - s, 0.012 if k < 2 else 0.11)
        x[s:] += nz[: n - s] * e
    return x * 0.6


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    x = filt(rng.standard_normal(n), 'highpass', 7500)
    return x * env_exp(n, 0.07 if open_ else 0.012) * 0.5


def impact():
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    f = 30 + 70 * np.exp(-t / 0.18)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.55)
    nz = filt(rng.standard_normal(n), 'lowpass', 3000) * env_exp(n, 0.25) * 0.5
    return np.tanh((sub + nz) * 1.3)


def whoosh(length=0.55, peak=0.22):
    n = int(length * SR)
    t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    # sweep a band-pass by processing in short blocks
    out = np.zeros(n)
    blk = 512
    for s in range(0, n, blk):
        c = s / n
        fc = 400 + 5200 * np.sin(np.pi * min(1, c * 1.1)) ** 2
        seg = nz[max(0, s - 256): s + blk]
        y = filt(seg, 'bandpass', [fc * 0.6, min(fc * 1.6, SR / 2 - 100)])
        out[s: s + blk] = y[-len(nz[s: s + blk]):]
    a = np.where(t < peak, (t / peak) ** 2, np.exp(-(t - peak) / 0.09))
    return out * a * 0.9


def riser(beats):
    n = t_of(beats)
    t = np.arange(n) / SR
    k = t / t[-1]
    nz = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 1024
    for s in range(0, n, blk):
        fc = 300 + 7000 * (s / n) ** 2
        seg = nz[max(0, s - 512): s + blk]
        y = filt(seg, 'bandpass', [fc * 0.7, min(fc * 1.4, SR / 2 - 100)])
        out[s: s + blk] = y[-len(nz[s: s + blk]):]
    tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * k ** 2) / SR) * 0.25
    return (out * 0.8 + tone) * k ** 2.2


# ---------------------------------------------------------------- tonal parts
PROG = [  # 4-beat bars from the reveal onwards (A minor world)
    ([57, 60, 64, 71], 33),  # Am(add9)
    ([53, 57, 60, 64], 29),  # Fmaj7
    ([48, 55, 60, 64], 36),  # C
    ([55, 59, 62, 67], 31),  # G
]
CHORDS = {b: PROG[i % 4][0] for i, b in enumerate(range(11, 55, 4))}
ROOTS = {b: PROG[i % 4][1] for i, b in enumerate(range(11, 55, 4))}


def pad(notes, beats, bright=900):
    n = t_of(beats)
    x = np.zeros(n)
    for m in notes:
        for d in (-0.004, 0.0, 0.005):
            x += saw(mtof(m), n, d)
    x = filt(x, 'lowpass', bright)
    t = np.arange(n) / SR
    a = np.minimum(1, t / 0.08) * np.minimum(1, (t[-1] - t) / 0.05 + 0.0001)
    return x * a * 0.05


def bass_note(m, length):
    n = int(length * SR)
    x = saw(mtof(m), n) + 0.5 * np.sin(2 * np.pi * mtof(m) * np.arange(n) / SR)
    x = filt(x, 'lowpass', 420)
    return x * env_exp(n, 0.16) * np.minimum(1, np.arange(n) / 80) * 0.5


def pluck(m, length=0.22, bright=3200):
    n = int(length * SR)
    x = saw(mtof(m), n) * 0.6 + np.sign(np.sin(2 * np.pi * mtof(m) * np.arange(n) / SR)) * 0.3
    x = filt(x, 'lowpass', bright)
    return x * env_exp(n, 0.07) * 0.22


def chord_at(b):
    keys = [k for k in CHORDS if k <= b]
    return max(keys) if keys else None


# ---------------------------------------------------------------- arrangement
# sections (beats): 0 threat | 11 FortKnox | 22 air gap | 33 locked down | 44 scan+recover | 55 end card
sc = np.ones(N)  # sidechain gain from kicks (applied to bass + pads)


def duck_at(beat, depth=0.65, rel=0.2):
    s = t_of(beat)
    n = min(N - s, int(0.4 * SR))
    if n <= 0:
        return
    t = np.arange(n) / SR
    g = 1 - depth * np.exp(-t / (rel * 0.5))
    sc[s: s + n] = np.minimum(sc[s: s + n], g)


def drums(b0, b1, hats=True):
    for b in range(b0, b1):
        add(kick(), b, 0.95)
        duck_at(b)
        if b % 2 == 0:
            add(clap(), b, 0.55, pan=0.05)
        if hats:
            add(hat(True), b + 0.5, 0.28, pan=0.2)
            for s16 in (0.25, 0.75):
                add(hat(), b + s16, 0.16, pan=-0.3)


def stab(k, gain=0.12):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f * t) for f in (220 * (1 + k * 0.12), 331, 587 * (1 + k * 0.06), 1245)) * env_exp(n, 0.09) * gain


# 1 threat (0-11): half-time kick, drone, ticking hats, riser into the reveal
add(impact(), 0, 0.55)
for b in range(0, 11, 2):
    add(kick(punch=0.9), b, 0.8)
    duck_at(b, 0.5)
for b16 in range(0, 11 * 4):
    add(hat(), b16 / 4, 0.18 + 0.12 * (b16 % 2), pan=0.35 if b16 % 2 else -0.35)
drone_n = t_of(11)
tt = np.arange(drone_n) / SR
drone = (np.sin(2 * np.pi * 55 * tt) + 0.5 * np.sin(2 * np.pi * 55.4 * tt) + 0.3 * filt(saw(110, drone_n), 'lowpass', 300))
drone *= np.minimum(1, tt / 0.3) * 0.22
tension = np.zeros(N)
tension[:drone_n] = drone
add(riser(3), 8, 0.55)

# 2 FortKnox (11-22): impact + full groove
add(impact(), 11, 0.9)
drums(11, 22)

# 3 air gap (22-33): breakdown — no kick, open hats, pads only; a thud when the window shuts
add(kick(), 22, 0.8)
for b in range(22, 33):
    add(hat(True), b + 0.5, 0.2, pan=0.2)
add(impact(), 28.5, 0.4)
add(riser(3), 30, 0.5)

# 4 locked down (33-44): impact, groove, lock hits and two key clicks
add(impact(), 33, 0.9)
drums(33, 44)
for k, b in enumerate([34, 35.5, 37]):
    add(stab(k), b, 1.0)
for b in (40.5, 41.5):
    add(stab(2, 0.08)[: int(0.12 * SR)], b, 1.0)

# 5 scan + recover (44-55): groove with a brighter arp, riser into the end card
drums(44, 55)
add(riser(3), 52, 0.45)

# bass: rolling off-beat 16ths on the chord root (not in the breakdown)
for b16 in range(11 * 4, 55 * 4):
    b = b16 / 4
    if b16 % 4 == 0 or 22 <= b < 33:
        continue
    m = ROOTS[chord_at(b)] + (12 if b16 % 4 == 2 else 0)
    add(bass_note(m, BEAT / 4 * 0.95), b, 0.9)

# pads
pad_bus = np.zeros(N)
beats_sorted = sorted(CHORDS)
for i, b in enumerate(beats_sorted):
    nb = beats_sorted[i + 1] if i + 1 < len(beats_sorted) else 55
    p = pad(CHORDS[b], nb - b, bright=1400 if b >= 44 else 700 if 22 <= b < 33 else 900)
    s = t_of(b)
    pad_bus[s: s + len(p)] += p * (1.4 if 22 <= b < 33 else 1.0)

# arp: 16ths through chord tones; filtered in the breakdown, brighter for the recovery
arp_L = np.zeros(N)
arp_R = np.zeros(N)
for b16 in range(11 * 4, 55 * 4):
    b = b16 / 4
    notes = CHORDS[chord_at(b)]
    m = notes[(b16 * 3) % len(notes)] + 12
    if 22 <= b < 33:
        x = pluck(m, bright=1400) * 0.7
    else:
        x = pluck(m, bright=5200 if b >= 44 else 2600) * (1.25 if b >= 44 else 1.0)
    s = t_of(b)
    e = min(N, s + len(x))
    pan = 0.4 * np.sin(b16 * 0.7)
    arp_L[s:e] += x[: e - s] * np.sqrt(0.5 * (1 - pan))
    arp_R[s:e] += x[: e - s] * np.sqrt(0.5 * (1 + pan))

# 6 end card (55-66): final impact, resolve chord, a soft heartbeat and a sparse arp that fades out
add(impact(), 55, 0.95)
for m in (69, 72, 76, 81):
    add(pluck(m, 1.2, 4000) * 1.4, 55, 1.0, pan=0.3 if m % 2 else -0.3)
for b in range(57, 63, 2):
    add(kick(punch=0.7), b, 0.45)
for b8 in range(56 * 2, 65 * 2):
    b = b8 / 2
    m = [69, 76, 72, 79][b8 % 4]
    x = pluck(m, 0.3, 3000) * 0.8 * max(0.0, 1 - (b - 56) / 9)
    add(x, b, 1.0, pan=0.35 if b8 % 2 else -0.35)
end_n = N - t_of(55)
end_pad = pad([45, 57, 60, 64, 71, 76], 66 - 55, bright=1800)[:end_n]
end_env = np.minimum(1, np.arange(end_n) / (0.02 * SR)) * np.exp(-np.arange(end_n) / (3.2 * SR))

# dotted-eighth delay on the arp
d = int(0.75 * BEAT * SR)
for bus in (arp_L, arp_R):
    tap = np.zeros(N)
    tap[d:] = bus[:-d] * 0.35
    bus += filt(tap, 'lowpass', 3000)

# whooshes on every camera whip (shots 2-9)
for b in SHOT_BEATS[1:]:
    w = whoosh()
    s = t_of(b) - int(0.05 * SR)
    add(w, 0, 0.42, pan=-0.25, at_sample=s)
    add(w, 0, 0.30, pan=0.25, at_sample=s + 90)

# ---------------------------------------------------------------- mix
padL = pad_bus.copy()
padR = pad_bus.copy()
padR[240:] = pad_bus[:-240]  # Haas width
end_full = np.zeros(N)
end_full[t_of(55):] = end_pad * end_env * 1.6
L += (padL + end_full) * sc + arp_L + tension * sc
R += (padR + end_full) * sc + arp_R + tension * sc

# small room reverb on everything
ir_n = int(0.9 * SR)
irs = []
for _ in range(2):  # decorrelated left/right tails
    ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / (0.22 * SR))
    ir = filt(ir, 'lowpass', 5000)
    irs.append(ir / np.sqrt(np.sum(ir ** 2)))
L = L + 0.18 * fftconvolve(L, irs[0])[:N]
R = R + 0.18 * fftconvolve(R, irs[1])[:N]

# master: high-pass rumble, soft clip, set bed level, fade last 120 ms
L = filt(L, 'highpass', 28)
R = filt(R, 'highpass', 28)
mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.2) / 1.2
rms = np.sqrt(np.mean(mix ** 2))
target_rms = 10 ** (-24 / 20)  # bed sits ~ -24 dBFS RMS; VO is normalised to ~ -16
mix *= target_rms / rms
peak = np.max(np.abs(mix))
if peak > 10 ** (-3 / 20):
    mix *= 10 ** (-3 / 20) / peak
fade = int(1.2 * SR)  # tail fades over the last 1.2 s
mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
mix[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]

out = os.path.join(os.path.dirname(__file__), '..', 'public', 'music.wav')
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'music.wav: {N / SR:.3f} s, rms {20 * np.log10(np.sqrt(np.mean(mix ** 2))):.1f} dBFS, peak {20 * np.log10(np.max(np.abs(mix))):.1f} dBFS')

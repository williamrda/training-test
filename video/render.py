"""Renders the video frames procedurally with Pillow + numpy and pipes them to ffmpeg.

    python3 render.py out/soundtrack.wav out/ai_engineer_field_guide.mp4
    python3 render.py --still 12.3 out/still.png     # debug a single frame
"""
import math
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import content as C
from content import W, H, FPS, BAR, BEAT, DURATION

HERE = Path(__file__).parent
ANTON = str(HERE / "fonts/Anton.woff")
MONO_B = str(HERE / "fonts/JBMono-ExtraBold.woff")
MONO = str(HERE / "fonts/JBMono.woff")


# ---- helpers -----------------------------------------------------------------
@lru_cache(maxsize=256)
def font(path, size):
    return ImageFont.truetype(path, max(4, int(size)))


def fit(path, text, max_w, size):
    f = font(path, size)
    w = f.getlength(text)
    return font(path, size * max_w / w) if w > max_w else f


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_back(x, s=2.2):
    x = clamp(x) - 1
    return 1 + x * x * ((s + 1) * x + s)


def mix(c1, c2, k):
    return tuple(int(a + (b - a) * k) for a, b in zip(c1, c2))


def dim(c, k):
    return tuple(int(v * k) for v in c)


def typed(text, p):
    n = int(len(text) * clamp(p))
    return text[:n] + ("_" if 0 < p < 1 else "")


def text_c(d, xy, s, f, fill, anchor="mm", **kw):
    d.text(xy, s, font=f, fill=fill, anchor=anchor, **kw)


def rgb_split_text(d, xy, s, f, fill, off, anchor="mm", stroke=0):
    """Loud title text: magenta + cyan ghosts offset behind the main fill."""
    x, y = xy
    d.text((x - off, y), s, font=f, fill=C.MAGENTA, anchor=anchor, stroke_width=stroke, stroke_fill=C.MAGENTA)
    d.text((x + off, y + off * 0.4), s, font=f, fill=C.CYAN, anchor=anchor, stroke_width=stroke, stroke_fill=C.CYAN)
    d.text((x, y), s, font=f, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=fill)


def section(t):
    bar = t / BAR
    for name, (a, b) in (("intro", C.INTRO), ("title", C.TITLE), ("topics", C.TOPICS),
                         ("chant", C.CHANT), ("outro", C.OUTRO)):
        if a <= bar < b:
            return name, t - a * BAR
    return "outro", t - C.OUTRO[0] * BAR


def kick_env(t):
    """Mirrors the kick pattern in audio.py so visuals punch on the beat."""
    bar = t / BAR
    if bar < C.TITLE[0] or bar >= C.OUTRO[1] - 1 + 0.25:
        return math.exp(-(t % BAR) / 0.09) if bar < 1 else 0.0
    return math.exp(-(t % BEAT) / 0.09)


# ---- precomputed layers ------------------------------------------------------
_yy, _xx = np.mgrid[0:H, 0:W].astype(np.float32)
_r = np.sqrt(((_xx - W / 2) / (W / 2)) ** 2 + ((_yy - H / 2) / (H / 2)) ** 2)
VIGNETTE = np.clip(1.25 - 0.55 * _r ** 1.6, 0.25, 1.0)[..., None].astype(np.float32)
SCAN = np.where((np.arange(H) % 3) == 0, 0.78, 1.0).astype(np.float32)[:, None, None]
BG_GRAD = (np.array(C.BG, np.float32)[None, None, :] * (1 - _yy[..., None] / H * 0.4)
           + np.array([40, 0, 60], np.float32) * np.clip(1 - np.abs(_yy[..., None] - H * 0.62) / 260, 0, 1))
del _yy, _xx, _r
_grain_rng = np.random.default_rng(1)
GRAIN = [(_grain_rng.standard_normal((H // 2, W // 2, 1)) * 5).astype(np.float32) for _ in range(6)]

_srng = np.random.default_rng(3)
STARS = np.stack([_srng.uniform(-1, 1, 400), _srng.uniform(-1, 1, 400), _srng.uniform(0.05, 1, 400)], 1)
RAIN_CHARS = "01ABCDEF<>/{}[]=+*#$%&"
RAIN = [(int(x), _srng.uniform(60, 260), _srng.uniform(0, 2000), "".join(_srng.choice(list(RAIN_CHARS), 40)))
        for x in np.linspace(20, W - 20, 48)]


# ---- background --------------------------------------------------------------
def draw_grid(d, t, color, speed=1.0, horizon=H * 0.62, alpha=1.0):
    vx = W / 2
    col = dim(color, alpha)
    for k in range(-22, 23):  # rays toward the vanishing point
        x_bottom = vx + k * 150
        d.line([(vx + k * 6, horizon), (x_bottom, H)], fill=col, width=2)
    phase = (t * speed * 1.4) % 1.0
    for k in range(18):  # scrolling horizontal lines
        z = (k + 1 - phase)
        y = horizon + (H - horizon) * (1.2 / z) ** 1.6 / 1.2 ** 1.6 * 0.95
        if horizon < y < H:
            w = 1 + int(3 * (y - horizon) / (H - horizon))
            d.line([(0, y), (W, y)], fill=col, width=w)
    d.line([(0, horizon), (W, horizon)], fill=mix(col, C.WHITE, 0.4), width=3)


def draw_sun(d, cx, cy, r, t):
    for i in range(0, int(2 * r), 4):  # vertical gradient disc, striped lower half
        y = cy - r + i
        k = i / (2 * r)
        stripe_h = 2 + k * 18
        if k > 0.5 and ((y + t * 40) % 28) < stripe_h:
            continue
        half = math.sqrt(max(0, r * r - (y - cy) ** 2))
        d.line([(cx - half, y), (cx + half, y)], fill=mix(C.ACID, C.MAGENTA, k), width=4)


def draw_stars(d, t, speed):
    for x, y, z in STARS:
        zz = (z - t * 0.25 * speed) % 1.0 + 0.02
        sx, sy = W / 2 + x / zz * 260, H * 0.4 + y / zz * 160
        if 0 <= sx < W and 0 <= sy < H:
            s = (1 - zz) * 4 * speed ** 0.5
            tail = 1 + speed * 6 * (1 - zz)
            d.line([(sx, sy), (W / 2 + (sx - W / 2) / tail ** 0.15, H * 0.4 + (sy - H * 0.4) / tail ** 0.15)],
                   fill=mix(C.CYAN, C.WHITE, 1 - zz), width=max(1, int(s)))


def draw_rain(d, t, color, alpha):
    f = font(MONO, 20)
    for x, spd, off, chars in RAIN:
        head = (t * spd + off) % (H + 400) - 200
        for j in range(14):
            y = head - j * 24
            if 0 <= y < H:
                ch = chars[(j + int(t * 12)) % len(chars)]
                d.text((x, y), ch, font=f, fill=dim(color, alpha * (1 - j / 14)))


def draw_ticker(d, t, y, text, color, speed, bg):
    f = font(MONO_B, 30)
    d.rectangle([0, y - 26, W, y + 26], fill=bg)
    unit = text + "   //   "
    uw = f.getlength(unit)
    x = -((t * speed) % uw)
    while x < W:
        d.text((x, y), unit, font=f, fill=color, anchor="lm")
        x += uw


def brackets(d, box, color, L=40, w=5):
    x0, y0, x1, y1 = box
    for (x, y, sx, sy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
        d.line([(x, y), (x + L * sx, y)], fill=color, width=w)
        d.line([(x, y), (x, y + L * sy)], fill=color, width=w)


# ---- topic visuals -------------------------------------------------------------
def vis_neural(d, box, p, acc, t):
    x0, y0, x1, y1 = box
    layers = [4, 7, 7, 5, 2]
    pts = []
    for li, n in enumerate(layers):
        x = x0 + 60 + (x1 - x0 - 120) * li / (len(layers) - 1)
        pts.append([(x, y0 + (y1 - y0) * (j + 1) / (n + 1)) for j in range(n)])
    for li in range(len(layers) - 1):
        for a in pts[li]:
            for b in pts[li + 1]:
                d.line([a, b], fill=dim(acc, 0.28), width=1)
    rng = np.random.default_rng(11)
    for k in range(60):  # signal pulses flowing forward
        li = rng.integers(0, len(layers) - 1)
        a = pts[li][rng.integers(0, len(pts[li]))]
        b = pts[li + 1][rng.integers(0, len(pts[li + 1]))]
        u = (p * 3 + k / 60) % 1.0
        x, y = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
        d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=C.WHITE)
    for li, col in enumerate(pts):
        for j, (x, y) in enumerate(col):
            on = (int(t / BEAT * 2) + j + li) % 3 == 0
            r = 17 if on else 13
            d.ellipse([x - r, y - r, x + r, y + r], fill=C.BG, outline=C.WHITE if on else acc, width=5)
            if on:
                d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=acc)


def vis_tokens(d, box, p, acc, t):
    x0, y0, x1, y1 = box
    f = font(MONO_B, 30)
    d.text((x0 + 20, y0 + 20), "<system> you are a helpful", font=font(MONO, 26), fill=dim(C.WHITE, 0.7))
    toks = ["The", " model", " reads", " tokens", ",", " not", " words", ".", " Few", "-shot", " examples",
            " steer", " the", " output", " ->", " {\"json\"", ":", " true}", " Always", " test", " prompts", "!"]
    x, y = x0 + 20, y0 + 90
    shown = int(len(toks) * ease_out(p * 1.3))
    for k, tok in enumerate(toks[:shown]):
        w = f.getlength(tok) + 22
        if x + w > x1 - 20:
            x, y = x0 + 20, y + 74
        col = C.ACCENTS[k % 4]
        d.rounded_rectangle([x, y, x + w, y + 56], 10, fill=dim(col, 0.3), outline=col, width=3)
        d.text((x + 11, y + 28), tok, font=f, fill=C.WHITE, anchor="lm")
        d.text((x + w / 2, y + 66), str(1000 + k * 37), font=font(MONO, 14), fill=dim(col, 0.8), anchor="mm")
        x += w + 10
    d.text((x0 + 20, y1 - 40), f"tokens: {shown * 37:>5}   temp: 0.7   top_p: 0.95",
           font=font(MONO_B, 26), fill=acc)


def vis_vectors(d, box, p, acc, t):
    x0, y0, x1, y1 = box
    rng = np.random.default_rng(5)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    centers = rng.uniform([x0 + 80, y0 + 80], [x1 - 80, y1 - 80], (5, 2))
    pts = np.concatenate([c + rng.standard_normal((30, 2)) * 55 for c in centers])
    pts = np.clip(pts, [x0 + 10, y0 + 10], [x1 - 10, y1 - 10])
    q = np.array([cx + 60 * math.sin(t * 2), cy + 40 * math.cos(t * 3)])
    dist = np.linalg.norm(pts - q, axis=1)
    near = np.argsort(dist)[:8]
    R = 60 + 380 * ease_out(p * 1.6)
    d.ellipse([q[0] - R, q[1] - R, q[0] + R, q[1] + R], outline=dim(acc, 0.6), width=3)
    for k, i in enumerate(near):
        if k < int(p * 14):
            d.line([tuple(q), tuple(pts[i])], fill=C.ACID, width=3)
    for i, (x, y) in enumerate(pts):
        hit = i in near[:int(p * 14)]
        r = 9 if hit else 6
        d.ellipse([x - r, y - r, x + r, y + r], fill=C.ACID if hit else C.ACCENTS[i % 4])
    r = 16 + 6 * kick_env(t)
    d.regular_polygon((q[0], q[1], r), 4, rotation=t * 90, fill=C.WHITE)
    d.text((x0 + 20, y1 - 40), f"top_k=8  cosine  hits={min(8, int(p * 14))}", font=font(MONO_B, 26), fill=acc)


def vis_agent(d, box, p, acc, t):
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    R = min(x1 - x0, y1 - y0) * 0.33
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=dim(acc, 0.7), width=6)
    labels = ["THINK", "ACT", "OBSERVE"]
    ang = t / BEAT * math.pi / 2  # one node per beat
    for k, lab in enumerate(labels):
        a = -math.pi / 2 + k * 2 * math.pi / 3
        x, y = cx + R * math.cos(a), cy + R * math.sin(a)
        active = int(t / BEAT) % 3 == k
        col = C.ACID if active else acc
        d.rounded_rectangle([x - 110, y - 36, x + 110, y + 36], 14, fill=col if active else C.BG, outline=col, width=5)
        d.text((x, y), lab, font=font(ANTON, 44), fill=C.BG if active else C.WHITE, anchor="mm")
    hx, hy = cx + R * math.cos(ang - math.pi / 2), cy + R * math.sin(ang - math.pi / 2)
    d.ellipse([hx - 14, hy - 14, hx + 14, hy + 14], fill=C.WHITE)
    d.regular_polygon((cx, cy, 70), 6, rotation=t * 30, fill=dim(acc, 0.35), outline=C.WHITE, width=4)
    d.text((cx, cy), "LLM", font=font(ANTON, 56), fill=C.WHITE, anchor="mm")
    tools = ["search()", "run_code()", "sql()", "browse()"]
    for k, tool in enumerate(tools):
        a = math.pi / 4 + k * math.pi / 2
        x, y = cx + (R + 150) * math.cos(a), cy + (R + 110) * math.sin(a)
        blink = (int(t * 8) + k) % 4 == 0
        d.text((x, y), tool, font=font(MONO_B, 26), fill=C.ACID if blink else dim(C.WHITE, 0.6), anchor="mm")


def vis_bars(d, box, p, acc, t):
    x0, y0, x1, y1 = box
    vals = [0.62, 0.78, 0.71, 0.88, 0.93, 0.974]
    names = ["v1", "v2", "v3", "v4", "v5", "v6"]
    base = y1 - 70
    bw = (x1 - x0 - 80) / len(vals)
    for k, v in enumerate(vals):
        g = ease_back(p * 2.2 - k * 0.12)
        h = (base - y0 - 90) * v * max(0, g)
        x = x0 + 40 + k * bw
        col = C.ACID if k == len(vals) - 1 else C.ACCENTS[k % 4]
        d.rectangle([x + 10, base - h, x + bw - 10, base], fill=dim(col, 0.4), outline=col, width=4)
        for yy in range(int(base - h) + 8, int(base), 16):
            d.line([(x + 16, yy), (x + bw - 16, yy)], fill=dim(col, 0.6), width=2)
        d.text((x + bw / 2, base + 30), names[k], font=font(MONO_B, 26), fill=C.WHITE, anchor="mm")
        if g > 0.5:
            d.text((x + bw / 2, base - h - 24), f"{v * 100:.0f}", font=font(MONO_B, 26), fill=col, anchor="mm")
    d.line([(x0 + 30, base), (x1 - 30, base)], fill=C.WHITE, width=4)
    score = 97.4 * ease_out(p * 1.5)
    d.text((x0 + 30, y0 + 30), f"PASS {score:4.1f}%", font=font(ANTON, 70), fill=C.ACID, anchor="la")


def vis_loss(d, box, p, acc, t):
    x0, y0, x1, y1 = box
    d.line([(x0 + 60, y0 + 30), (x0 + 60, y1 - 60), (x1 - 20, y1 - 60)], fill=C.WHITE, width=4)
    for k in range(1, 6):
        yy = y0 + 30 + (y1 - y0 - 90) * k / 6
        d.line([(x0 + 62, yy), (x1 - 20, yy)], fill=dim(acc, 0.25), width=1)
    rng = np.random.default_rng(9)
    n = 160
    xs = np.linspace(0, 1, n)
    ys = np.exp(-4 * xs) * 0.85 + 0.08 + rng.standard_normal(n) * 0.025 * (1 - xs * 0.6)
    val = np.exp(-4 * xs) * 0.8 + 0.12 + rng.standard_normal(n) * 0.02
    m = max(2, int(n * ease_out(p * 1.4)))

    def P(x, y):
        return x0 + 60 + x * (x1 - x0 - 90), y1 - 60 - y * (y1 - y0 - 100)
    d.line([P(a, b) for a, b in zip(xs[:m], val[:m])], fill=C.CYAN, width=4)
    d.line([P(a, b) for a, b in zip(xs[:m], ys[:m])], fill=C.MAGENTA, width=6)
    hx, hy = P(xs[m - 1], ys[m - 1])
    d.ellipse([hx - 12, hy - 12, hx + 12, hy + 12], fill=C.WHITE)
    d.text((x1 - 30, y0 + 40), f"loss {ys[m - 1]:.4f}", font=font(MONO_B, 34), fill=C.ACID, anchor="ra")
    d.text((x1 - 30, y0 + 84), f"epoch {int(m / n * 12):02d}/12  lora r=16", font=font(MONO, 24),
           fill=dim(C.WHITE, 0.8), anchor="ra")


def vis_ops(d, box, p, acc, t):
    x0, y0, x1, y1 = box
    rng = np.random.default_rng(int(t * 12))
    for r in range(3):  # server racks with blinking LEDs
        rx = x0 + 30 + r * 150
        d.rectangle([rx, y0 + 30, rx + 120, y1 - 180], outline=acc, width=4)
        for u in range(9):
            uy = y0 + 50 + u * 42
            d.rectangle([rx + 10, uy, rx + 110, uy + 30], fill=dim(C.WHITE, 0.08), outline=dim(acc, 0.5))
            for l in range(4):
                on = rng.random() > 0.45
                col = C.ACID if l < 3 else (C.ORANGE if rng.random() > 0.8 else C.CYAN)
                d.rectangle([rx + 16 + l * 14, uy + 11, rx + 24 + l * 14, uy + 19], fill=col if on else dim(col, 0.2))
    sx0, sx1 = x0 + 500, x1 - 20
    d.text((sx0, y0 + 30), "LATENCY p95", font=font(MONO_B, 26), fill=C.WHITE)
    k = np.arange(60)
    lat = 0.5 + 0.25 * np.sin(k * 0.5 + t * 8) + 0.15 * np.sin(k * 1.7 - t * 5)
    pts = [(sx0 + i * (sx1 - sx0) / 59, y0 + 260 - v * 170) for i, v in enumerate(lat)]
    d.line(pts, fill=C.CYAN, width=4)
    d.text((sx0, y0 + 300), f"{280 + int(40 * math.sin(t * 6))}ms", font=font(ANTON, 90), fill=C.ACID)
    stats = [("$/1k req", f"{0.21 + 0.02 * math.sin(t * 4):.2f}"), ("uptime", "99.99%"), ("traces", f"{int(t * 1234) % 99999:05d}")]
    for i, (a, b) in enumerate(stats):
        y = y1 - 150 + i * 46
        d.text((x0 + 30, y), a, font=font(MONO, 30), fill=dim(C.WHITE, 0.8))
        d.text((x0 + 330, y), b, font=font(MONO_B, 30), fill=C.ACCENTS[i])


def vis_shield(d, box, p, acc, t):
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 - 10
    for k in range(4):
        d.regular_polygon((cx, cy, 230 - k * 40), 6, rotation=30, outline=dim(acc, 1 - k * 0.2), width=7 - k)
    scan = cy - 230 + (t * 900 % 460)
    half = 200
    d.line([(cx - half, scan), (cx + half, scan)], fill=C.WHITE, width=4)
    threats = ["INJECTION", "JAILBREAK", "PII LEAK", "EXFIL"]
    for k, name in enumerate(threats):
        a = k * math.pi / 2 + math.pi / 4
        u = clamp(p * 2.6 - k * 0.35)
        dist = 470 - 220 * ease_out(u)
        x, y = cx + dist * math.cos(a), cy + dist * math.sin(a) * 0.72
        hit = u >= 1
        col = C.ORANGE if not hit else dim(C.ORANGE, 0.5)
        text_c(d, (x, y), name, font(MONO_B, 26), col)
        if hit:
            d.line([(x - 70, y - 22), (x + 70, y + 22)], fill=C.ORANGE, width=6)
            d.line([(x - 70, y + 22), (x + 70, y - 22)], fill=C.ORANGE, width=6)
    if p > 0.55:
        k = ease_back((p - 0.55) * 5)
        f = font(ANTON, 110 * max(0.3, k))
        d.text((cx, cy), "BLOCKED", font=f, fill=C.ACID, anchor="mm", stroke_width=6, stroke_fill=C.BG)


VISUALS = {"neural": vis_neural, "tokens": vis_tokens, "vectors": vis_vectors, "agent": vis_agent,
           "bars": vis_bars, "loss": vis_loss, "ops": vis_ops, "shield": vis_shield}


# ---- scenes --------------------------------------------------------------------
def scene_intro(d, t, lt):
    draw_rain(d, t, C.CYAN, 0.18)
    draw_grid(d, t, C.MAGENTA, 0.5, alpha=0.35 + 0.4 * lt / (2 * BAR))
    bx0, by0, bx1, by1 = 260, 230, W - 260, H - 230
    d.rectangle([bx0, by0, bx1, by1], fill=(10, 8, 22), outline=C.CYAN, width=4)
    d.rectangle([bx0, by0, bx1, by0 + 56], fill=C.CYAN)
    for k, col in enumerate((C.ORANGE, C.ACID, C.MAGENTA)):
        d.ellipse([bx0 + 22 + k * 40, by0 + 14, bx0 + 50 + k * 40, by0 + 42], fill=col)
    d.text((bx0 + 170, by0 + 28), "field_guide.exe — root@ai-engineer", font=font(MONO_B, 28), fill=C.BG, anchor="lm")
    f = font(MONO_B, 38)
    for k, line in enumerate(C.BOOT_LINES):
        start = k * 0.75 * BEAT
        if lt >= start:
            col = C.ACID if line.endswith(("ok", "%")) and lt > start + 0.3 else C.WHITE
            d.text((bx0 + 40, by0 + 100 + k * 64), typed(line, (lt - start) / 0.3), font=f, fill=col)
    prog_start = BAR + 2 * BEAT
    if lt >= prog_start:
        steps = min(8, int((lt - prog_start) / (BEAT / 4)) + 1)
        px0, py = bx0 + 40, by1 - 90
        d.text((px0, py - 50), f"LOADING GUIDE  {steps * 100 // 8:3d}%", font=font(MONO_B, 34), fill=C.MAGENTA)
        d.rectangle([px0, py, bx1 - 40, py + 44], outline=C.MAGENTA, width=4)
        seg = (bx1 - 40 - px0 - 12) / 8
        for s in range(steps):
            d.rectangle([px0 + 8 + s * seg, py + 8, px0 + 4 + (s + 1) * seg, py + 36], fill=C.ACCENTS[s % 4])


def title_lockup(d, t, lt, y_top=400, y_bot=640, sun=True):
    if sun:
        draw_sun(d, W / 2, H * 0.62 - 40 + 60 * (1 - ease_out(lt / BAR)), 330, t)
    draw_grid(d, t, C.MAGENTA, 1.0)
    k = ease_out(lt / 0.16)
    size = 300 * (2.4 - 1.4 * k)
    f = fit(ANTON, C.TITLE_TOP, W - 180, size)
    off = 6 + 30 * (1 - k) + 14 * kick_env(t)
    rgb_split_text(d, (W / 2, y_top), C.TITLE_TOP, f, C.WHITE, off, stroke=3)
    fb = fit(ANTON, C.TITLE_BOTTOM, W - 500, 220)
    total = fb.getlength(C.TITLE_BOTTOM)
    x = W / 2 - total / 2
    for i, ch in enumerate(C.TITLE_BOTTOM):
        appear = BEAT + i * BEAT / 4
        cw = fb.getlength(ch)
        if lt >= appear:
            pop = ease_back((lt - appear) / 0.12)
            fy = y_bot + 40 * (1 - pop)
            d.text((x + cw / 2, fy), ch, font=fb, fill=C.BG, anchor="mm", stroke_width=6, stroke_fill=C.ACID)
        x += cw


def scene_title(d, t, lt):
    draw_stars(d, t, 1.0)
    title_lockup(d, t, lt)
    if lt >= BAR:
        s = typed(C.TAGLINE, (lt - BAR) / (BEAT * 1.5))
        f = font(MONO_B, 46)
        w = f.getlength(C.TAGLINE) + 60
        d.rectangle([W / 2 - w / 2, 800, W / 2 + w / 2, 876], fill=C.MAGENTA)
        d.text((W / 2 - w / 2 + 30, 838), s, font=f, fill=C.WHITE, anchor="lm")


def scene_topic(d, t, lt, i):
    title, sub, kind = C.TOPICS_LIST[i]
    acc = C.ACCENTS[i % 4]
    p = lt / BAR
    draw_rain(d, t, acc, 0.12)
    draw_grid(d, t, dim(acc, 0.6), 1.3, horizon=H * 0.78, alpha=0.6)
    # giant outlined index number drifting behind
    num = f"{i + 1:02d}"
    d.text((40 - 60 * p, 470), num, font=font(ANTON, 640), fill=C.BG, anchor="lm", stroke_width=5,
           stroke_fill=dim(acc, 0.55))
    # title slam from the left
    tx = 110 - 900 * (1 - ease_back(lt / 0.22))
    ft = fit(ANTON, title, 900, 170)
    d.text((tx, 470), title, font=ft, fill=C.WHITE, anchor="ls", stroke_width=3, stroke_fill=C.WHITE)
    d.rectangle([tx, 500, tx + 120 + 400 * ease_out(lt / 0.4), 516], fill=acc)
    fs = fit(MONO_B, sub, 880, 36)
    d.text((110, 570), typed(sub, (lt - 0.1) / 0.5), font=fs, fill=acc)
    d.text((110, 390 - ft.size), f"CHAPTER {num} / 08", font=font(MONO_B, 30), fill=dim(C.WHITE, 0.75))
    # visual panel
    box = (1060, 210, 1820, 850)
    d.rectangle(box, fill=(12, 10, 26))
    brackets(d, (box[0] - 14, box[1] - 14, box[2] + 14, box[3] + 14), acc)
    d.text((box[0], box[1] - 44), f"FIG.{num} // {kind.upper()}", font=font(MONO_B, 24), fill=acc)
    VISUALS[kind](d, box, p, acc, t)
    # chapter progress
    for k in range(8):
        x = 110 + k * 110
        col = acc if k == i else (dim(C.WHITE, 0.6) if k < i else dim(C.WHITE, 0.2))
        d.rectangle([x, 690, x + 96, 704], fill=col)
    # diagonal wipe on entry
    if lt < 0.2:
        u = lt / 0.2
        x = -600 + (W + 1200) * u
        d.polygon([(x - 500, 0), (x + 300, 0), (x - 200, H), (x - 1000, H)], fill=acc)
        d.polygon([(x + 350, 0), (x + 450, 0), (x - 50, H), (x - 150, H)], fill=C.WHITE)


def scene_chant(d, t, lt):
    beat = int(lt / BEAT)
    word = C.CHANT_WORDS[min(3, beat // 2)]
    lb = (lt % BEAT) / BEAT
    acc = C.ACCENTS[beat % 4]
    strobe = int(lt / (BEAT / 4)) % 2 == 0 and lb < 0.5
    bg = acc if strobe else C.BG
    fg = C.BG if strobe else acc
    d.rectangle([0, 0, W, H], fill=bg)
    draw_stars(d, t, 4.0)
    for k in range(5, 0, -1):  # echo outlines expanding outward
        f = fit(ANTON, word, (W - 160) * (1 + k * 0.18 * lb + k * 0.08), 700)
        d.text((W / 2, H / 2), word, font=f, fill=bg, anchor="mm", stroke_width=3, stroke_fill=dim(C.WHITE, 0.25 + 0.1 * (5 - k)))
    punch = 1 + 0.12 * math.exp(-lb * 6)
    f = fit(ANTON, word, (W - 200) * punch, 700 * punch)
    d.text((W / 2 + 12, H / 2 + 12), word, font=f, fill=C.MAGENTA if fg != C.MAGENTA else C.CYAN, anchor="mm")
    d.text((W / 2, H / 2), word, font=f, fill=fg if strobe else C.WHITE, anchor="mm", stroke_width=6,
           stroke_fill=C.BG if strobe else acc)
    draw_ticker(d, t, 60, "BUILD  SHIP  EVAL  REPEAT", C.BG, 1400, C.ACID)
    draw_ticker(d, -t, H - 60, "BUILD  SHIP  EVAL  REPEAT", C.WHITE, 1400, C.MAGENTA)


def scene_outro(d, t, lt):
    draw_stars(d, t, 0.6)
    title_lockup(d, t, lt, y_top=340, y_bot=570)
    if lt >= BEAT * 2:
        f = fit(MONO_B, C.URL, 1500, 44)
        s = typed(C.URL, (lt - BEAT * 2) / (BEAT * 2))
        w = f.getlength(C.URL) + 60
        d.rectangle([W / 2 - w / 2, 720, W / 2 + w / 2, 790], fill=(10, 8, 22), outline=C.CYAN, width=4)
        d.text((W / 2 - w / 2 + 30, 755), s, font=f, fill=C.CYAN, anchor="lm")
    if lt >= BAR:
        pulse = 1 + 0.08 * kick_env(t)
        cta = C.CTA + "  >>"
        f = font(ANTON, 64 * pulse)
        w = f.getlength(cta) + 80
        d.rounded_rectangle([W / 2 - w / 2, 840, W / 2 + w / 2, 940], 18, fill=C.ACID)
        d.text((W / 2, 890), cta, font=f, fill=C.BG, anchor="mm")


# ---- post-processing -------------------------------------------------------------
def post(img, t, sec, lt):
    rng = np.random.default_rng(int(t * FPS) + 99)
    k = kick_env(t)
    bar_phase = (t % BAR)
    transition = math.exp(-bar_phase / 0.08) if sec in ("topics", "chant") or t / BAR >= 2 else 0
    impact = max(math.exp(-abs(t - b * BAR) / 0.12) for b in (C.TITLE[0], C.CHANT[0], C.OUTRO[0], C.OUTRO[1] - 1))
    glitch = max(transition * 0.8, impact, 0.35 if sec == "intro" and lt > BAR * 1.75 else 0.0)

    # zoom punch on kicks
    z = 1 + 0.035 * k + 0.08 * impact
    if z > 1.001:
        cw, ch = W / z, H / z
        img = img.resize((W, H), Image.BILINEAR, box=((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2))

    small = img.resize((W // 4, H // 4), Image.BILINEAR).filter(ImageFilter.GaussianBlur(7))
    glow = np.asarray(small.resize((W, H), Image.BILINEAR), np.float32)
    a = np.asarray(img, np.float32)
    a = a + glow * (0.7 + 0.7 * k)

    # chromatic aberration
    ca = int(3 + 10 * k + 40 * glitch)
    a[..., 0] = np.roll(a[..., 0], ca, axis=1)
    a[..., 2] = np.roll(a[..., 2], -ca, axis=1)

    # glitch slices
    if glitch > 0.2:
        for _ in range(int(4 + 14 * glitch)):
            y0 = rng.integers(0, H - 10)
            hh = int(rng.integers(6, 80))
            a[y0:y0 + hh] = np.roll(a[y0:y0 + hh], int(rng.integers(-220, 220) * glitch), axis=1)

    # camera shake
    sh = int(18 * impact + 4 * k)
    if sh:
        a = np.roll(a, (int(rng.integers(-sh, sh + 1)), int(rng.integers(-sh, sh + 1))), axis=(0, 1))

    g = GRAIN[int(t * FPS) % len(GRAIN)]
    a = a + np.repeat(np.repeat(g, 2, 0), 2, 1)
    a = a * SCAN * VIGNETTE
    a = a + 255 * 0.85 * impact  # white flash
    if t > DURATION - 0.5:
        a *= (DURATION - t) / 0.5
    if t < 0.15:
        a *= t / 0.15
    return np.clip(a, 0, 255).astype(np.uint8)


def render_frame(fi):
    t = fi / FPS
    sec, lt = section(t)
    base = Image.fromarray(BG_GRAD.astype(np.uint8))
    d = ImageDraw.Draw(base)
    if sec == "intro":
        scene_intro(d, t, lt)
    elif sec == "title":
        scene_title(d, t, lt)
    elif sec == "topics":
        i = int(lt / BAR)
        scene_topic(d, t, lt - i * BAR, i)
        draw_ticker(d, t, 40, "LLMs // PROMPTS // RAG // AGENTS // EVALS // FINE-TUNING // OPS // SAFETY", C.BG, 500, C.ACCENTS[i % 4])
        draw_ticker(d, -t, H - 40, "AI ENGINEER FIELD GUIDE", C.WHITE, 500, (30, 20, 60))
    elif sec == "chant":
        scene_chant(d, t, lt)
    else:
        scene_outro(d, t, lt)
    return post(base, t, sec, lt).tobytes()


def main():
    if sys.argv[1] == "--still":
        t = float(sys.argv[2])
        Image.frombytes("RGB", (W, H), render_frame(int(t * FPS))).save(sys.argv[3])
        return
    wav, out = sys.argv[1], sys.argv[2]
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    n = int(DURATION * FPS)
    cmd = [ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-maxrate", "16M", "-bufsize", "32M", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest", out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool() as pool:
        for k, frame in enumerate(pool.imap(render_frame, range(n), chunksize=4)):
            proc.stdin.write(frame)
            if k % 90 == 0:
                print(f"frame {k}/{n}", flush=True)
    proc.stdin.close()
    proc.wait()
    print("wrote", out)


if __name__ == "__main__":
    main()

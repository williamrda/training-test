# Cohesity FortKnox — 30 s motion explainer

A 30.000-second, 1920×1080, 30 fps motion-graphics explainer built in [Remotion](https://remotion.dev).
It uses one continuous 3D world (CSS 3D with real depth) and a single camera that whips between
**9 shots**, with kinetic type that runs per glyph.

The story is told in **6 sections of exactly 5 s**, so each message stays on screen for at least 5 s.
Where a section holds two camera angles, its text builds up and stays for the full section.
Picture and sound are both locked to a **132 BPM** grid, where 11 beats come to exactly 5 s.

## Render it

```bash
npm install
npm run music                          # (re)generates public/music.wav — already committed
pip install edge-tts imageio-ffmpeg numpy scipy
npm run vo                             # builds public/vo.wav from src/vo-cues.json (needs internet)
npm run render                         # -> out/fortknox-explainer.mp4 (H.264 + AAC 48 kHz)
```

* `npm run studio` opens the timeline for scrubbing and tweaks.
* If `public/vo.wav` is missing, the render still works and outputs music only. It prints a warning.
* Other VO sources:
  * `python3 scripts/make_vo.py --engine say` uses offline macOS voices.
  * `python3 scripts/make_vo.py --from-dir takes/` uses your own recordings, named `01.wav` … `09.wav`.

  Each line is trimmed, fitted into its slot (sped up by at most 1.25× if it runs long),
  levelled and placed on its cue.
* To use a specific Chrome, run `REMOTION_BROWSER=/path/to/chrome npm run render`.

## Mix

| Stem | Level | Notes |
|---|---|---|
| VO | ~ -16 dBFS RMS per line, peaks ≤ -1.5 dBFS | `public/vo.wav` |
| Music bed | ~ -24 dBFS RMS in the file (the air-gap breakdown and end card drop ~5 dB), played at 0.5 (≈ -30 dBFS) | `public/music.wav` |
| Ducking | Music drops a further ~5 dB (0.5 → 0.28) while any VO line plays | Driven by the same cue file |

The music therefore sits roughly **12–19 dB below the voice**.

## Section / shot list (132 BPM, 11 beats = 5 s = 150 frames)

| Section | Time | Shots (camera) | On screen (builds, holds 5 s) | VO |
|---|---|---|---|---|
| 1 Threat | 0–5 s | Push in on production towers as a red infection wave hits → whip to the backup stack as it cracks | THREAT DETECTED · **RANSOMWARE** · hits production, then hunts **YOUR BACKUPS** | "Ransomware doesn't stop at production. It hunts your backups, too." |
| 2 FortKnox | 5–10 s | Rise and orbit as the vault panels fly in and assemble | CYBER VAULTING · Cohesity **FortKnox** · an isolated, immutable copy of your backups · managed cloud vault or self-managed on-prem | "Cohesity FortKnox keeps an isolated, immutable copy of your backups." |
| 3 Air gap | 10–15 s | Travel along the bridge: the window opens, data crosses, the bridge retracts and leaves a gap | TRANSFER WINDOW ● OPEN → ● CLOSED · **VIRTUAL AIR GAP** · connected only during the window · isolated the rest of the time | "A virtual air gap opens only for the transfer window, then shuts." |
| 4 Locked down | 15–20 s | Vault door: rings slam on the beat, hex stream, WORM padlock → low angle as two keys turn | TAMPER-PROOF · ✓ IMMUTABLE ✓ ENCRYPTED ✓ WORM-LOCKED ✓ QUORUM (0/2 → 2/2 approvers) | "Inside, data is immutable, encrypted, and locked. Critical actions need two approvers." |
| 5 Clean recovery | 20–25 s | Top-down while a scan plane sweeps the data → wide shot as the door opens and data arcs home | THREAT SCAN 0→100% · **SCANNED CLEAN ✓** · **RECOVERED FAST** · granular · original or alternate location | "Every copy is scanned clean, then recovered fast." |
| 6 End card | 25–30 s | Full-world pull-back and slow orbit, with a halo | **Cohesity FortKnox** · Isolate. Lock. Recover. · managed SaaS or self-managed on-prem · cohesity.com/platform/fortknox | "Cohesity FortKnox. Isolate, lock, and recover with confidence." |

Music follows the sections: tension, then the reveal groove, a breakdown for the air gap, a drop with lock hits, a lift for recovery, and a resolve that fades out.

## Content source

All claims come from Cohesity's official FortKnox pages (product page, datasheet and
solution brief): isolated immutable vault copy, a virtual air gap with a configurable
transfer window, immutability, encryption, WORM locks, quorum (two-person) approvals,
threat scanning before restore, granular recovery to original or alternate locations,
and SaaS or self-managed deployment.

The script follows the accuracy guardrails. It makes no claim that FortKnox "prevents
ransomware" and quotes no recovery-time figures. The FortKnox name is written as used by
Cohesity, but no Cohesity logo artwork is reproduced.

## Files

```
src/timing.ts       beat grid + section/shot boundaries
src/camera.ts       camera keyframes, whip easing, shake, beat pulse
src/world/          3D primitives + the whole world (stations, vault, bridge, keys, scan, recovery)
src/hud/            kinetic typography + HUD chrome
src/vo-cues.json    VO lines + cue times (shared by make_vo.py and music ducking)
scripts/            make_music.py, make_vo.py, render.mjs
```

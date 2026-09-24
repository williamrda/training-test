# Cohesity FortKnox — 15 s motion explainer

A 15.000-second, 1920×1080, 30 fps motion-graphics explainer built in [Remotion](https://remotion.dev).
It uses one continuous 3D world (CSS 3D with real depth), a single camera that whips between
**9 shots**, and kinetic type that runs per glyph. Picture and sound are both locked to a
**132 BPM** grid, where 33 beats come to exactly 15 s.

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
| Music bed | ~ -24 dBFS RMS in the file, played at 0.5 (≈ -30 dBFS) | `public/music.wav` |
| Ducking | Music drops a further ~5 dB (0.5 → 0.28) while any VO line plays | Driven by the same cue file |

The music therefore sits roughly **12–19 dB below the voice**.

## Shot list (132 BPM, beat = 13.64 frames)

| # | Beats | Frames | Camera | On screen | VO |
|---|---|---|---|---|---|
| 1 | 0–4 | 0–55 | Push in low on production towers; red infection wave, shock ring | THREAT DETECTED · **RANSOMWARE** · hits production. | "Ransomware hits production…" |
| 2 | 4–7 | 55–95 | Whip right to the backup stack as it cracks red | then it hunts **YOUR BACKUPS** | "then hunts your backups." |
| 3 | 7–11 | 95–150 | Rise to the vault; its panels fly in and assemble on a spring | CYBER VAULTING · Cohesity **FortKnox** | "Cohesity FortKnox vaults a clean copy" |
| 4 | 11–15 | 150–205 | Along the bridge: the transfer window opens, packets cross, the bridge retracts and leaves a gap | TRANSFER WINDOW ● OPEN → ● CLOSED · **VIRTUAL AIR GAP** | "behind a virtual air gap." |
| 5 | 15–19 | 205–259 | Tight on the vault door; three rings slam on three beats, then the hex stream and the WORM padlock | **IMMUTABLE / ENCRYPTED / WORM-LOCKED** | "Immutable. Encrypted. Locked." |
| 6 | 19–23 | 259–314 | Low angle; two keys slide in and turn one after the other | APPROVALS 0/2 → 2/2 · **QUORUM** | "Two approvers to touch it." |
| 7 | 23–26 | 314–355 | Top-down orbit; a scan plane sweeps the vaulted data | THREAT SCAN 0→100% · **SCANNED CLEAN ✓** | "Scanned clean," |
| 8 | 26–29 | 355–395 | Wide tracking shot; the door swings open, data arcs back and the world turns teal | **RECOVERED FAST** · granular · original or alternate location | "recovered fast." |
| 9 | 29–33 | 395–450 | Full-world pull-back with a halo | **Cohesity FortKnox** · Isolate. Lock. Recover. · managed SaaS or self-managed on-prem | "Cohesity FortKnox." |

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
src/timing.ts       beat grid + shot boundaries
src/camera.ts       camera keyframes, whip easing, shake, beat pulse
src/world/          3D primitives + the whole world (stations, vault, bridge, keys, scan, recovery)
src/hud/            kinetic typography + HUD chrome
src/vo-cues.json    VO lines + cue times (shared by make_vo.py and music ducking)
scripts/            make_music.py, make_vo.py, render.mjs
```

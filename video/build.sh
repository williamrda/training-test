#!/usr/bin/env bash
# Rebuild the 30 s promo from scratch: synthesize audio, render frames, mux.
set -euo pipefail
cd "$(dirname "$0")"
pip install -q numpy pillow scipy imageio-ffmpeg
mkdir -p out
python3 audio.py out/soundtrack.wav
python3 render.py out/soundtrack.wav out/ai_engineer_field_guide.mp4

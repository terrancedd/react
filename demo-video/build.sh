#!/usr/bin/env bash
# One-command rebuild: narration (Piper, offline) + music + mix, then captions, script and video.
#   ./build.sh                 full 30 fps render with audio -> out/software-factory-demo.mp4
#   ./build.sh --fps 2 --out out/draft.mp4   (extra args go to render.mjs)
set -euo pipefail
cd "$(dirname "$0")"
python3 build-audio.py
node build-text.mjs
node render.mjs --audio out/audio/mix.wav "$@"

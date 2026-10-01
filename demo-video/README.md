# Software factory prototype: demo video

A ~5.4 minute (1920x1080, 30 fps) walkthrough of the "Software factory prototype plan" (Oct 2026).
None of the plan's 19 actions has started, so the video is a **simulated** walkthrough: every Jira,
terminal and GitHub screen is a stylized look-alike panel with generic styling, and a corner tag
reading "Prototype concept · simulated" stays on screen throughout. No real product logos are used.

**Audio: captions only.** The narration is not voiced. Speech synthesis was blocked by the network
egress policy in the build environment, so the narration is rendered as an on-screen caption bar and
also written to a sidecar `.srt` file. `render.mjs --audio <file>` will mux a narration track if one
is added later. The caption timings would then need re-checking against that track.

## Re-render

Requirements: Node 22+, the `playwright` package with Chromium (resolved locally or from
`npm root -g`), `ffmpeg` with libx264, and `curl`.

```bash
cd demo-video
node build-text.mjs                      # regenerate script.md and out/software-factory-demo.srt
node render.mjs --stills 30,150,210 --stills-dir frames   # PNG stills for a quick look
node render.mjs --fps 2 --out out/draft.mp4                # fast low-fps draft (~30 s)
node render.mjs                                            # full render -> out/software-factory-demo.mp4 (~7 min on 4 CPUs)
```

On the first run `render.mjs` downloads Inter and JetBrains Mono into `src/fonts/` (gitignored).
If that fails, the page falls back to local sans and mono fonts.

Useful flags: `--fps`, `--from`/`--to` (seconds), `--workers` (parallel browser pages, default 3),
`--out`, `--audio`, `--tmp`.

To preview in a browser, serve `src/` and open `index.html?t=150` for one frame, or `index.html?play`
for real-time playback.

## Structure

| File | Purpose |
| --- | --- |
| `src/timeline.js` | Single source of truth: the narration text for each beat, beat durations (reading pace plus a per-beat minimum) and caption cues. Used by both the page and the Node scripts. |
| `src/scenes.js` | Builds all scenes and exposes `window.seek(t)`, which sets every element's style as a pure function of `t`. Elements declare timing with `data-in` / `data-out` (for example `ticket#4:0.5` means 0.5 s after caption cue 4 of the `ticket` beat), so the visuals stay in sync with the captions. Also holds the terminal script, the 14-check checklist and the PR states. |
| `src/styles.css` | Dark theme, one accent colour. |
| `src/index.html` | Page shell: scenes container, corner tag, caption bar, progress bar. |
| `render.mjs` | Playwright frame capture (`seek(t)` then a screenshot per frame), piped as JPEG into ffmpeg in parallel segments, then concatenated losslessly with `+faststart`. Writes the SRT next to the MP4. |
| `build-text.mjs` | Generates `script.md` and the SRT from `src/timeline.js`. |
| `script.md` | The narration script with timings (generated; edit `src/timeline.js` instead). |

Nothing depends on wall-clock time, so any frame can be re-rendered on its own and renders are
deterministic.

## Scenes

1. Cold open
2. What the industry does: the six systems, the shared shape, three practices taken from OpenAI's factory
3. Constraints found
4. One ticket end to end (DEMO-42): Jira ticket and trigger rule, Ona environment, the headless agent
   step with a repair round, two review passes, `open-draft-pr.sh`, the 14 hygiene checks, mark-ready,
   approval ("Approved. Not merged. Not deployed.")
5. What makes it trustworthy: fail closed, self-repair loop, prompt-injection test, scorecard and cost caps
6. Risks and controls, the roadmap (five phases, 19 actions) and the three key decisions, then the end card

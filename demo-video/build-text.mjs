// Generates script.md (narration script with timings) and out/software-factory-demo.srt
// from src/timeline.js, so captions, script and video timings never drift apart.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const T = require('./src/timeline.js');

const SCENE_TITLES = {
  cold: '1. Cold open',
  industry: '2. What the industry does',
  constraints: '3. Constraints',
  run: '4. The end-to-end run (DEMO-42)',
  safe: '5. What makes it trustworthy',
  roadmap: '6. Controls and roadmap',
  end: '6. End card',
};

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(sec)},${p(r, 3)}`;
};

export function buildSrt() {
  return T.CUES.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.lines.join('\n')}\n`).join('\n');
}

export function buildScript() {
  const words = T.BEATS.reduce((n, b) => n + b.words, 0);
  let md = '# Software factory prototype: demo narration\n\n';
  md += 'Simulated walkthrough of the "Software factory prototype plan" (Oct 2026). None of the plan\'s 19 actions has started, ';
  md += 'so every screen in the video is a stylized mock-up, tagged "Prototype concept · simulated".\n\n';
  md += `Total: ${words} words, ${mmss(T.DURATION)} (${T.DURATION.toFixed(1)} s). `;
  md += T.VOICED
    ? 'Beat length = measured voiceover length (one Piper clip per sentence, see build-audio.py) + 1.25 s padding, with a per-beat minimum for the visuals.\n\n'
    : `Beat length = words / ${T.WORDS_PER_SEC} words per second + padding, with a per-beat minimum for the visuals.\n\n`;
  md += 'This file is generated from `src/timeline.js` by `node build-text.mjs`; edit the narration there.\n\n';
  let scene = null;
  for (const b of T.BEATS) {
    if (b.scene !== scene) {
      scene = b.scene;
      md += `## ${SCENE_TITLES[scene]}\n\n`;
    }
    md += `**${b.id}** · ${mmss(b.start)}–${mmss(b.end)} · ${b.words} words\n\n${b.text}\n\n`;
  }
  return md;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const srtPath = join(here, 'out', 'software-factory-demo.srt');
  mkdirSync(dirname(srtPath), { recursive: true });
  writeFileSync(srtPath, buildSrt());
  writeFileSync(join(here, 'script.md'), buildScript());
  console.log(`wrote ${srtPath} (${T.CUES.length} cues) and script.md; duration ${T.DURATION}s`);
}

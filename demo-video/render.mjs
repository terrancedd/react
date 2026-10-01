// Renders src/index.html frame by frame with Playwright and encodes an MP4 with ffmpeg.
//
//   node render.mjs                         full render, 30 fps -> out/software-factory-demo.mp4
//   node render.mjs --fps 2 --out out/draft.mp4
//   node render.mjs --stills 5,40,120 --stills-dir /tmp/stills    PNG stills at given seconds
//   node render.mjs --workers 3 --from 100 --to 130
//
// Every frame is produced by calling window.seek(t) and taking a screenshot, so output is
// deterministic and independent of real time.
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { buildSrt } from './build-text.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadPlaywright() {
  try { return require('playwright'); } catch {
    const g = execSync('npm root -g').toString().trim();
    return require(join(g, 'playwright'));
  }
}
const { chromium } = loadPlaywright();
const TL = require('./src/timeline.js');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const FPS = parseFloat(opt('fps', '30'));
const FROM = parseFloat(opt('from', '0'));
const TO = parseFloat(opt('to', String(TL.DURATION)));
const WORKERS = parseInt(opt('workers', '3'), 10);
const OUT = resolve(opt('out', join(here, 'out', 'software-factory-demo.mp4')));
const STILLS = opt('stills', null);
const STILLS_DIR = resolve(opt('stills-dir', join(here, 'frames')));
const AUDIO = opt('audio', null); // optional narration track to mux (aac)
const QUALITY = parseInt(opt('jpeg-quality', '94'), 10);
const TMP = resolve(opt('tmp', join(process.env.TMPDIR || tmpdir(), 'sf-demo-render')));

const pageUrl = pathToFileURL(join(here, 'src', 'index.html')).href;

// Download Inter + JetBrains Mono once into src/fonts/ (gitignored) with curl, which trusts the
// system CA configuration. The page falls back to local sans/mono fonts if this fails.
function ensureFonts() {
  const dir = join(here, 'src', 'fonts');
  const cssPath = join(dir, 'fonts.css');
  if (existsSync(cssPath)) return true;
  try {
    mkdirSync(dir, { recursive: true });
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
    const url = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=block';
    let css = execSync(`curl -sSfL -A "${ua}" "${url}"`).toString();
    const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])];
    urls.forEach((u, i) => {
      const name = `f${i}.woff2`;
      execSync(`curl -sSfL -o "${join(dir, name)}" "${u}"`);
      css = css.split(u).join(name);
    });
    writeFileSync(cssPath, css);
    console.log(`fonts: downloaded ${urls.length} files to src/fonts/`);
    return true;
  } catch (e) {
    console.warn('fonts: download failed, using local fallback fonts:', e.message);
    return false;
  }
}

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(pageUrl, { waitUntil: 'load' });
  // Warm-up: visit the whole timeline once so every font subset used anywhere is loaded
  // before the first captured frame (fonts load lazily per glyph range).
  await page.evaluate(async () => {
    for (let t = 0; t <= window.DURATION; t += 0.5) { window.seek(t); document.body.offsetHeight; }
    await document.fonts.ready;
    window.seek(0);
  });
  const fonts = await page.evaluate(() => [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))]);
  return { page, fonts };
}

function run(cmd, argv) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
  });
}

async function renderSegment(browser, idx, f0, f1, segPath) {
  const { page } = await newPage(browser);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), segPath], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg segment failed ' + c)))));
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: QUALITY });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 300 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`[w${idx}] frame ${f - f0}/${f1 - f0} (${el.toFixed(0)}s)`);
    }
  }
  ff.stdin.end();
  await done;
  await page.close();
}

async function main() {
  ensureFonts();
  const browser = await chromium.launch({
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
    args: ['--font-render-hinting=none', '--disable-lcd-text'],
  });
  try {
    if (STILLS) {
      mkdirSync(STILLS_DIR, { recursive: true });
      const { page, fonts } = await newPage(browser);
      console.log('fonts loaded (Inter, JetBrains Mono):', fonts);
      for (const s of STILLS.split(',').map(Number)) {
        await page.evaluate((t) => window.seek(t), s);
        const p = join(STILLS_DIR, `still_${String(s.toFixed(1)).padStart(6, '0')}.png`);
        await page.screenshot({ path: p });
        console.log('wrote', p);
      }
      return;
    }

    const f0 = Math.round(FROM * FPS);
    const f1 = Math.round(TO * FPS);
    const n = f1 - f0;
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
    mkdirSync(dirname(OUT), { recursive: true });
    const { fonts } = await newPage(browser);
    console.log(`rendering ${n} frames at ${FPS} fps with ${WORKERS} workers; fonts loaded:`, fonts);
    const per = Math.ceil(n / WORKERS);
    const segs = [];
    const jobs = [];
    for (let w = 0; w < WORKERS; w++) {
      const a = f0 + w * per;
      const b = Math.min(f1, a + per);
      if (a >= b) break;
      const seg = join(TMP, `seg_${w}.mp4`);
      segs.push(seg);
      jobs.push(renderSegment(browser, w, a, b, seg));
    }
    const t0 = Date.now();
    await Promise.all(jobs);
    console.log(`frames done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

    const list = join(TMP, 'list.txt');
    writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
    const argv = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
    if (AUDIO && existsSync(AUDIO)) argv.push('-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k', '-shortest');
    argv.push('-c:v', 'copy', '-movflags', '+faststart', OUT);
    await run('ffmpeg', argv);
    const srt = OUT.replace(/\.mp4$/, '.srt');
    writeFileSync(srt, buildSrt());
    console.log('wrote', OUT, 'and', srt);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

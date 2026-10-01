#!/usr/bin/env python3
"""Generate a soft ambient music bed, royalty-free by construction (pure synthesis).

    python3 make-music.py --duration 300 --out out/audio/music.wav

Slow evolving minor-key pad chords (sine plus a few soft partials, slow attack and release),
a gently low-pass filtered noise texture and a very quiet low pulse at 70 bpm. No melody,
so nothing competes with the narration. Fades in over 2 s and out over the last 4 s.
"""
import argparse
import subprocess
import numpy as np

SR = 48000


def midi_hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# A minor progression, i - VI - III - VII (Am, F, C, G), voiced low and close.
CHORDS = [
    [45, 52, 57, 60, 64],  # A2 E3 A3 C4 E4
    [41, 48, 53, 57, 60],  # F2 C3 F3 A3 C4
    [48, 52, 55, 60, 64],  # C3 E3 G3 C4 E4
    [43, 50, 55, 59, 62],  # G2 D3 G3 B3 D4
]
CHORD_SEC = 8.0


def lowpass(x, cutoff):
    """Smooth FFT low-pass (2nd-order-like roll-off above cutoff)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1.0 / (1.0 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def pad(duration, rng):
    n = int(duration * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    n_chords = int(np.ceil(duration / CHORD_SEC)) + 1
    for k in range(n_chords):
        notes = CHORDS[k % len(CHORDS)]
        t0 = k * CHORD_SEC - 2.0  # overlap neighbouring chords for smooth changes
        t1 = t0 + CHORD_SEC + 4.0
        i0, i1 = max(0, int(t0 * SR)), min(n, int(t1 * SR))
        if i0 >= i1:
            continue
        tt = t[i0:i1] - t0
        L = t1 - t0
        env = np.clip(tt / 3.0, 0, 1) * np.clip((L - tt) / 3.0, 0, 1)
        env = env ** 1.5
        seg = np.zeros(i1 - i0)
        for m, note in enumerate(notes):
            f = midi_hz(note)
            for det in (-0.0018, 0.0018):  # gentle chorus
                ph = rng.uniform(0, 2 * np.pi)
                ff = f * (1 + det)
                seg += np.sin(2 * np.pi * ff * tt + ph)
                seg += 0.18 * np.sin(2 * np.pi * 2 * ff * tt + ph)  # soft 2nd partial
                seg += 0.05 * np.sin(2 * np.pi * 3 * ff * tt + ph)
            # slow per-note shimmer
        lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.05 * tt + k)
        out[i0:i1] += seg * env * lfo / (len(notes) * 2)
    return out


def noise_texture(duration, rng):
    n = int(duration * SR)
    x = rng.standard_normal(n)
    x = lowpass(x, 600.0)
    t = np.arange(n) / SR
    swell = 0.6 + 0.4 * np.sin(2 * np.pi * t / 23.0)
    return x * swell


def pulse(duration):
    n = int(duration * SR)
    out = np.zeros(n)
    beat = 60.0 / 70.0
    m = int(0.35 * SR)
    tt = np.arange(m) / SR
    thump = np.sin(2 * np.pi * 55 * tt) * np.exp(-tt / 0.09)
    k = 0
    while k * beat < duration:
        i = int(k * beat * SR)
        j = min(n, i + m)
        out[i:j] += thump[: j - i] * (1.0 if k % 4 == 0 else 0.6)
        k += 1
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--duration', type=float, required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--seed', type=int, default=7)
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)
    d = args.duration
    x = pad(d, rng)
    x = x / (np.max(np.abs(x)) + 1e-9)
    nz = noise_texture(d, rng)
    nz = nz / (np.max(np.abs(nz)) + 1e-9)
    pl = pulse(d)
    mix = 0.8 * x + 0.10 * nz + 0.06 * pl
    n = len(mix)
    t = np.arange(n) / SR
    fade = np.clip(t / 2.0, 0, 1) * np.clip((d - t) / 4.0, 0, 1)
    mix = mix * fade
    mix = 0.5 * mix / (np.max(np.abs(mix)) + 1e-9)
    stereo = np.stack([mix, np.roll(mix, int(0.012 * SR))], axis=1).astype(np.float32)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                    '-c:a', 'pcm_s16le', args.out], input=stereo.tobytes(), check=True)
    print(f'music: wrote {args.out} ({d:.1f} s)')


if __name__ == '__main__':
    main()

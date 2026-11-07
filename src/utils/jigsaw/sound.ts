/** Synthesised sound effects. No files; silent wherever Web Audio is unavailable. */
import { readMuted } from "./storage";

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!context) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  { freq, start, length, peak, endFreq }: { freq: number; start: number; length: number; peak: number; endFreq?: number },
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/** A wood-click: a short high-passed noise burst plus a low sine. Pitch rises with progress. */
export function playSnap(progress: number): void {
  if (readMuted()) return;
  const ctx = audio();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const lift = 1 + Math.min(1, Math.max(0, progress)) * 0.25;

    const length = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1800 * lift;
    const gain = ctx.createGain();
    gain.gain.value = 0.18;
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);

    tone(ctx, { freq: 220 * lift, endFreq: 150 * lift, start: now, length: 0.09, peak: 0.16 });
  } catch {
    // Audio is a nicety; never break play.
  }
}

/** Three soft rising notes with a long decay. */
export function playFinish(): void {
  if (readMuted()) return;
  const ctx = audio();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      tone(ctx, { freq, start: now + i * 0.14, length: 1.1, peak: 0.1 });
    });
  } catch {
    // Audio is a nicety; never break play.
  }
}

/** Vibrates where supported. iOS Safari has no vibrate API, so this is a no-op there. */
export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // Unsupported or blocked.
  }
}

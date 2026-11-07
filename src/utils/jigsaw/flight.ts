export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Plays a Web Animation and waits for it. Never throws, so callers need no cleanup. */
async function play(el: HTMLElement, frames: Keyframe[], duration: number, easing: string): Promise<void> {
  if (duration <= 0 || prefersReducedMotion() || typeof el.animate !== "function") return;
  const animation = el.animate(frames, { duration, easing });
  try {
    await animation.finished;
  } catch {
    // Cancelled because the element was removed; nothing left to wait for.
  }
}

/** Slides an element between two transforms. It keeps the final one afterwards. */
export async function slideElement(
  el: HTMLElement,
  from: string,
  to: string,
  ms: number,
): Promise<void> {
  el.style.transform = to;
  if (from === to) return;
  await play(el, [{ transform: from }, { transform: to }], ms, "cubic-bezier(0.22, 1, 0.36, 1)");
}

/** A tiny side to side shake around a transform, for a pair that doesn't connect. */
export async function shakeElement(el: HTMLElement, base: (dx: number) => string): Promise<void> {
  await play(el, [0, -6, 5, -3, 2, 0].map((dx) => ({ transform: base(dx) })), 260, "ease-out");
}

/**
 * Timing for the launch splash animation, taken from the motion design.
 *
 * The sequence is: a curtain wiping upward to uncover the grey logomark, a
 * short hold on that grey mark, the logomark and wordmark changing colour
 * together, and a final beat on the finished lockup before it fades away.
 *
 * `revealDurationMs` is the figure given in the Figma keyframes; the other
 * durations come from the motion screen recording, whose wipe runs about 2.5x
 * faster than the Figma file's. The two sources disagree on pace, so changing
 * one of these may mean scaling the others with it.
 */
export const SPLASH_TIMELINE = {
  revealDelayMs: 0,
  revealDurationMs: 800,
  holdMs: 350,
  recolorDurationMs: 550,
  finalHoldMs: 500,
} as const;

export const SPLASH_TOTAL_MS =
  SPLASH_TIMELINE.revealDelayMs +
  SPLASH_TIMELINE.revealDurationMs +
  SPLASH_TIMELINE.holdMs +
  SPLASH_TIMELINE.recolorDurationMs +
  SPLASH_TIMELINE.finalHoldMs;

/**
 * How long the whole splash takes to fade away once it has played out and the
 * app is ready. Deliberately not part of SPLASH_TOTAL_MS: that measures time to
 * the final frame, and the fade starts after it.
 */
export const SPLASH_EXIT_MS = 500;

export interface SplashProgress {
  /** 0 = logomark fully hidden by the curtain, 1 = fully uncovered. */
  reveal: number;
  /** 0 = grey logomark / invisible wordmark, 1 = final blue + black lockup. */
  recolor: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Maps elapsed time onto the two animation tracks. Returns linear progress —
 * easing is applied by the animation layer, so this stays trivially testable.
 */
export const getSplashProgress = (elapsedMs: number): SplashProgress => {
  const { revealDelayMs, revealDurationMs, holdMs, recolorDurationMs } =
    SPLASH_TIMELINE;

  const reveal = clamp01((elapsedMs - revealDelayMs) / revealDurationMs);

  const recolorStart = revealDelayMs + revealDurationMs + holdMs;
  const recolor = clamp01((elapsedMs - recolorStart) / recolorDurationMs);

  return { reveal, recolor };
};

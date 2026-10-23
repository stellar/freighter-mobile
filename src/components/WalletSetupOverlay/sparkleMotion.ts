/**
 * The wallet setup screen's sparkle: Figma's keyframe loop for "Group 19"
 * (Creating a wallet, ?node-id=760-37088; Importing wallet,
 * ?node-id=2091-42643), a 1.5s loop in which the sparkle hops in from 6pt
 * left of center, three bounces that shrink, squashing on each landing.
 *
 * Everything here runs on the UI thread too, so the functions are worklets.
 */

/** One loop of the sparkle's animation, as Figma times it. */
export const SPARKLE_LOOP_MS = 1500;

/** Translations are in Figma points, before `pxValue`. */
export interface SparklePose {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
}

/** Where the sparkle settles: at the center, at its own size. */
export const SPARKLE_REST_POSE: SparklePose = {
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
};

type Curve = "linear" | "in" | "out" | "inOut";

/** CSS's named curves, as cubic Béziers. */
const CURVES: Record<Exclude<Curve, "linear">, readonly number[]> = {
  in: [0.42, 0, 1, 1],
  out: [0, 0, 0.58, 1],
  inOut: [0.42, 0, 0.58, 1],
};

/** [offset, a, b, curve into the next keyframe] */
type Keyframe = readonly [number, number, number, Curve];

/**
 * Figma bakes the hops' arcs into dense keyframes, joined by straight lines.
 * Figma's loop ends at the center and starts 6pt left, so as drawn it jumps
 * back every 1.5s. Instead the sparkle stays at rest until 80%, then eases
 * back to its start, so the loop has no seam.
 */
const TRANSLATE: readonly Keyframe[] = [
  [0, -6, 0, "linear"],
  [0.06667, -5.512, -3.711, "linear"],
  [0.12, -4.715, -5, "linear"],
  [0.13333, -4.475, -4.896, "linear"],
  [0.2, -3.254, -2.442, "linear"],
  [0.24, -2.61, 0, "linear"],
  [0.26667, -2.236, -1.134, "linear"],
  [0.33333, -1.481, -2.922, "linear"],
  [0.34667, -1.357, -3, "linear"],
  [0.4, -0.936, -2.054, "linear"],
  [0.45333, -0.617, 0, "linear"],
  [0.46667, -0.551, -0.391, "linear"],
  [0.53333, -0.287, -1.5, "linear"],
  [0.6, -0.119, -0.639, "linear"],
  [0.62667, -0.074, 0, "linear"],
  [0.66667, -0.028, 0, "linear"],
  [0.73333, 0, 0, "linear"],
  [0.8, 0, 0, "inOut"],
  [1, -6, 0, "linear"],
];

/** Squash and stretch: [offset, scaleX, scaleY, curve into the next]. */
const SCALE: readonly Keyframe[] = [
  [0, 1, 1, "out"],
  [0.06, 0.96, 1.04, "inOut"],
  [0.12, 1, 1, "in"],
  [0.21333, 0.97, 1.03, "out"],
  [0.24, 1.06, 0.94, "out"],
  [0.29333, 0.97, 1.03, "inOut"],
  [0.34667, 1, 1, "in"],
  [0.42667, 0.98, 1.02, "out"],
  [0.45333, 1.04, 0.96, "out"],
  [0.49333, 0.98, 1.02, "inOut"],
  [0.53333, 1, 1, "out"],
  [0.62667, 1.02, 0.98, "inOut"],
  [0.72, 1, 1, "linear"],
  [1, 1, 1, "linear"],
];

/**
 * A CSS cubic-bezier(x1, y1, x2, y2) at `x`: Newton's method to find the
 * curve's t for x, with bisection as the fallback, then y at that t.
 */
const bezierAt = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
): number => {
  "worklet";

  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  let t = x;
  for (let i = 0; i < 8; i += 1) {
    const error = sampleX(t) - x;
    if (Math.abs(error) < 1e-7) return sampleY(t);
    const slope = slopeX(t);
    if (Math.abs(slope) < 1e-6) break;
    t -= error / slope;
  }

  let low = 0;
  let high = 1;
  t = x;
  while (high - low > 1e-7) {
    const sample = sampleX(t);
    if (Math.abs(sample - x) < 1e-7) break;
    if (sample < x) {
      low = t;
    } else {
      high = t;
    }
    t = (low + high) / 2;
  }

  return sampleY(t);
};

/** A CSS cubic-bezier timing function. */
export const cubicBezier =
  (x1: number, y1: number, x2: number, y2: number) =>
  (x: number): number => {
    "worklet";

    return bezierAt(x1, y1, x2, y2, x);
  };

const ease = (curve: Curve, fraction: number): number => {
  "worklet";

  if (curve === "linear") return fraction;
  const [x1, y1, x2, y2] = CURVES[curve];
  return bezierAt(x1, y1, x2, y2, fraction);
};

/** Both values of a keyframe track at `progress`. */
const sample = (
  keyframes: readonly Keyframe[],
  progress: number,
): [number, number] => {
  "worklet";

  for (let i = 0; i < keyframes.length - 1; i += 1) {
    const [start, a1, b1, curve] = keyframes[i];
    const [end, a2, b2] = keyframes[i + 1];
    if (progress <= end) {
      const fraction = ease(curve, (progress - start) / (end - start));
      return [a1 + (a2 - a1) * fraction, b1 + (b2 - b1) * fraction];
    }
  }

  const [, a, b] = keyframes[keyframes.length - 1];
  return [a, b];
};

/** The sparkle's pose at `progress` through a loop, from 0 to 1. */
export const sparklePoseAt = (progress: number): SparklePose => {
  "worklet";

  const clamped = Math.min(Math.max(progress, 0), 1);
  const [translateX, translateY] = sample(TRANSLATE, clamped);
  const [scaleX, scaleY] = sample(SCALE, clamped);

  return { translateX, translateY, scaleX, scaleY };
};

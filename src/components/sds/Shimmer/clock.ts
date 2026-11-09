import { useEffect } from "react";
import {
  cancelAnimation,
  Easing,
  makeMutable,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/** From the Figma prototype: a 1.6 s linear sweep, a 0.3 s hold, looped. */
export const SHIMMER_SWEEP_MS = 1600;
export const SHIMMER_HOLD_MS = 300;
export const SHIMMER_CYCLE_MS = SHIMMER_SWEEP_MS + SHIMMER_HOLD_MS;

/**
 * One clock for every shimmer on screen, so placeholders that mount at
 * different moments still sweep together, as the design frame does. 0 → 1
 * over the sweep, held at 1 through the hold, then restarts.
 */
export const shimmerProgress = makeMutable(0);

let consumers = 0;
let running = false;

const start = () => {
  shimmerProgress.value = 0;
  // Snap back first: a repeated sequence resumes from the current value, and 1 → 1 is no sweep.
  shimmerProgress.value = withRepeat(
    withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: SHIMMER_SWEEP_MS, easing: Easing.linear }),
      withDelay(SHIMMER_HOLD_MS, withTiming(1, { duration: 0 })),
    ),
    -1,
    false,
  );
  running = true;
};

const stop = () => {
  cancelAnimation(shimmerProgress);
  shimmerProgress.value = 0;
  running = false;
};

/**
 * Registers a consumer for as long as `enabled` is true. The first consumer
 * starts the loop, the last one stops it; a disabled consumer (reduced
 * motion) registers nothing, so a screen of static pills runs no animation.
 */
export const useShimmerClock = (enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    consumers += 1;
    if (consumers === 1) {
      start();
    }
    return () => {
      consumers -= 1;
      if (consumers === 0) {
        stop();
      }
    };
  }, [enabled]);
};

/** Test observability only; nothing in the app reads this. */
export const getShimmerClockState = () => ({ consumers, running });

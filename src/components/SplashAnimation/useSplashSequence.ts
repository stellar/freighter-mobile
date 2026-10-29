import { SPLASH_TOTAL_MS } from "components/SplashAnimation/splashTimeline";
import { useEffect, useRef, useState } from "react";

interface UseSplashSequenceParams {
  /** True once the app has finished initialising and can be revealed. */
  ready: boolean;
  /** Called exactly once, when the splash should be torn down. */
  onFinished: () => void;
}

/**
 * Owns when the animated splash gives way to the app.
 *
 * The animation always plays in full on a cold start — it is never cut short —
 * so the hand-off waits on both the timeline and the app being ready. A slow
 * start simply rests on the final frame until initialisation catches up.
 */
export const useSplashSequence = ({
  ready,
  onFinished,
}: UseSplashSequenceParams): void => {
  const [animationComplete, setAnimationComplete] = useState(false);
  const hasFinished = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationComplete(true);
    }, SPLASH_TOTAL_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!ready || !animationComplete || hasFinished.current) {
      return;
    }

    hasFinished.current = true;
    onFinished();
  }, [ready, animationComplete, onFinished]);
};

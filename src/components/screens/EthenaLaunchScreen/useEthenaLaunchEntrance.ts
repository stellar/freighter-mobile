import { pxValue } from "helpers/dimensions";
import { useEffect, useRef } from "react";
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

// The promo's one-second entrance: the wave slides in from the left and the
// coins rise while both fade in, then the intro and the scroll cue fade in.
const MOVE = Easing.bezier(0.22, 1, 0.36, 1);
const FADE = Easing.bezier(0.16, 1, 0.3, 1);
const ART_DURATION = 800;
const INTRO = { delay: 200, duration: 500 };
const CUE = { delay: 400, duration: 500 };
const WAVE_SHIFT = pxValue(20);
const COINS_RISE = pxValue(40);

/**
 * Animated styles for the promo's entrance. Every part holds its start frame
 * until `isPlaying` turns true, then the timeline plays once. Under the
 * system's Reduce Motion setting every part starts at its end frame.
 */
export const useEthenaLaunchEntrance = (isPlaying: boolean) => {
  const isReduceMotionEnabled = useReducedMotion();
  const initial = isReduceMotionEnabled ? 1 : 0;
  const artMove = useSharedValue(initial);
  const artFade = useSharedValue(initial);
  const introFade = useSharedValue(initial);
  const cueFade = useSharedValue(initial);
  const hasPlayed = useRef(isReduceMotionEnabled);

  useEffect(() => {
    if (!isPlaying || hasPlayed.current) {
      return;
    }
    hasPlayed.current = true;

    artMove.value = withTiming(1, { duration: ART_DURATION, easing: MOVE });
    artFade.value = withTiming(1, { duration: ART_DURATION, easing: FADE });
    introFade.value = withDelay(
      INTRO.delay,
      withTiming(1, { duration: INTRO.duration, easing: FADE }),
    );
    cueFade.value = withDelay(
      CUE.delay,
      withTiming(1, { duration: CUE.duration, easing: FADE }),
    );
  }, [isPlaying, artMove, artFade, introFade, cueFade]);

  const waveStyle = useAnimatedStyle(() => ({
    opacity: artFade.value,
    transform: [{ translateX: WAVE_SHIFT * (artMove.value - 1) }],
  }));
  const coinsStyle = useAnimatedStyle(() => ({
    opacity: artFade.value,
    transform: [{ translateY: COINS_RISE * (1 - artMove.value) }],
  }));
  const introStyle = useAnimatedStyle(() => ({ opacity: introFade.value }));
  const cueStyle = useAnimatedStyle(() => ({ opacity: cueFade.value }));

  return { waveStyle, coinsStyle, introStyle, cueStyle };
};

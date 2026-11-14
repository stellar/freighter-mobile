import { ETHENA_LAUNCH_FADE_MS } from "components/screens/EthenaLaunchScreen/ethenaLaunchConfig";
import { pxValue } from "helpers/dimensions";
import { useLayoutEffect, useRef } from "react";
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
 * Animated styles for the promo's entrance. The timeline is handed to the UI
 * thread as the promo mounts and starts as its fade-in ends, so a busy JS
 * thread (Home loading right after an unlock) can't hold it back. Under the
 * system's Reduce Motion setting every part starts at its end frame.
 */
export const useEthenaLaunchEntrance = () => {
  const isReduceMotionEnabled = useReducedMotion();
  const initial = isReduceMotionEnabled ? 1 : 0;
  const artMove = useSharedValue(initial);
  const artFade = useSharedValue(initial);
  const introFade = useSharedValue(initial);
  const cueFade = useSharedValue(initial);
  const hasPlayed = useRef(isReduceMotionEnabled);

  // A layout effect runs as the promo commits, before any JS work queued
  // behind it.
  useLayoutEffect(() => {
    if (hasPlayed.current) {
      return;
    }
    hasPlayed.current = true;

    const after = (delay: number, duration: number, easing: typeof MOVE) =>
      withDelay(
        ETHENA_LAUNCH_FADE_MS + delay,
        withTiming(1, { duration, easing }),
      );

    artMove.value = after(0, ART_DURATION, MOVE);
    artFade.value = after(0, ART_DURATION, FADE);
    introFade.value = after(INTRO.delay, INTRO.duration, FADE);
    cueFade.value = after(CUE.delay, CUE.duration, FADE);
  }, [artMove, artFade, introFade, cueFade]);

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

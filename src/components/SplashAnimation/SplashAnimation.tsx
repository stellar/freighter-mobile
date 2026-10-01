import VarialLogomark from "assets/logos/varial-logo.svg";
import VarialWordmark from "assets/logos/varial-wordmark.svg";
import {
  SPLASH_EXIT_MS,
  SPLASH_TIMELINE,
} from "components/SplashAnimation/splashTimeline";
import { useSplashSequence } from "components/SplashAnimation/useSplashSequence";
import useTheme from "hooks/useTheme";
import React, { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

const LOGOMARK = { width: 100, height: 100 };
const WORDMARK = { width: 128, height: 41 };
const GAP = 10;

/**
 * The curtain that covers the lockup and wipes upward to uncover it.
 *
 * Its bottom edge (`top + height`) and `travel` are what set the pace of the
 * reveal; the design puts them at 165 and 195. It is taller than that alone
 * requires, and starts higher, because the gradient fades over the curtain's
 * top 18%: that soft edge has to sit clear of the lockup, or the logomark
 * shows faintly through it before the wipe begins.
 */
const CURTAIN = { width: 130, height: 215, left: -1, top: -50, travel: 195 };

/** The prototype centres the lockup 20px above the screen's centre. */
const LOCKUP_OFFSET_Y = -20;

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  lockup: {
    width: WORDMARK.width,
    height: LOGOMARK.height + GAP + WORDMARK.height,
    alignItems: "center",
    overflow: "hidden",
    transform: [{ translateY: LOCKUP_OFFSET_Y }],
  },
  wordmark: {
    marginTop: GAP,
  },
  curtain: {
    position: "absolute",
    left: CURTAIN.left,
    top: CURTAIN.top,
  },
});

const AnimatedLogomark = Animated.createAnimatedComponent(VarialLogomark);
const AnimatedWordmark = Animated.createAnimatedComponent(VarialWordmark);

interface SplashAnimationProps {
  /** True once the app has initialised and can be revealed. */
  ready: boolean;
  /** Called once when the splash should be removed. */
  onFinished: () => void;
}

/**
 * The launch splash.
 *
 * Wipes a curtain upward to uncover a muted logomark, then settles the
 * logomark and wordmark into their final colours together.
 *
 * Every colour is a theme token rather than a literal, so the whole sequence
 * follows the device scheme. The design's colours are themselves palette
 * values — its grey is gray 09, its blue lilac 09 — so tokens reproduce the
 * specified animation exactly and give the dark scheme for free. The page
 * colour is `base.primary`, the same token the native `bootsplash_background`
 * and `app_background` track, so the hand-off from the native splash lands on
 * an identical background in either scheme.
 */
export const SplashAnimation: React.FC<SplashAnimationProps> = ({
  ready,
  onFinished,
}) => {
  const theme = useTheme();
  const pageColor = theme.colors.base.primary;
  const mutedColor = theme.colors.foreground.primary;
  const brandColor = theme.colors.primary;
  const wordmarkColor = theme.colors.text.primary;

  const reveal = useSharedValue(0);
  const recolor = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Fade the splash away rather than cutting, so the app beneath is revealed
  // smoothly. `onFinished` unmounts us, so it must wait for the fade to end.
  const beginExit = useCallback(() => {
    opacity.value = withTiming(
      0,
      { duration: SPLASH_EXIT_MS, easing: Easing.out(Easing.ease) },
      (completed) => {
        if (completed) {
          runOnJS(onFinished)();
        }
      },
    );
  }, [opacity, onFinished]);

  useSplashSequence({ ready, onFinished: beginExit });

  useEffect(() => {
    const { revealDelayMs, revealDurationMs, holdMs, recolorDurationMs } =
      SPLASH_TIMELINE;
    const easing = Easing.out(Easing.ease);

    reveal.value = withDelay(
      revealDelayMs,
      withTiming(1, { duration: revealDurationMs, easing }),
    );
    recolor.value = withDelay(
      revealDelayMs + revealDurationMs + holdMs,
      withTiming(1, { duration: recolorDurationMs, easing }),
    );
  }, [reveal, recolor]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const curtainStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -CURTAIN.travel * reveal.value }],
  }));

  const logomarkProps = useAnimatedProps(() => ({
    color: interpolateColor(recolor.value, [0, 1], [mutedColor, brandColor]),
  }));

  // Starts on the page colour, so the wordmark is present but unseen until it
  // darkens into place.
  const wordmarkProps = useAnimatedProps(() => ({
    color: interpolateColor(recolor.value, [0, 1], [pageColor, wordmarkColor]),
  }));

  return (
    <Animated.View
      style={[styles.screen, { backgroundColor: pageColor }, screenStyle]}
    >
      <View style={styles.lockup}>
        <AnimatedLogomark {...LOGOMARK} animatedProps={logomarkProps} />
        <AnimatedWordmark
          {...WORDMARK}
          animatedProps={wordmarkProps}
          style={styles.wordmark}
        />
        <Animated.View style={[styles.curtain, curtainStyle]}>
          <Svg width={CURTAIN.width} height={CURTAIN.height}>
            <Defs>
              {/* Opaque at the bottom, fading out at the top edge, so the
                  curtain's trailing edge is soft as it clears the mark. */}
              <LinearGradient id="splashCurtain" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor={pageColor} stopOpacity={1} />
                <Stop offset="0.82" stopColor={pageColor} stopOpacity={1} />
                <Stop offset="1" stopColor={pageColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#splashCurtain)" />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

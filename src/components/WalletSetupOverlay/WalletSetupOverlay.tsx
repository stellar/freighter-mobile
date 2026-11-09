import { WalletSetupSparkle } from "components/WalletSetupOverlay/WalletSetupSparkle";
import { useWalletSetupOverlayExit } from "components/WalletSetupOverlay/useWalletSetupOverlayExit";
import { Display } from "components/sds/Typography";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import {
  WalletSetupFlow,
  WalletSetupOverlayPhase,
  useWalletSetupOverlayStore,
} from "ducks/walletSetupOverlay";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useBackHandler from "hooks/useBackHandler";
import useColors from "hooks/useColors";
import useTheme from "hooks/useTheme";
import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export const WALLET_SETUP_OVERLAY_TEST_ID = "wallet-setup-overlay";

export const FADE_IN_MS = 200;
export const TITLE_FADE_MS = 200;
export const CIRCLE_POP_MS = 550;
export const FADE_OUT_MS = 300;

/**
 * The fades play even with Reduce Motion: they aren't motion, and without
 * them the screen would flash in and out. Reanimated skips any animation
 * that follows the system setting, which withTiming does by default, so the
 * fades opt out. The bounce and the circle are what Reduce Motion drops.
 */
const FADE_REDUCE_MOTION = ReduceMotion.Never;
/** Figma's "ready" wave grows the badge's circle to 1.4× as it fades. */
const CIRCLE_POP_SCALE = 1.4;
/**
 * Figma repeats the wave every 1.5s, but the screen can leave 1s after
 * setup succeeds, and the first wave plays under the title's change, where
 * it's easy to miss. So a second wave follows right after the first.
 */
const CIRCLE_WAVES = 2;
/** Figma's badge and title column (?node-id=760-37097). */
const COLUMN_WIDTH = 232;
const COLUMN_GAP = 16;
const BADGE_PADDING = 8;
/** Figma's Funnel Sans Medium 24 heading tracks at -0.96. */
const TITLE_LETTER_SPACING = -0.96;

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  circle: { borderRadius: 1000 },
  // Both titles share one row, the second pulled back over the first, so
  // the row is as tall as the taller one and neither shifts the layout.
  titles: { flexDirection: "row", alignSelf: "stretch" },
  title: { width: "100%" },
  overlappingTitle: { marginLeft: "-100%" },
  titleText: { letterSpacing: TITLE_LETTER_SPACING, textAlign: "center" },
});

interface WalletSetupOverlayContentProps {
  phase: Exclude<WalletSetupOverlayPhase, "hidden">;
  flow: WalletSetupFlow;
}

/**
 * The screen itself, mounted only while it's up, so each showing starts from
 * its own fade-in.
 */
const WalletSetupOverlayContent: React.FC<WalletSetupOverlayContentProps> = ({
  phase,
  flow,
}) => {
  const { t } = useAppTranslation();
  const theme = useTheme();
  const { themeColors } = useColors();
  const isLight = (useColorScheme() ?? DEFAULT_COLOR_SCHEME) === "light";
  // Reanimated reads Reduce Motion at launch, so it's known on the first
  // frame. The app's useIsReduceMotionEnabled answers asynchronously, and
  // setup blocks the JS thread that would receive the answer, which held the
  // sparkle still for seconds.
  const isReduceMotionEnabled = useReducedMotion();
  const finishLeaving = useWalletSetupOverlayStore(
    (state) => state.finishLeaving,
  );

  const opacity = useSharedValue(0);
  // 0 shows the loading title, 1 the ready one.
  const readiness = useSharedValue(0);
  // 0 is the resting circle, 1 has grown and faded away.
  const circlePop = useSharedValue(0);

  const loadingTitle =
    flow === "import"
      ? t("walletSetupOverlay.importing")
      : t("walletSetupOverlay.creating");
  const readyTitle = t("walletSetupOverlay.ready");
  // A failed setup fades out on the loading title; a successful one on the
  // ready title.
  const [isReady, setIsReady] = useState(phase === "ready");

  useEffect(() => {
    if (phase === "settingUp") setIsReady(false);
    if (phase === "ready") setIsReady(true);
  }, [phase]);

  useEffect(() => {
    if (phase === "leaving") {
      opacity.value = withTiming(0, {
        duration: FADE_OUT_MS,
        easing: Easing.inOut(Easing.ease),
        reduceMotion: FADE_REDUCE_MOTION,
      });
      // The store, not the animation, decides when the screen is gone, so
      // an interrupted fade can't leave it up.
      const timeout = setTimeout(finishLeaving, FADE_OUT_MS);
      return () => clearTimeout(timeout);
    }

    opacity.value = withTiming(1, {
      duration: FADE_IN_MS,
      easing: Easing.out(Easing.ease),
      reduceMotion: FADE_REDUCE_MOTION,
    });
    return undefined;
  }, [finishLeaving, opacity, phase]);

  useEffect(() => {
    readiness.value = withTiming(isReady ? 1 : 0, {
      duration: TITLE_FADE_MS,
      easing: Easing.inOut(Easing.ease),
      reduceMotion: FADE_REDUCE_MOTION,
    });

    if (isReady && !isReduceMotionEnabled) {
      // Each wave starts over from the whole circle, as Figma's loop does.
      circlePop.value = withRepeat(
        withTiming(1, {
          duration: CIRCLE_POP_MS,
          easing: Easing.out(Easing.ease),
        }),
        CIRCLE_WAVES,
      );
    } else if (!isReady) {
      circlePop.value = 0;
    }
  }, [circlePop, isReady, isReduceMotionEnabled, readiness]);

  // Screen readers hear each title as it appears.
  useEffect(() => {
    if (phase === "settingUp") {
      AccessibilityInfo.announceForAccessibility(loadingTitle);
    } else if (phase === "ready") {
      AccessibilityInfo.announceForAccessibility(readyTitle);
    }
  }, [loadingTitle, phase, readyTitle]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const loadingTitleStyle = useAnimatedStyle(() => ({
    opacity: 1 - readiness.value,
  }));
  const readyTitleStyle = useAnimatedStyle(() => ({
    opacity: readiness.value,
  }));
  const circleStyle = useAnimatedStyle(() => ({
    opacity: 1 - circlePop.value,
    transform: [{ scale: 1 + (CIRCLE_POP_SCALE - 1) * circlePop.value }],
  }));

  return (
    <Animated.View
      testID={WALLET_SETUP_OVERLAY_TEST_ID}
      accessibilityViewIsModal
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: theme.colors.base.primary },
        fadeStyle,
      ]}
    >
      <View style={styles.centered}>
        <View
          style={{
            width: pxValue(COLUMN_WIDTH),
            alignItems: "center",
            gap: pxValue(COLUMN_GAP),
          }}
        >
          <View style={{ padding: pxValue(BADGE_PADDING) }}>
            <Animated.View
              testID={`${WALLET_SETUP_OVERLAY_TEST_ID}-circle`}
              style={[
                StyleSheet.absoluteFill,
                styles.circle,
                {
                  backgroundColor: isLight
                    ? themeColors.lilac[3]
                    : themeColors.lilac[2],
                },
                circleStyle,
              ]}
            />
            <WalletSetupSparkle
              testID={`${WALLET_SETUP_OVERLAY_TEST_ID}-sparkle`}
              isLooping={phase === "settingUp" && !isReduceMotionEnabled}
            />
          </View>
          <View style={styles.titles}>
            <Animated.View
              testID={`${WALLET_SETUP_OVERLAY_TEST_ID}-title-loading`}
              style={[styles.title, loadingTitleStyle]}
              accessibilityElementsHidden={isReady}
              importantForAccessibility={
                isReady ? "no-hide-descendants" : "auto"
              }
            >
              <Display xs medium family="funnelSans" style={styles.titleText}>
                {loadingTitle}
              </Display>
            </Animated.View>
            <Animated.View
              testID={`${WALLET_SETUP_OVERLAY_TEST_ID}-title-ready`}
              style={[styles.title, styles.overlappingTitle, readyTitleStyle]}
              accessibilityElementsHidden={!isReady}
              importantForAccessibility={
                isReady ? "auto" : "no-hide-descendants"
              }
            >
              <Display xs medium family="funnelSans" style={styles.titleText}>
                {readyTitle}
              </Display>
            </Animated.View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

/**
 * The screen that covers the end of onboarding: "Creating your wallet..." or
 * "Importing your wallet..." while the wallet is set up, then "Your wallet
 * is ready!" until Home has loaded beneath it (Figma ?node-id=760-37088,
 * 2091-41721, 724-21735 and 760-37104).
 *
 * It sits above the navigator, so it stays up while the app swaps the
 * onboarding stack for Home. While it's up it takes every touch and
 * Android's back button, and hides what's beneath from screen readers (see
 * RootNavigator). Its state lives in useWalletSetupOverlayStore, driven by
 * runWithWalletSetupOverlay.
 */
export const WalletSetupOverlay: React.FC = React.memo(() => {
  const phase = useWalletSetupOverlayStore((state) => state.phase);
  const flow = useWalletSetupOverlayStore((state) => state.flow);
  const isVisible = phase !== "hidden";

  useWalletSetupOverlayExit();
  useBackHandler(() => true, isVisible);

  if (phase === "hidden") return null;

  return <WalletSetupOverlayContent phase={phase} flow={flow} />;
});

// Memoized because RootNavigator re-renders on every change to the auth
// store, which happens many times while Home loads beneath this screen.
WalletSetupOverlay.displayName = "WalletSetupOverlay";

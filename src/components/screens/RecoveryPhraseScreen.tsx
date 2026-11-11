import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RecoveryPhraseGrid } from "components/RecoveryPhraseGrid";
import {
  FooterNote,
  OnboardLayout,
  OnboardTitle,
} from "components/layout/OnboardLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { BiometricsSource } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useLoginDataStore } from "ducks/loginData";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useFinishWalletSetup } from "hooks/useFinishWalletSetup";
import { useSecureClipboard } from "hooks/useSecureClipboard";
import useTheme from "hooks/useTheme";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import Reanimated, {
  Easing as ReanimatedEasing,
  LinearTransition,
  ReduceMotion,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { analytics } from "services/analytics";
import StellarHDWallet from "stellar-hd-wallet";

type RecoveryPhraseScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN
>;

/** How long "Copied" shows before the button reads "Tap to copy" again. */
export const COPIED_FEEDBACK_DURATION_MS = 2000;

/**
 * How "Copied" fades back to "Tap to copy". It mirrors the press that
 * brought "Copied" in: TouchableOpacity dims the button to 0.2 and fades it
 * back over 250ms.
 */
export const COPIED_FADED_OPACITY = 0.2;
export const COPIED_FADE_OUT_MS = 150;
export const COPIED_FADE_IN_MS = 250;
const FADE_EASING = Easing.inOut(Easing.quad);

const COPY_ICON_SIZE = 16;
const COPY_ICON_STROKE_WIDTH = 2;

/**
 * Revealing the phrase, the button slides down to where Next sits, and its
 * label turns to "Next" mid-slide. Once it lands, the rest fades: the title,
 * the phrase over its frost, "Tap to copy" and the warning. Under Reduce
 * Motion the button moves without sliding, and only the fade plays, label
 * included.
 */
export const REVEAL_SLIDE_MS = 200;
export const REVEAL_FADE_MS = 250;
/**
 * How long after the fade the screen settles: taps go through again, and
 * the hidden state, covered by then, leaves. A margin, since the animations
 * don't run on the timer's thread.
 */
export const REVEAL_SETTLE_MS = 100;
export const REVEAL_TRANSITION_MS =
  REVEAL_SLIDE_MS + REVEAL_FADE_MS + REVEAL_SETTLE_MS;

const REVEAL_SLIDE = LinearTransition.duration(REVEAL_SLIDE_MS).easing(
  ReanimatedEasing.inOut(ReanimatedEasing.cubic),
);
const REVEAL_FADE_EASING = ReanimatedEasing.inOut(ReanimatedEasing.quad);
/** The label's quick cross-fade, centred on the slide's midpoint. */
const REVEAL_LABEL_FADE_MS = REVEAL_SLIDE_MS / 2;
const REVEAL_LABEL_DELAY_MS = (REVEAL_SLIDE_MS - REVEAL_LABEL_FADE_MS) / 2;

/** Fades a reveal layer in, after `delayMs`, Reduce Motion or not. */
const fadeIn = (delayMs: number, durationMs: number) =>
  withDelay(
    delayMs,
    withTiming(1, {
      duration: durationMs,
      easing: REVEAL_FADE_EASING,
      reduceMotion: ReduceMotion.Never,
    }),
    ReduceMotion.Never,
  );

/**
 * Hidden; revealing, while both states are on screen and the new one fades
 * in over the old; revealed.
 */
type RevealPhase = "hidden" | "revealing" | "revealed";

const styles = StyleSheet.create({
  label: { flexDirection: "row", alignItems: "center", gap: 4 },
  // Figma: "Tap to copy" 16pt under the phrase.
  copy: { marginTop: 16, alignItems: "center" },
  // Figma: the reveal button 24pt under the phrase.
  revealGap: { height: 24 },
  // Revealed, the space that keeps Next at the bottom.
  fill: { flexGrow: 1 },
  // Figma: 32pt from the warning to Next, as OnboardLayout's footer has it.
  warning: { marginBottom: pxValue(32) },
});

interface FadeLayerProps {
  /** The reveal's fade, from 0 to 1. */
  progress: SharedValue<number>;
  /** Fades out as the reveal fades the rest in. */
  isLeaving?: boolean;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: "auto" | "none";
  testID?: string;
  children: React.ReactNode;
}

/** A part of the screen that fades with the reveal. */
const FadeLayer: React.FC<FadeLayerProps> = ({
  progress,
  isLeaving = false,
  style,
  pointerEvents,
  testID,
  children,
}) => {
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: isLeaving ? 1 - progress.value : progress.value,
  }));

  return (
    <Reanimated.View
      style={[style, fadeStyle]}
      pointerEvents={pointerEvents}
      testID={testID}
    >
      {children}
    </Reanimated.View>
  );
};

/**
 * "Tap to copy", which shows "Copied" for 2 seconds after a tap, then fades
 * back. While "Copied" shows, the button takes no taps and doesn't
 * highlight, since a tap would do nothing new.
 */
const CopyPhraseButton: React.FC<{ onCopy: () => void }> = ({ onCopy }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [isCopied, setIsCopied] = useState(false);
  const labelOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isCopied) return undefined;

    let fadeOut: Animated.CompositeAnimation | undefined;
    const timer = setTimeout(() => {
      fadeOut = Animated.timing(labelOpacity, {
        toValue: COPIED_FADED_OPACITY,
        duration: COPIED_FADE_OUT_MS,
        easing: FADE_EASING,
        useNativeDriver: true,
      });
      fadeOut.start(({ finished }) => {
        // Over, so the cleanup has nothing to stop: stopping it would stop
        // the fade back in as well, since both run on the same value.
        fadeOut = undefined;
        if (!finished) return;

        setIsCopied(false);
        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: COPIED_FADE_IN_MS,
          easing: FADE_EASING,
          useNativeDriver: true,
        }).start();
      });
    }, COPIED_FEEDBACK_DURATION_MS);

    return () => {
      clearTimeout(timer);
      fadeOut?.stop();
    };
  }, [isCopied, labelOpacity]);

  const handlePress = () => {
    onCopy();
    setIsCopied(true);
  };

  return (
    <TouchableOpacity
      testID="copy-recovery-phrase-button"
      onPress={handlePress}
      disabled={isCopied}
      accessibilityRole="button"
      className="px-[12px] py-[8px]"
    >
      <Animated.View style={[styles.label, { opacity: labelOpacity }]}>
        {isCopied ? (
          <>
            <Text sm semiBold color={themeColors.green[11]}>
              {t("recoveryPhraseScreen.copied")}
            </Text>
            <Icon.CheckCircle
              size={COPY_ICON_SIZE}
              strokeWidth={COPY_ICON_STROKE_WIDTH}
              color={themeColors.green[9]}
            />
          </>
        ) : (
          <>
            <Text sm semiBold primary>
              {t("recoveryPhraseScreen.tapToCopy")}
            </Text>
            <Icon.Copy01
              size={COPY_ICON_SIZE}
              strokeWidth={COPY_ICON_STROKE_WIDTH}
              color={themeColors.foreground.primary}
            />
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * Recovery Phrase, the second step of creating a wallet, in two states.
 * Hidden, the phrase sits behind a frost until the user taps "I
 * understand. Reveal my phrase". Revealed ("You saved it, right?"), the
 * words show with a copy button and a warning, and Next finishes the
 * setup. There is no verification step.
 *
 * Between the two, the reveal button slides down and becomes Next, then the
 * rest fades (see REVEAL_SLIDE_MS). The screen lays out its own footer for
 * that, so the button is one view throughout.
 *
 * The phrase is generated once per flow and kept in memory, so going back
 * to Set Password and forward again shows the same one. Welcome clears it.
 *
 * Design: hidden ?node-id=1-11955, revealed ?node-id=1-11962, copied
 * ?node-id=647-5607 (light); colors from 760-36874 and 760-36888 (dark).
 */
export const RecoveryPhraseScreen: React.FC<RecoveryPhraseScreenProps> = () => {
  const { t } = useAppTranslation();
  const theme = useTheme();
  const { copyToClipboard } = useSecureClipboard();
  const isFinishing = useAuthenticationStore((state) => state.isLoading);
  const finishWalletSetup = useFinishWalletSetup();
  const isReducedMotion = useReducedMotion();

  const [phrase] = useState(
    () =>
      useLoginDataStore.getState().mnemonicPhrase ??
      StellarHDWallet.generateMnemonic({ entropyBits: 128 }),
  );
  const [phase, setPhase] = useState<RevealPhase>("hidden");
  const fade = useSharedValue(0);
  const labelFade = useSharedValue(0);

  // Keeps the phrase for the rest of the flow. It runs once: `phrase` never
  // changes, so a clear after a successful setup stays cleared.
  useEffect(() => {
    useLoginDataStore.getState().setMnemonicPhrase(phrase);
  }, [phrase]);

  // Starts once the revealing layout is committed, as the slide does, so the
  // label turns mid-slide and the fade waits for the button to land.
  useEffect(() => {
    if (phase !== "revealing") return undefined;

    const slideMs = isReducedMotion ? 0 : REVEAL_SLIDE_MS;
    // A fade is what Reduce Motion asks for in place of motion, so it plays
    // either way.
    fade.value = fadeIn(slideMs, REVEAL_FADE_MS);
    labelFade.value = isReducedMotion
      ? fadeIn(0, REVEAL_FADE_MS)
      : fadeIn(REVEAL_LABEL_DELAY_MS, REVEAL_LABEL_FADE_MS);
    const timer = setTimeout(
      () => setPhase("revealed"),
      slideMs + REVEAL_FADE_MS + REVEAL_SETTLE_MS,
    );

    return () => clearTimeout(timer);
  }, [fade, isReducedMotion, labelFade, phase]);

  const handleReveal = useCallback(() => {
    setPhase("revealing");
    analytics.track(AnalyticsEvent.VIEWED_RECOVERY_PHRASE);
  }, []);

  const handleCopy = useCallback(() => {
    copyToClipboard(phrase, { hideNotification: true });
    analytics.trackCopyBackupPhrase();
  }, [copyToClipboard, phrase]);

  const isHidden = phase === "hidden";
  const isRevealing = phase === "revealing";
  const isRevealed = phase === "revealed";
  // While revealing, each new part sits over the old one it replaces, which
  // leaves once it's covered.
  const overOld = isRevealing ? StyleSheet.absoluteFill : undefined;
  const pointerEvents = isRevealing ? "none" : "auto";

  const title = (
    <View>
      {!isRevealed && (
        <FadeLayer progress={fade} isLeaving>
          <OnboardTitle>{t("recoveryPhraseScreen.hiddenTitle")}</OnboardTitle>
        </FadeLayer>
      )}
      {!isHidden && (
        <FadeLayer progress={fade} style={overOld}>
          <OnboardTitle>{t("recoveryPhraseScreen.revealedTitle")}</OnboardTitle>
        </FadeLayer>
      )}
    </View>
  );

  const description = (
    <Text md secondary>
      {t("recoveryPhraseScreen.description")}{" "}
      <Text md semiBold primary>
        {t("recoveryPhraseScreen.descriptionEmphasis")}
      </Text>
    </Text>
  );

  return (
    <OnboardLayout title={title} description={description} footer={null}>
      <View className="grow">
        {/* Figma sits the grid 24pt under the description. */}
        <View className="mt-[8px]">
          {!isRevealed && <RecoveryPhraseGrid />}
          {!isHidden && (
            // The words fade in over the frost on the page's color, rather
            // than the frost fading out: iOS can't blur through a view
            // that's partly transparent.
            <FadeLayer
              progress={fade}
              style={[overOld, { backgroundColor: theme.colors.base.primary }]}
              testID="recovery-phrase-words-layer"
            >
              <RecoveryPhraseGrid words={phrase.split(" ")} />
            </FadeLayer>
          )}
        </View>
        {!isHidden && (
          <FadeLayer
            progress={fade}
            style={styles.copy}
            pointerEvents={pointerEvents}
          >
            <CopyPhraseButton onCopy={handleCopy} />
          </FadeLayer>
        )}
        <View style={isHidden ? styles.revealGap : styles.fill} />
        {!isHidden && (
          <FadeLayer progress={fade} style={styles.warning}>
            <FooterNote
              text={t("recoveryPhraseScreen.warning")}
              tone="warning"
            />
          </FadeLayer>
        )}
        <Reanimated.View layout={REVEAL_SLIDE} pointerEvents={pointerEvents}>
          {!isRevealed && (
            <Button
              secondary
              xl
              isFullWidth
              testID="reveal-recovery-phrase-button"
              onPress={handleReveal}
            >
              {t("recoveryPhraseScreen.revealButtonText")}
            </Button>
          )}
          {!isHidden && (
            // Over the reveal button, so its label fades to Next.
            <FadeLayer
              progress={labelFade}
              style={overOld}
              testID="recovery-phrase-next-layer"
            >
              <Button
                secondary
                xl
                isFullWidth
                testID="default-action-button"
                isLoading={isFinishing}
                onPress={() => finishWalletSetup(BiometricsSource.ONBOARDING)}
              >
                {t("onboarding.next")}
              </Button>
            </FadeLayer>
          )}
        </Reanimated.View>
      </View>
    </OnboardLayout>
  );
};

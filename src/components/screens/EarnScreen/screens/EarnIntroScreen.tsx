import BlendLogo from "assets/logos/blend-logo.svg";
import { BaseLayout } from "components/layout/BaseLayout";
import { EarnGlow } from "components/screens/EarnScreen/components/EarnGlow";
import { EarnScreenHeader } from "components/screens/EarnScreen/components/EarnScreenHeader";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent, buildScreenViewedProps } from "config/analyticsConfig";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect } from "react";
import { View } from "react-native";
import { track } from "services/analytics/core";

/**
 * Geometry from Figma `13701:332561` ("Blend intro (first time user)"), whose
 * frame is 402x874 -- an iPhone 14/15 Pro, i.e. a real device canvas rather
 * than the extension's 360x600 popup. Absolute offsets in that frame are
 * therefore translated into the equivalent safe-area-relative flex layout
 * instead of being reproduced literally:
 *
 * - `EarnScreenHeader` places the X box at the design's y=70..94.
 * - Content starts at y=176, i.e. 82 below the icon's bottom edge.
 * - The CTA's top is y=766 in an 874-tall frame, leaving 60 beneath it;
 *   safe-area bottom is 34, so 26 (~`pb-6`) of real padding. The gap above it
 *   is slack, which is why the CTA is pinned to the bottom with a flexible
 *   spacer rather than positioned at a fixed offset.
 */
const CONTENT_TOP_OFFSET = 82;

/** Figma frame center of the glow: x=201 (402/2, i.e. screen center), y=180. */
const GLOW_CENTER_Y = 180;

export interface EarnIntroScreenProps {
  /**
   * Continue. The caller marks the intro seen and drops through to the token
   * picker underneath -- see `EarnTokenPickerScreen`.
   */
  onContinue: () => void;
  /**
   * The header X. Per the design this leaves Earn entirely rather than
   * advancing to the picker, but it still marks the intro seen: a user who
   * dismissed the pitch should not be shown it again on this install.
   */
  onClose: () => void;
}

/**
 * First-run interstitial for the Earn (Blend) flow, shown once per install.
 *
 * Rendered INLINE by `EarnTokenPickerScreen` as a full-screen early return,
 * not as a registered route -- the same pattern (and for the same reason) as
 * `EarnProcessingScreen`: `EARN_ROUTES` carries no intro entry, and a
 * declared-but-unregistered route throws at runtime. It renders its own bare-X
 * header; the stack header is off for this route at the navigator level (both
 * redesigned Earn frames drop it), so nothing needs toggling here.
 *
 * This replaced a bottom sheet: the design was reworked into a full screen
 * (Figma `13701:332561`), so the sheet, its wrapper, and its `startEarning`
 * copy are gone.
 */
export const EarnIntroScreen: React.FC<EarnIntroScreenProps> = ({
  onContinue,
  onClose,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  // Retargeted to `screen.viewed` manually because this is not a route, so
  // the navigator's automatic route-name tracking never fires for it. The
  // sheet this replaced got the same event from `BottomSheet`'s
  // `analyticsEvent` prop; the direct `track()` call matches what the other
  // non-route Earn screen (`EarnProcessingScreen`) already does.
  useEffect(() => {
    track(
      AnalyticsEvent.SCREEN_VIEWED,
      buildScreenViewedProps(AnalyticsEvent.VIEW_EARN_INTRO),
    );
  }, []);

  const features = [
    {
      key: "variableYield",
      title: t("earnIntro.variableYield.title"),
      body: t("earnIntro.variableYield.body"),
    },
    {
      key: "stayInControl",
      title: t("earnIntro.stayInControl.title"),
      body: t("earnIntro.stayInControl.body"),
    },
  ];

  return (
    <BaseLayout
      useSafeArea
      backgroundColor={themeColors.background.primary}
      insets={{ bottom: true, top: true, left: false, right: false }}
      testID="earn-intro-screen"
    >
      <EarnGlow centerY={GLOW_CENTER_Y} />

      <View className="flex-1 px-6">
        <EarnScreenHeader onClose={onClose} testID="earn-intro-close" />

        <View className="gap-10" style={{ marginTop: CONTENT_TOP_OFFSET }}>
          <View className="items-center gap-8">
            <BlendLogo width={88} height={88} />

            {/* Title and subtitle are a single gapless stack in the design --
                their 40 and 20 line boxes already carry the spacing. */}
            <View className="w-full items-center">
              {/* Display `sm` is 32/40, exactly Figma's Display/SM/500. The
                  -1.28 tracking has no SDS prop, so it comes through
                  `style`. */}
              <Display
                sm
                medium
                style={{ letterSpacing: -1.28, textAlign: "center" }}
              >
                {t("earnIntro.title")}
              </Display>
              <Text sm regular secondary textAlign="center">
                {t("earnIntro.subtitle")}
              </Text>
            </View>
          </View>

          <View className="gap-8">
            {features.map((feature) => (
              <View key={feature.key} className="flex-row items-center gap-3">
                {/* 40 rounded-5 tile; the glyph inside is 26.67 in the
                    design, which rounds to 27. */}
                <View
                  className="size-10 items-center justify-center rounded-[5px]"
                  style={{ backgroundColor: themeColors.background.tertiary }}
                >
                  <Icon.Asterisk01
                    color={themeColors.foreground.primary}
                    size={27}
                  />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text md medium primary>
                    {feature.title}
                  </Text>
                  <Text sm regular secondary>
                    {feature.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Slack between the feature list and the pinned CTA. */}
        <View className="flex-1" />

        <View className="pb-6">
          <Button
            tertiary
            xl
            isFullWidth
            onPress={onContinue}
            testID="earn-intro-continue"
          >
            {t("common.continue")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default EarnIntroScreen;

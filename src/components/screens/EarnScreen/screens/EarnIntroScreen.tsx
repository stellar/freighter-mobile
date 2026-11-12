import SparkleGreenDark from "assets/images/earn-sparkle-green-dark.svg";
import SparkleGreenLight from "assets/images/earn-sparkle-green-light.svg";
import SparkleLilac from "assets/images/earn-sparkle-lilac.svg";
import SparkleTealDark from "assets/images/earn-sparkle-teal-dark.svg";
import SparkleTealLight from "assets/images/earn-sparkle-teal-light.svg";
import BlendLogo from "assets/logos/blend-logo.svg";
import { BaseLayout } from "components/layout/BaseLayout";
import { getNavigationHeaderHeight } from "components/layout/CustomNavigationHeader";
import { EarnGlow } from "components/screens/EarnScreen/components/EarnGlow";
import { EarnScreenHeader } from "components/screens/EarnScreen/components/EarnScreenHeader";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent, buildScreenViewedProps } from "config/analyticsConfig";
import { DEFAULT_PADDING } from "config/constants";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect } from "react";
import { useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { track } from "services/analytics/core";

/**
 * In the design the header row ends at y=91 and the hero starts at y=176.
 * The nav bar already has 24 of padding under its row, so the hero sits 61
 * below the bar.
 */
const CONTENT_TOP_OFFSET = 61;

/**
 * The glow's center sits 24.5 below the header row (y=115.5), i.e. half a
 * point below the nav bar, whose own bottom padding is 24.
 */
const GLOW_OFFSET_BELOW_HEADER = 0.5;

/** The Blend jar is 88 square. */
const LOGO_SIZE = 88;

/**
 * Where the three sparkles sit around the jar, from the jar's top-left
 * corner. Each asset is drawn at its own size.
 */
const SPARKLE_POSITIONS = {
  lilac: { left: -21.84, top: 2.15 },
  teal: { left: 94.15, top: 20.15 },
  green: { left: -4.85, top: 70.15 },
};

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
 * The jar with its three sparkles. Two of the sparkles change color with the
 * theme; the lilac one is the same in both.
 */
const BlendLogoWithSparkles: React.FC = () => {
  const isDark = (useColorScheme() ?? DEFAULT_COLOR_SCHEME) === "dark";
  const SparkleTeal = isDark ? SparkleTealDark : SparkleTealLight;
  const SparkleGreen = isDark ? SparkleGreenDark : SparkleGreenLight;

  return (
    <View style={{ width: LOGO_SIZE, height: LOGO_SIZE }}>
      <BlendLogo width={LOGO_SIZE} height={LOGO_SIZE} />
      <View className="absolute" style={SPARKLE_POSITIONS.lilac}>
        <SparkleLilac />
      </View>
      <View className="absolute" style={SPARKLE_POSITIONS.teal}>
        <SparkleTeal />
      </View>
      <View className="absolute" style={SPARKLE_POSITIONS.green}>
        <SparkleGreen />
      </View>
    </View>
  );
};

/**
 * First-run interstitial for the Earn (Blend) flow, shown once per install.
 *
 * Rendered INLINE by `EarnTokenPickerScreen` as a full-screen early return,
 * not as a registered route -- the same pattern (and for the same reason) as
 * `EarnProcessingScreen`: `EARN_ROUTES` carries no intro entry, and a
 * declared-but-unregistered route throws at runtime. It renders its own bare-X
 * header; the stack header is off for this route at the navigator level.
 */
export const EarnIntroScreen: React.FC<EarnIntroScreenProps> = ({
  onContinue,
  onClose,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const insets = useSafeAreaInsets();
  const headerHeight = getNavigationHeaderHeight(insets.top);

  // Retargeted to `screen.viewed` manually because this is not a route, so
  // the navigator's automatic route-name tracking never fires for it.
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
      insets={{ bottom: true, top: false, left: false, right: false }}
      testID="earn-intro-screen"
    >
      <EarnGlow centerY={headerHeight + GLOW_OFFSET_BELOW_HEADER} />

      <EarnScreenHeader onClose={onClose} testID="earn-intro-close" />

      <View
        className="flex-1"
        style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
      >
        <View
          className="gap-[40px]"
          style={{ marginTop: pxValue(CONTENT_TOP_OFFSET) }}
        >
          <View className="items-center gap-[32px]">
            <BlendLogoWithSparkles />

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

          <View className="gap-[32px]">
            {features.map((feature) => (
              <View
                key={feature.key}
                className="flex-row items-center gap-[12px]"
              >
                <View
                  className="size-[40px] items-center justify-center rounded-[5px]"
                  style={{ backgroundColor: themeColors.background.tertiary }}
                >
                  <Icon.Asterisk01
                    color={themeColors.foreground.primary}
                    size={18}
                  />
                </View>
                <View className="flex-1 gap-[2px]">
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

        <Button
          secondary
          xl
          isFullWidth
          onPress={onContinue}
          testID="earn-intro-continue"
        >
          {t("common.continue")}
        </Button>
      </View>
    </BaseLayout>
  );
};

export default EarnIntroScreen;

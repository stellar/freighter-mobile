import { BaseLayout } from "components/layout/BaseLayout";
import { RebrandAnnouncementIllustration } from "components/screens/RebrandAnnouncementScreen/RebrandAnnouncementIllustration";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { markRebrandAnnouncementSeen } from "helpers/rebrandAnnouncement";
import useAppTranslation from "hooks/useAppTranslation";
import useTheme from "hooks/useTheme";
import React, { useCallback, useEffect, useRef } from "react";
import { BackHandler, StyleSheet, TouchableOpacity, View } from "react-native";
import { analytics } from "services/analytics";

export type RebrandAnnouncementDismissSource = "close" | "continue" | "back";

interface RebrandAnnouncementScreenProps {
  /** Called once the user leaves the screen, by either the X or the button. */
  onDismiss: () => void;
}

const CLOSE_HIT_SLOP = { top: 12, right: 12, bottom: 12, left: 12 };

const styles = StyleSheet.create({
  // Figma: Funnel Sans Medium 32/40, tracking -1.28.
  title: {
    letterSpacing: -1.28,
    textAlign: "center",
  },
});

/**
 * One-time "Freighter is now Varial" announcement for existing users, overlaid by
 * RootNavigator on the first authenticated entry. Marked seen on mount.
 */
export const RebrandAnnouncementScreen: React.FC<
  RebrandAnnouncementScreenProps
> = ({ onDismiss }) => {
  const { t } = useAppTranslation();
  const theme = useTheme();
  const hasDismissed = useRef(false);

  useEffect(() => {
    markRebrandAnnouncementSeen();
    analytics.track(AnalyticsEvent.REBRAND_ANNOUNCEMENT_VIEWED);
  }, []);

  const handleDismiss = useCallback(
    (source: RebrandAnnouncementDismissSource) => {
      if (hasDismissed.current) {
        return;
      }
      hasDismissed.current = true;

      analytics.track(AnalyticsEvent.REBRAND_ANNOUNCEMENT_DISMISSED, {
        source,
      });
      onDismiss();
    },
    [onDismiss],
  );

  // The overlay is not a route, so the Android back button would otherwise
  // reach the navigator underneath. Treat it as a dismiss. Registered once:
  // Android gives the newest listener priority, so re-registering on each
  // render could put this above the lock overlay's listener.
  const handleDismissRef = useRef(handleDismiss);
  handleDismissRef.current = handleDismiss;

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleDismissRef.current("back");

        return true;
      },
    );

    return () => subscription.remove();
  }, []);

  return (
    <BaseLayout useSafeArea testID="rebrand-announcement-screen">
      <View className="flex-1">
        <View className="flex-row justify-end">
          <TouchableOpacity
            onPress={() => handleDismiss("close")}
            hitSlop={CLOSE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t(
              "rebrandAnnouncementScreen.closeAccessibilityLabel",
            )}
            testID="rebrand-announcement-close-button"
          >
            <Icon.XClose size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View className="flex-1 items-center justify-center">
          <RebrandAnnouncementIllustration
            accessibilityLabel={t(
              "rebrandAnnouncementScreen.illustrationAccessibilityLabel",
            )}
            testID="rebrand-announcement-illustration"
          />
          <View className="mt-7 items-center px-6">
            <Display sm medium family="funnelSans" style={styles.title}>
              {t("rebrandAnnouncementScreen.title")}
            </Display>
            <View className="mt-2">
              <Text md secondary textAlign="center">
                {t("rebrandAnnouncementScreen.description")}
              </Text>
            </View>
          </View>
        </View>

        <Button
          secondary
          xl
          isFullWidth
          testID="rebrand-announcement-continue-button"
          onPress={() => handleDismiss("continue")}
        >
          {t("rebrandAnnouncementScreen.continueButton")}
        </Button>
      </View>
    </BaseLayout>
  );
};

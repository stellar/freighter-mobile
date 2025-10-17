import ConfirmationModal from "components/ConfirmationModal";
import { FreighterLogo } from "components/FreighterLogo";
import { Button } from "components/sds/Button";
import { AnalyticsEvent } from "config/analyticsConfig";
import useAppTranslation from "hooks/useAppTranslation";
import { useAppUpdate } from "hooks/useAppUpdate";
import React, { useState } from "react";
import { View, Text } from "react-native";
import { analytics } from "services/analytics";

interface ForceUpdateScreenProps {
  onDismiss?: () => void;
}

/**
 * Full-screen component that forces users to update their app
 * Used for critical updates or when users are too far behind on app version
 */
export const ForceUpdateScreen: React.FC<ForceUpdateScreenProps> = ({
  onDismiss,
}) => {
  const { t } = useAppTranslation();
  const { openAppStore } = useAppUpdate();
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);

  const handleLater = () => {
    setShowSkipConfirmation(true);
  };

  const handleConfirmSkip = () => {
    analytics.track(AnalyticsEvent.APP_UPDATE_CONFIRMED_SKIP_ON_SCREEN);
    onDismiss?.();
  };

  const handleGoToAppStore = () => {
    openAppStore().then(() => {
      analytics.track(AnalyticsEvent.APP_UPDATE_OPEN_STORE_FROM_SCREEN);
      onDismiss?.();
    });
  };

  return (
    <View className="flex-1 justify-center items-center p-6 bg-gray-1">
      <View className="bg-gray-3 rounded-[24px] p-6 w-full max-w-sm">
        <View className="mb-6">
          <FreighterLogo width={56} height={56} />
        </View>

        <Text className="text-xl font-semibold text-gray-12 text-left mb-4">
          {t("appUpdate.forceUpdate.title")}
        </Text>

        <Text className="text-base text-gray-11 text-left mb-6">
          {t("appUpdate.forceUpdate.description")}
        </Text>

        <View className="gap-4">
          <Button variant="tertiary" xl onPress={handleGoToAppStore}>
            {t("appUpdate.forceUpdate.updateButton")}
          </Button>
          <Button variant="secondary" xl onPress={handleLater}>
            {t("appUpdate.forceUpdate.laterButton")}
          </Button>
        </View>
      </View>

      <ConfirmationModal
        visible={showSkipConfirmation}
        onClose={() => setShowSkipConfirmation(false)}
        title={t("appUpdate.forceUpdate.skipTitle")}
        message={t("appUpdate.forceUpdate.skipMessage")}
        confirmText={t("common.confirm")}
        cancelText={t("common.cancel")}
        onConfirm={handleConfirmSkip}
        destructive
      />
    </View>
  );
};

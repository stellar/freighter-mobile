import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { useAuthenticationStore } from "ducks/auth";
import { formatTimeAgo } from "helpers/date";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { analytics } from "services/analytics";
import { DEBUG_CONSTANTS } from "services/analytics/debug";

interface AnalyticsDebugBottomSheetProps {
  modalRef: React.RefObject<BottomSheetModal | null>;
  onDismiss: () => void;
}

const CustomContent: React.FC<{
  onDismiss: () => void;
}> = ({ onDismiss }) => {
  const [debugInfo, setDebugInfo] = useState(analytics.getAnalyticsDebugInfo());
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { logout, devResetAppAuth } = useAuthenticationStore();

  const handleRefresh = () => {
    setDebugInfo(analytics.getAnalyticsDebugInfo());
  };

  const handleClearEvents = () => {
    analytics.clearRecentEvents();

    setDebugInfo(analytics.getAnalyticsDebugInfo());
  };

  const handleSimulateSessionExpiry = () => {
    onDismiss();

    // Simulate session expiry by doing a partial logout
    // This keeps accounts but clears sensitive data, forcing re-authentication
    logout(false); // false = don't wipe all data, just expire session
  };

  const handleResetApp = () => {
    devResetAppAuth();
    onDismiss();
  };

  return (
    <View className="flex-1">
      <View className="flex-row justify-between items-center mb-4">
        <Text xl medium>
          {t("analytics.debug.title")}
        </Text>
        <TouchableOpacity onPress={onDismiss}>
          <Icon.X color={themeColors.text.primary} />
        </TouchableOpacity>
      </View>

      <BottomSheetScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View className="gap-3 mb-4">
          <Text lg medium>
            {t("analytics.debug.status")}
          </Text>
          <Button secondary sm onPress={handleResetApp} isFullWidth>
            {t("analytics.debug.resetApp")}
          </Button>
          <View className="flex-row gap-4">
            <View className="flex-1 p-3 rounded-lg bg-background-secondary">
              <Text
                sm
                medium
                color={
                  debugInfo.isEnabled
                    ? themeColors.status.success
                    : themeColors.status.error
                }
              >
                {debugInfo.isEnabled
                  ? t("analytics.debug.enabled")
                  : t("analytics.debug.disabled")}
              </Text>
            </View>
            <View className="flex-1 p-3 rounded-lg bg-background-secondary">
              <Text
                sm
                medium
                color={
                  debugInfo.hasInitialized
                    ? themeColors.status.success
                    : themeColors.status.warning
                }
              >
                {debugInfo.hasInitialized
                  ? t("analytics.debug.initialized")
                  : t("analytics.debug.notInitialized")}
              </Text>
            </View>
          </View>

          <View className="p-3 rounded-lg bg-background-secondary">
            <Text
              sm
              medium
              color={
                debugInfo.isSendingToAmplitude
                  ? themeColors.status.success
                  : themeColors.status.warning
              }
            >
              {debugInfo.isSendingToAmplitude
                ? t("analytics.debug.sending")
                : t("analytics.debug.notSending")}
            </Text>
          </View>

          {debugInfo.amplitudeKey === DEBUG_CONSTANTS.API_KEY_NOT_SET && (
            <View className="p-3 rounded-lg border-2 border-amber-500 bg-amber-50">
              <Text sm semiBold color={themeColors.status.warning}>
                {t("analytics.debug.apiKeyMissing")}
              </Text>
              <Text xs color={themeColors.status.warning}>
                {t("analytics.debug.apiKeyMissingWarning")}
              </Text>
            </View>
          )}

          <View className="gap-2">
            <Text sm secondary>
              {debugInfo.userId
                ? t("analytics.debug.userId", { userId: debugInfo.userId })
                : t("analytics.debug.userIdNotSet")}
            </Text>
            <Text sm secondary>
              {t("analytics.debug.environment", {
                environment: debugInfo.environment,
              })}
            </Text>
            <Text sm secondary>
              {t("analytics.debug.apiKey", { apiKey: debugInfo.amplitudeKey })}
            </Text>
          </View>
        </View>

        <View className="gap-3 mb-4">
          <View className="flex-row justify-between items-center">
            <Text lg medium>
              {t("analytics.debug.recentEvents", {
                count: debugInfo.recentEvents.length,
              })}
            </Text>
            {debugInfo.recentEvents.length > 0 && (
              <TouchableOpacity onPress={handleClearEvents}>
                <Text sm medium color={themeColors.status.error}>
                  {t("analytics.debug.clear")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {debugInfo.recentEvents.length === 0 ? (
            <View className="p-4 rounded-lg bg-background-secondary">
              <Text sm secondary textAlign="center">
                {t("analytics.debug.noRecentEvents")}
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {debugInfo.recentEvents.slice(0, 10).map((event) => (
                <View
                  key={`${event.event}-${event.timestamp}`}
                  className="p-3 rounded-lg bg-background-secondary"
                >
                  <View className="flex-row justify-between items-center mb-1">
                    <Text sm medium numberOfLines={1}>
                      {event.event}
                    </Text>
                    <Text xs secondary>
                      {formatTimeAgo(event.timestamp)}
                    </Text>
                  </View>
                  {event.props && Object.keys(event.props).length > 0 && (
                    <Text xs secondary numberOfLines={3}>
                      {JSON.stringify(event.props, null, 2)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="gap-3">
          <Text lg medium>
            {t("analytics.debug.actions")}
          </Text>
          <Button secondary sm onPress={handleRefresh} isFullWidth>
            {t("analytics.debug.refresh")}
          </Button>
          <Button
            secondary
            sm
            onPress={handleSimulateSessionExpiry}
            isFullWidth
          >
            {t("analytics.debug.simulateSessionExpiry")}
          </Button>
        </View>
        <View className="h-10" />
      </BottomSheetScrollView>
    </View>
  );
};

export const AnalyticsDebugBottomSheet: React.FC<
  AnalyticsDebugBottomSheetProps
> = ({ modalRef, onDismiss }) => {
  // Only render in development mode
  if (!__DEV__) {
    return null;
  }

  return (
    <BottomSheet
      modalRef={modalRef}
      handleCloseModal={onDismiss}
      snapPoints={["60%"]}
      enablePanDownToClose={false}
      enableDynamicSizing={false}
      useInsetsBottomPadding={false}
      customContent={<CustomContent onDismiss={onDismiss} />}
    />
  );
};

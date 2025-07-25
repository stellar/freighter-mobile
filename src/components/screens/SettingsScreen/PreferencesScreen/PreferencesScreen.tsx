import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { Toggle } from "components/sds/Toggle";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { useAnalyticsAndPermissions } from "hooks/useAnalyticsAndPermissions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useRef, useCallback, useEffect } from "react";
import { View, AppState } from "react-native";

type PreferencesScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.PREFERENCES_SCREEN
>;

const PreferencesScreen: React.FC<PreferencesScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const {
    isTrackingEnabled,
    handleAnalyticsToggleClick,
    syncTrackingPermission,
    isPermissionLoading,
  } = useAnalyticsAndPermissions();
  const isFocusedRef = useRef(false);

  const renderTrailingContent = () => {
    if (isPermissionLoading) {
      return <Spinner size="small" testID="analytics-toggle-loading" />;
    }

    return (
      <Toggle
        id="analytics-toggle"
        checked={isTrackingEnabled}
        onChange={() => {
          handleAnalyticsToggleClick();
        }}
      />
    );
  };

  // Sync tracking permission on screen focus and app state change
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;

      syncTrackingPermission();

      return () => {
        isFocusedRef.current = false;
      };
    }, [syncTrackingPermission]),
  );

  useEffect(() => {
    const handleAppStateChange = (state: string) => {
      if (state === "active" && isFocusedRef.current) {
        syncTrackingPermission();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => subscription.remove();
  }, [syncTrackingPermission]);

  const preferencesItems = [
    {
      title: t("preferences.anonymousDataSharing.title"),
      titleColor: themeColors.text.primary,
      description: t("preferences.anonymousDataSharing.description"),
      trailingContent: renderTrailingContent(),
      testID: "anonymous-data-sharing-item",
    },
  ];

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex gap-6 mt-4">
        <List items={preferencesItems} />
      </View>
    </BaseLayout>
  );
};

export default PreferencesScreen;

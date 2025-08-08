import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import PermissionModal from "components/screens/SettingsScreen/PreferencesScreen/PermissionModal";
import { Toggle } from "components/sds/Toggle";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { usePreferencesStore } from "ducks/preferences";
import { useAnalyticsPermissions } from "hooks/useAnalyticsPermissions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useRef, useCallback, useEffect, useMemo } from "react";
import { View, AppState, AppStateStatus } from "react-native";

interface PreferencesScreenProps
  extends NativeStackScreenProps<
    SettingsStackParamList,
    typeof SETTINGS_ROUTES.PREFERENCES_SCREEN
  > {}

interface PreferenceListItem {
  title: string;
  titleColor: string;
  description: string;
  trailingContent: React.ReactNode;
  testID: string;
}

const PreferencesScreen: React.FC<PreferencesScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const {
    isTrackingEnabled,
    handleAnalyticsToggle,
    syncTrackingPermission,
    isPermissionLoading,
    showPermissionModal,
    setShowPermissionModal,
    handleOpenSettings,
    permissionAction,
  } = useAnalyticsPermissions();
  const { isHideDustEnabled, setIsHideDustEnabled } = usePreferencesStore();

  const isScreenFocusedRef = useRef(false);

  const renderAnalyticsToggle = useCallback((): React.ReactNode => {
    if (isPermissionLoading) {
      return <Spinner size="small" testID="analytics-toggle-loading" />;
    }

    return (
      <Toggle
        id="analytics-toggle"
        checked={isTrackingEnabled}
        onChange={() => {
          handleAnalyticsToggle();
        }}
      />
    );
  }, [isPermissionLoading, isTrackingEnabled, handleAnalyticsToggle]);

  const renderHideDustToggle = useCallback(
    () => (
      <Toggle
        id="hide-dust-toggle"
        checked={isHideDustEnabled}
        onChange={() => {
          setIsHideDustEnabled(!isHideDustEnabled);
        }}
      />
    ),
    [isHideDustEnabled, setIsHideDustEnabled],
  );

  const handleAnalyticsPermissionOpenSettings = useCallback(() => {
    handleOpenSettings();
  }, [handleOpenSettings]);

  const preferencesItems: PreferenceListItem[] = useMemo(
    () => [
      {
        title: t("preferences.anonymousDataSharing.title"),
        titleColor: themeColors.text.primary,
        description: t("preferences.anonymousDataSharing.description"),
        trailingContent: renderAnalyticsToggle(),
        testID: "anonymous-data-sharing-item",
      },
      {
        title: t("preferences.hideDust.title"),
        titleColor: themeColors.text.primary,
        description: t("preferences.hideDust.description"),
        trailingContent: renderHideDustToggle(),
        testID: "hide-dust-item",
      },
    ],
    [t, themeColors.text.primary, renderAnalyticsToggle, renderHideDustToggle],
  );

  /**
   * Handles screen focus events to initialize permission sync.
   * Ensures permissions are up-to-date when user navigates to this screen.
   */
  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;

      syncTrackingPermission();

      return () => {
        isScreenFocusedRef.current = false;
      };
    }, [syncTrackingPermission]),
  );

  /**
   * Monitors app state changes for immediate device settings synchronization.
   *
   * When user returns from device settings, this ensures the UI immediately
   * reflects any permission changes made outside the app.
   * Only syncs when this screen is focused to avoid unnecessary operations.
   */
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      if (nextAppState === "active" && isScreenFocusedRef.current) {
        syncTrackingPermission();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => subscription.remove();
  }, [syncTrackingPermission]);

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex gap-6 mt-4">
        <List items={preferencesItems} />
      </View>

      <PermissionModal
        isModalVisible={showPermissionModal}
        setIsModalVisible={setShowPermissionModal}
        onOpenSettings={handleAnalyticsPermissionOpenSettings}
        isLoading={isPermissionLoading}
        action={permissionAction}
      />
    </BaseLayout>
  );
};

export default PreferencesScreen;

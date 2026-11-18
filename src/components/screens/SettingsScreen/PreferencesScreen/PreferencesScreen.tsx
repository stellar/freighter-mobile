import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import PermissionModal from "components/screens/SettingsScreen/PreferencesScreen/PermissionModal";
import Icon from "components/sds/Icon";
import { RadioButton } from "components/sds/RadioButton";
import { Toggle } from "components/sds/Toggle";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, FREIGHTER_PRIVACY_URL } from "config/constants";
import { logger } from "config/logger";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { THEME_PREFERENCES, ThemePreference } from "config/themePreference";
import { usePreferencesStore } from "ducks/preferences";
import { pxValue } from "helpers/dimensions";
import { useAnalyticsPermissions } from "hooks/useAnalyticsPermissions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useRef, useCallback, useEffect } from "react";
import {
  View,
  AppState,
  AppStateStatus,
  Pressable,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { selectThemePreference } from "services/themePreference";

interface PreferencesScreenProps
  extends NativeStackScreenProps<
    SettingsStackParamList,
    typeof SETTINGS_ROUTES.PREFERENCES_SCREEN
  > {}

// The design sets 14pt copy on a 20pt line; the sm token's default is 22.
const SMALL_LINE_HEIGHT = pxValue(20);

const SectionLabel: React.FC<{ children: string }> = ({ children }) => (
  <Text sm medium secondary style={{ lineHeight: SMALL_LINE_HEIGHT }}>
    {children}
  </Text>
);

const SettingRow: React.FC<{
  title: string;
  description: string;
  trailingContent: React.ReactNode;
  testID: string;
  children?: React.ReactNode;
}> = ({ title, description, trailingContent, testID, children }) => (
  <View testID={testID} className="flex-row items-start gap-[12px]">
    <View className="flex-1 gap-[6px]">
      <Text md semiBold>
        {title}
      </Text>
      <Text sm secondary style={{ lineHeight: SMALL_LINE_HEIGHT }}>
        {description}
      </Text>
      {children}
    </View>
    <View className="py-[2px]">{trailingContent}</View>
  </View>
);

const Divider: React.FC = () => <View className="h-[1px] bg-border-primary" />;

const PreferencesScreen: React.FC<PreferencesScreenProps> = () => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { themeColors } = useColors();
  const { open: openInAppBrowser } = useInAppBrowser();
  const themePreference = usePreferencesStore((state) => state.themePreference);

  const themeLabels: Record<ThemePreference, string> = {
    system: t("preferences.display.system"),
    light: t("preferences.display.light"),
    dark: t("preferences.display.dark"),
  };

  const handleOpenPrivacyPolicy = useCallback(() => {
    openInAppBrowser(FREIGHTER_PRIVACY_URL).catch((error) => {
      logger.error("PreferencesScreen", "Failed to open privacy policy", error);
    });
  }, [openInAppBrowser]);

  const handleThemeChange = useCallback((preference: ThemePreference) => {
    selectThemePreference(preference).catch((error) => {
      logger.error(
        "PreferencesScreen",
        "Failed to save theme preference",
        error,
      );
    });
  }, []);

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
  const {
    isHideDustEnabled,
    setIsHideDustEnabled,
    isMemoValidationEnabled,
    setIsMemoValidationEnabled,
  } = usePreferencesStore();

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

  const renderMemoValidationToggle = useCallback(
    () => (
      <Toggle
        id="memo-validation-toggle"
        checked={isMemoValidationEnabled}
        onChange={() => {
          setIsMemoValidationEnabled(!isMemoValidationEnabled);
        }}
      />
    ),
    [isMemoValidationEnabled, setIsMemoValidationEnabled],
  );

  const handleAnalyticsPermissionOpenSettings = useCallback(() => {
    handleOpenSettings();
  }, [handleOpenSettings]);

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
    <BaseLayout insets={{ top: false, bottom: false }}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View
          className="gap-[16px] mt-4"
          style={{ marginBottom: insets.bottom + pxValue(DEFAULT_PADDING) }}
        >
          <View className="gap-[8px]">
            <SectionLabel>{t("preferences.display.title")}</SectionLabel>
            <View
              className="bg-background-secondary rounded-[16px] p-4 flex-row flex-wrap gap-[12px]"
              accessibilityRole="radiogroup"
              accessibilityLabel={t("preferences.display.title")}
            >
              {THEME_PREFERENCES.map((preference) => (
                <RadioButton
                  key={preference}
                  testID={`theme-option-${preference}`}
                  label={themeLabels[preference]}
                  checked={themePreference === preference}
                  onPress={() => handleThemeChange(preference)}
                />
              ))}
            </View>
          </View>

          <View className="gap-[8px]">
            <SectionLabel>{t("preferences.security.title")}</SectionLabel>
            <View className="bg-background-secondary rounded-[16px] p-4 gap-[16px]">
              <SettingRow
                testID="hide-dust-item"
                title={t("preferences.hideDust.title")}
                description={t("preferences.hideDust.belowThreshold")}
                trailingContent={renderHideDustToggle()}
              />
              <Divider />
              <SettingRow
                testID="memo-validation-item"
                title={t("preferences.verifyAddresses.title")}
                description={t("preferences.verifyAddresses.description")}
                trailingContent={renderMemoValidationToggle()}
              />
              <Divider />
              <SettingRow
                testID="anonymous-data-sharing-item"
                title={t("preferences.usageDataSharing.title")}
                description={t("preferences.usageDataSharing.description")}
                trailingContent={renderAnalyticsToggle()}
              >
                <Pressable
                  testID="privacy-policy-link"
                  accessibilityRole="link"
                  onPress={handleOpenPrivacyPolicy}
                  className="flex-row items-center gap-[4px] self-start pb-[6px]"
                >
                  <Text
                    sm
                    semiBold
                    color={themeColors.lilac[9]}
                    style={{ lineHeight: SMALL_LINE_HEIGHT, flexShrink: 1 }}
                  >
                    {t("preferences.usageDataSharing.learnMore")}
                  </Text>
                  <Icon.LinkExternal01 size={14} color={themeColors.lilac[9]} />
                </Pressable>
              </SettingRow>
            </View>
          </View>
        </View>
      </ScrollView>

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

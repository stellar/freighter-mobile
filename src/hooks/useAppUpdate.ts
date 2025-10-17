import { logger } from "config/logger";
import { useDebugStore } from "ducks/debug";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { getAppUpdateText } from "helpers/appUpdateText";
import { isIOS } from "helpers/device";
import { isDev } from "helpers/isEnv";
import { isVersionBelow } from "helpers/versionComparison";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useCallback } from "react";
import { Linking } from "react-native";
import { getBundleId, getVersion } from "react-native-device-info";

const IOS_APP_STORE_URL = "https://apps.apple.com/app/freighter/id6743947720";
const ANDROID_APP_STORE_URL = `https://play.google.com/store/apps/details?id=${getBundleId()}`;

/**
 * Hook to manage app update logic and UI state
 */
export const useAppUpdate = () => {
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const {
    required_app_version: requiredAppVersion,
    latest_app_version: latestAppVersion,
    app_update_text: updateText,
    isInitialized,
  } = useRemoteConfigStore();
  const { overriddenAppVersion } = useDebugStore();

  const currentVersion =
    isDev && overriddenAppVersion ? overriddenAppVersion : getVersion();

  // Parse the update text JSON for internationalization
  const updateMessage = getAppUpdateText(updateText);

  // Only check for updates when remote config is initialized
  // Forced update: when current version is below required version
  const needsForcedUpdate =
    isInitialized && isVersionBelow(currentVersion, requiredAppVersion);

  // Optional update: when current version is below latest but above required (for banner)
  const needsOptionalUpdate =
    isInitialized &&
    !needsForcedUpdate &&
    isVersionBelow(currentVersion, latestAppVersion);

  const getAppStoreUrl = useCallback(
    () =>
      isIOS
        ? IOS_APP_STORE_URL // iOS is using TestFlight for development builds - not able to generate a programatic link
        : ANDROID_APP_STORE_URL,
    [],
  );

  const openAppStore = useCallback(async () => {
    try {
      const url = getAppStoreUrl();
      await Linking.openURL(url);
    } catch (error) {
      logger.error("useAppUpdate", "Failed to open app store", error);
      showToast({
        variant: "error",
        title: t("common.error", {
          errorMessage:
            error instanceof Error ? error.message : t("common.unknownError"),
        }),
        duration: 3000,
      });
    }
  }, [getAppStoreUrl, showToast, t]);

  return {
    currentVersion,
    requiredVersion: requiredAppVersion,
    latestVersion: latestAppVersion,
    updateMessage,
    needsForcedUpdate,
    needsOptionalUpdate,
    openAppStore,
  };
};

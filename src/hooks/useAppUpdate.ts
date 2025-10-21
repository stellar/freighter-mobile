import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { useAppUpdateStore } from "ducks/appUpdate";
import { useDebugStore } from "ducks/debug";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { appUpdateBannerText } from "helpers/appUpdateBannerText";
import { isIOS } from "helpers/device";
import { isDev } from "helpers/isEnv";
import { isVersionBelow } from "helpers/versionComparison";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { getBundleId, getVersion } from "react-native-device-info";

const IOS_APP_STORE_URL = "https://apps.apple.com/app/freighter/id6743947720";
const ANDROID_APP_STORE_URL = `https://play.google.com/store/apps/details?id=${getBundleId()}`;

const APP_STORE_URL = isIOS ? IOS_APP_STORE_URL : ANDROID_APP_STORE_URL;

/**
 * Hook to manage app update logic and UI state
 */
export const useAppUpdate = () => {
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const {
    required_app_version: requiredAppVersion,
    latest_app_version: latestAppVersion,
    app_update_banner_text: updateText,
    isInitialized,
  } = useRemoteConfigStore();
  const { overriddenAppVersion } = useDebugStore();

  const currentVersion =
    isDev && overriddenAppVersion ? overriddenAppVersion : getVersion();

  const updateMessage = appUpdateBannerText(updateText);

  const {
    currentSessionNoticeDismissed,
    dismissFullScreenNotice: dismissFullScreenNoticeAction,
  } = useAppUpdateStore();

  const [dismissedRequiredVersion, setDismissedRequiredVersion] = useState<
    string | null
  >(null);
  const [isFlagLoaded, setIsFlagLoaded] = useState(false);

  useEffect(() => {
    /**
     * Waits for flag to be loaded from AsyncStorage. If no flag is available, it means the user has never dismissed the app update full screen notice.
     * If a flag is available, it will check for the version that the user has dismissed. e.g. Dismissed on app version 1.4.23 and required 1.6.23, it will not show again until user updates to 1.6.23
     * If user updates to 1.6.23 and then falls behind again (e.g. app is on required version 1.7.23), it will show again until user dismisses it again.
     */
    const loadDismissed = async () => {
      try {
        const stored = await AsyncStorage.getItem(
          STORAGE_KEYS.APP_UPDATE_DISMISSED_REQUIRED_VERSION,
        );
        setDismissedRequiredVersion(stored);
        setIsFlagLoaded(true);
      } catch (error) {
        logger.error("useAppUpdate", "Failed to read dismissed version", error);
        setIsFlagLoaded(true);
      }
    };
    loadDismissed();
  }, []);

  const hasDismissedCurrentVersion =
    dismissedRequiredVersion === currentVersion;

  const isBelowRequired =
    isInitialized && isVersionBelow(currentVersion, requiredAppVersion);
  const isBelowLatest =
    isInitialized && isVersionBelow(currentVersion, latestAppVersion);

  const showFullScreenUpdateNotice =
    isBelowRequired && !hasDismissedCurrentVersion;

  const showBannerUpdateNotice =
    isFlagLoaded &&
    !showFullScreenUpdateNotice &&
    !currentSessionNoticeDismissed &&
    isBelowLatest;

  const openAppStore = async () => {
    try {
      await Linking.openURL(APP_STORE_URL);
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
  };

  const dismissFullScreenNotice = async () => {
    try {
      dismissFullScreenNoticeAction();
      setDismissedRequiredVersion(currentVersion);
      await AsyncStorage.setItem(
        STORAGE_KEYS.APP_UPDATE_DISMISSED_REQUIRED_VERSION,
        currentVersion,
      );
    } catch (error) {
      logger.error(
        "useAppUpdate",
        "Failed to dismiss full screen notice",
        error,
      );
    }
  };

  return {
    currentVersion,
    requiredVersion: requiredAppVersion,
    latestVersion: latestAppVersion,
    updateMessage,
    showFullScreenUpdateNotice,
    showBannerUpdateNotice,
    openAppStore,
    dismissFullScreenNotice,
  };
};

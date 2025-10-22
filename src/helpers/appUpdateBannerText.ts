import { getDeviceLanguage } from "helpers/localeUtils";
import { t } from "i18next";

/**
 * Helper function to get app update text from payload or fallback to translations
 * @param appUpdateText - The app update text object with enabled and payload
 * @returns The localized update text
 */
export const appUpdateBannerText = (appUpdateText: {
  enabled: boolean;
  payload: Record<string, string> | undefined;
}): string => {
  // If not enabled or no payload, use translation fallback
  if (!appUpdateText.enabled || !appUpdateText.payload) {
    return t("appUpdate.defaultMessage");
  }

  // Get current device language
  const currentLanguage = getDeviceLanguage();

  // Try current language, then English, then fallback to translation
  return (
    appUpdateText.payload[currentLanguage] ||
    appUpdateText.payload.en ||
    t("appUpdate.defaultMessage")
  );
};

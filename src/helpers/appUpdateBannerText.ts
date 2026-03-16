import { getDeviceLanguage } from "helpers/localeUtils";
import { t } from "i18next";

/**
 * Helper function to get app update text from payload or fallback to translations
 * @param appUpdateText - The app update text object with enabled and payload
 * @returns The localized update text
 */
export const appUpdateBannerText = (appUpdateText: {
  enabled: boolean;
  payload: Record<string, unknown> | undefined;
}): string => {
  // If not enabled or no payload, use translation fallback
  if (!appUpdateText.enabled || !appUpdateText.payload) {
    return t("appUpdate.defaultMessage");
  }

  // Get current device language
  const currentLanguage = getDeviceLanguage();

  // The app_update_banner_text payload is a flat map of language code -> message string
  const { payload } = appUpdateText;
  const candidate = payload[currentLanguage] ?? payload.en;

  // Try current language, then English, then fallback to translation
  return typeof candidate === "string"
    ? candidate
    : t("appUpdate.defaultMessage");
};

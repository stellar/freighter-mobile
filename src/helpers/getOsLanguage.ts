import { I18nManager, Platform, Settings } from "react-native";

/**
 * Retrieves the current operating system language as a two-letter language code
 *
 * This function detects the device's language setting and returns it as an ISO 639-1
 * two-letter language code (e.g., 'en', 'fr', 'ja'). The implementation varies by platform
 * to accommodate the different ways Android and iOS expose language settings.
 *
 * @returns {string | undefined} Two-letter language code or 'en' as fallback
 *
 * @example
 * // Get the user's OS language
 * const language = getOSLanguage(); // Returns 'en', 'fr', etc.
 *
 * // Use the language for localization
 * const message = language === 'fr' ? 'Bonjour' : 'Hello';
 */
function getOSLanguage(): string | undefined {
  if (Platform.OS === "android") {
    const locale = I18nManager.getConstants().localeIdentifier;

    if (locale) {
      return locale.substring(0, 2);
    }
  }

  if (Platform.OS === "ios") {
    const deviceLanguage =
      (Settings.get("AppleLocale") as string) ||
      (Settings.get("AppleLanguages") as string[])[0];

    if (deviceLanguage) {
      return deviceLanguage.substring(0, 2);
    }
  }

  return "en";
}

export default getOSLanguage;

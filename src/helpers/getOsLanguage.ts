import { I18nManager, Platform, Settings } from "react-native";

/**
 * Retrieves the current operating system language as a two-letter language code
 *
 * This function detects the device's language setting and returns it as an ISO 639-1
 * two-letter language code (e.g., 'en', 'fr', 'ja'). The implementation varies by platform
 * to accommodate the different ways Android and iOS expose language settings.
 *
 * @returns {string} Two-letter language code or 'en' as fallback
 *
 * @example
 * // Get the user's OS language
 * const language = getOSLanguage(); // Returns 'en', 'fr', etc.
 *
 * // Use the language for localization
 * const message = language === 'fr' ? 'Bonjour' : 'Hello';
 */
function getOSLanguage(): string {
  let language = "en"; // fallback

  if (Platform.OS === "android") {
    const androidLocale = I18nManager.getConstants().localeIdentifier;
    if (androidLocale) {
      // Extract language code from locale (e.g., 'en-US' -> 'en')
      language = androidLocale.substring(0, 2);
    }
  }

  if (Platform.OS === "ios") {
    const deviceLanguage =
      (Settings.get("AppleLocale") as string) ||
      (Settings.get("AppleLanguages") as string[])[0];

    if (deviceLanguage) {
      // Extract language code from locale (e.g., 'en-US' -> 'en')
      language = deviceLanguage.substring(0, 2);
    }
  }

  return language;
}

export default getOSLanguage;

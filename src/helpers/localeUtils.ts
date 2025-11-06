import { I18nManager, Platform, Settings } from "react-native";

const SUPPORTED_LANGUAGES = ["pt", "en"];

export const isSupportedLanguage = (language: string): boolean =>
  SUPPORTED_LANGUAGES.includes(language);

/**
 * Retrieves the current device language as a two-letter language code
 *
 * This function detects the device's language setting and returns it as an ISO 639-1
 * two-letter language code (e.g., 'en', 'pt'). The implementation varies by platform
 * to accommodate the different ways Android and iOS expose language settings.
 *
 * @returns {string} Two-letter language code or 'en' as fallback
 *
 * @example
 * // Get the user's device language
 * const language = getDeviceLanguage(); // Returns 'en', 'pt', etc.
 *
 * // Use the language for localization
 */
export function getDeviceLanguage(): string {
  let locale = "en"; // fallback

  if (Platform.OS === "android") {
    const androidLocale = I18nManager.getConstants().localeIdentifier;
    if (androidLocale) {
      locale = androidLocale;
    }
  }

  if (Platform.OS === "ios") {
    const deviceLanguage =
      (Settings.get("AppleLocale") as string) ||
      (Settings.get("AppleLanguages") as string[])[0];

    if (deviceLanguage) {
      locale = deviceLanguage;
    }
  }

  // Normalize locale format: convert underscores to hyphens for BCP 47 compliance
  // e.g., "en_US" -> "en-US", "de_DE" -> "de-DE"
  const normalizedLocale = locale.replace(/_/g, "-");

  // Extract language code from locale (e.g., 'en-US' -> 'en', 'pt-BR' -> 'pt')
  const languageCode = normalizedLocale.substring(0, 2);

  if (!isSupportedLanguage(languageCode)) {
    return "en";
  }

  return languageCode;
}

import { I18nManager, Platform, Settings } from "react-native";

const SUPPORTED_LOCALES = ["en-US", "pt-BR"];

export const isSupportedLocale = (locale: string): boolean => {
  return SUPPORTED_LOCALES.includes(locale);
  return SUPPORTED_LOCALES.includes(locale);
};

/**
 * Retrieves the current operating system locale identifier
 *
 * This function detects the device's full locale setting and returns it as a locale identifier
 * (e.g., 'en-US', 'fr-FR', 'de-DE'). This is used for locale-aware number formatting.
 * Normalizes locale format from native modules (en_US) to BCP 47 format (en-US).
 *
 * @returns {string} Full locale identifier or 'en-US' as fallback
 *
 * @example
 * // Get the user's OS locale
 * const locale = getOSLocale(); // Returns 'en-US', 'de-DE', etc.
 *
 * // Use for number formatting
 * const formatted = number.toLocaleString(locale);
 */
export function getOSLocale(): string {
  let locale = "en-US"; // fallback

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

    if (!isSupportedLocale(locale)) {
      locale = "en-US";
    }
  }

  // Normalize locale format: convert underscores to hyphens for BCP 47 compliance
  // e.g., "en_US" -> "en-US", "de_DE" -> "de-DE"
  return locale.replace(/_/g, "-");
}

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
 */
function getOSLanguage(): string {
  const locale = getOSLocale();
  // Extract language code from locale (e.g., 'en-US' -> 'en')
  return locale.substring(0, 2);
}

export default getOSLanguage;

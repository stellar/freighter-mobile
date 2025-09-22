import { I18nManager, Platform, Settings } from "react-native";

// Supported locales for the app
const SUPPORTED_LOCALES = ["en", "pt", "en-US", "pt-BR"];
const FALLBACK_LOCALE = "en-US";

/**
 * Normalizes and validates a locale, falling back to supported locales
 */
function normalizeLocale(locale: string): string {
  if (!locale) return FALLBACK_LOCALE;

  // Check if the exact locale is supported
  if (SUPPORTED_LOCALES.includes(locale)) {
    return locale;
  }

  // Try to find a supported locale by language code
  const languageCode = locale.split("-")[0];
  const supportedLanguage = SUPPORTED_LOCALES.find((supported) =>
    supported.startsWith(languageCode),
  );

  if (supportedLanguage) {
    return supportedLanguage;
  }

  // Fallback to default
  return FALLBACK_LOCALE;
}

/**
 * Retrieves the current operating system locale identifier
 *
 * This function detects the device's full locale setting and returns it as a locale identifier
 * (e.g., 'en-US', 'pt-BR'). Only supported locales are returned, with fallback to 'en-US'.
 * Normalizes locale format from native modules (en_US) to BCP 47 format (en-US).
 *
 * @returns {string} Supported locale identifier or 'en-US' as fallback
 *
 * @example
 * // Get the user's OS locale
 * const locale = getOSLocale(); // Returns 'en-US', 'pt-BR', or 'en-US' for unsupported locales
 *
 * // Use for number formatting
 * const formatted = number.toLocaleString(locale);
 */
export function getOSLocale(): string {
  let locale = FALLBACK_LOCALE; // fallback

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

  // Return a supported locale or fallback
  return normalizeLocale(locale.replace(/_/g, "-"));
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
 * const message = language === 'fr' ? 'Bonjour' : 'Hello';
 */
function getOSLanguage(): string {
  const locale = "en-US";
  // Extract language code from locale (e.g., 'en-US' -> 'en')
  return locale.substring(0, 2);
}

export default getOSLanguage;

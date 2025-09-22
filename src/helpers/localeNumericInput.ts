import { getOSLocale } from "helpers/getOsLanguage";

/**
 * Gets the decimal separator for the current locale
 */
export const getDecimalSeparator = (): string => {
  try {
    const locale = getOSLocale();
    const formatter = new Intl.NumberFormat(locale);
    const parts = formatter.formatToParts(1.1);
    const decimalPart = parts.find((part) => part.type === "decimal");
    return decimalPart?.value || ".";
  } catch (error) {
    console.warn(
      'Failed to get decimal separator, falling back to ".":',
      error,
    );
    return ".";
  }
};

/**
 * Gets the group separator (thousands separator) for the current locale
 */
export const getGroupSeparator = (): string => {
  try {
    const locale = getOSLocale();
    const formatter = new Intl.NumberFormat(locale);
    const parts = formatter.formatToParts(1000);
    const groupPart = parts.find((part) => part.type === "group");
    return groupPart?.value || ",";
  } catch (error) {
    console.warn('Failed to get group separator, falling back to ",":', error);
    return ",";
  }
};

/**
 * Parses a locale-formatted number string back to a number
 * Handles different decimal separators (e.g., "1,23" in German vs "1.23" in English)
 */
export const parseLocaleNumber = (value: string): number => {
  if (!value || value.trim() === "") {
    return 0;
  }

  try {
    const locale = getOSLocale();
    const formatter = new Intl.NumberFormat(locale);
    const parts = formatter.formatToParts(1000.1);

    const groupSeparator =
      parts.find((part) => part.type === "group")?.value || ",";
    const decimalSeparator =
      parts.find((part) => part.type === "decimal")?.value || ".";

    // Remove group separators and replace decimal separator with standard dot
    let normalizedValue = value
      .replace(new RegExp(`\\${groupSeparator}`, "g"), "") // Remove group separators
      .replace(new RegExp(`\\${decimalSeparator}`, "g"), "."); // Replace decimal separator with dot

    return parseFloat(normalizedValue);
  } catch (error) {
    console.warn(
      "Failed to parse locale number, falling back to parseFloat:",
      error,
    );
    return parseFloat(value.replace(/,/g, ""));
  }
};

/**
 * Formats a number using the current locale's formatting rules
 */
export const formatLocaleNumber = (
  value: number,
  options: Intl.NumberFormatOptions = {},
): string => {
  const locale = getOSLocale();
  const formatter = new Intl.NumberFormat(locale, options);
  return formatter.format(value);
};

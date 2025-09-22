import BigNumber from "bignumber.js";
import { getOSLocale } from "helpers/getOsLanguage";

/**
 * Converts various input types to a BigNumber instance for consistent handling of numeric values
 *
 * @param {string | number | BigNumber | { toString: () => string }} value - The value to convert to BigNumber
 * @returns {BigNumber} A BigNumber instance representing the input value
 *
 * @example
 * convertToBigNumber(123); // Returns BigNumber(123)
 * convertToBigNumber("123.45"); // Returns BigNumber(123.45)
 * convertToBigNumber(new BigNumber("123.45")); // Returns the same BigNumber instance
 * convertToBigNumber({ toString: () => "123.45" }); // Returns BigNumber(123.45)
 */
const convertToBigNumber = (
  value: string | number | BigNumber | { toString: () => string },
): BigNumber => {
  if (typeof value === "number") {
    return new BigNumber(value);
  }

  if (value instanceof BigNumber) {
    return value;
  }

  return new BigNumber(value.toString());
};

/**
 * Formats a numeric value as a human-readable token amount with optional token code
 *
 * This function formats numbers with thousand separators and appropriate decimal places
 * for displaying token amounts in the UI.
 *
 * @param {string | number | { toString: () => string }} amount - The amount to format
 * @param {string} [code] - Optional token code to append to the formatted amount
 * @returns {string} Formatted token amount string with optional token code
 *
 * @example
 * formatTokenAmount(1234.56); // Returns "1,234.56"
 * formatTokenAmount("1234.56789"); // Returns "1,234.56789"
 * formatTokenAmount(1234.56, "XLM"); // Returns "1,234.56 XLM"
 */
export const formatTokenAmount = (
  amount: string | number | { toString: () => string },
  code?: string,
  locale?: string,
) => {
  const bnAmount = convertToBigNumber(amount);
  const deviceLocale = locale || getOSLocale();

  const formatter = new Intl.NumberFormat(deviceLocale, {
    useGrouping: true,
    minimumFractionDigits: 2, // Always show at least 2 decimal places
    maximumFractionDigits: 20, // Support high precision if needed
  });

  // Format the number and remove unnecessary trailing zeros
  const formattedAmount = formatter.format(bnAmount.toNumber());

  // Return the formatted amount with the token code if provided
  return code ? `${formattedAmount} ${code}` : formattedAmount;
};

/**
 * Formats a numeric value as a currency amount in USD
 *
 * This function formats numbers as USD currency values with the $ symbol,
 * thousand separators, and exactly 2 decimal places.
 *
 * @param {string | number | { toString: () => string }} amount - The amount to format as currency
 * @returns {string} Formatted currency string (e.g., "$1,234.56")
 *
 * @example
 * formatFiatAmount(1234.56); // Returns "$1,234.56"
 * formatFiatAmount("1234.5"); // Returns "$1,234.50"
 * formatFiatAmount(0.1); // Returns "$0.10"
 */
export const formatFiatAmount = (
  amount: string | number | { toString: () => string },
) => {
  // Convert input to a number
  const numericAmount =
    typeof amount === "number" ? amount : parseFloat(amount.toString());

  // Format as USD currency with 2 decimal places
  return new Intl.NumberFormat(getOSLocale(), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
};

/**
 * Formats a numeric value as a percentage with sign indicator
 *
 * This function formats numbers with 2 decimal places and adds a percentage symbol.
 * Positive numbers are prefixed with a '+' sign, and negative numbers with a '-' sign.
 *
 * @param {string | number | { toString: () => string }} [amount] - The amount to format as percentage
 * @returns {string} Formatted percentage string with sign (e.g., "+1.23%" or "-1.23%")
 *
 * @example
 * formatPercentageAmount(1.23); // Returns "+1.23%"
 * formatPercentageAmount(-1.23); // Returns "-1.23%"
 * formatPercentageAmount(0); // Returns "0.00%"
 * formatPercentageAmount(); // Returns "--"
 */
export const formatPercentageAmount = (
  amount?: string | number | { toString: () => string } | null,
  locale?: string,
): string => {
  if (amount === null || amount === undefined) {
    return "--";
  }

  const bnAmount = convertToBigNumber(amount);
  const deviceLocale = locale || getOSLocale();

  // Format the number with exactly 2 decimal places using locale-aware formatting
  const formatter = new Intl.NumberFormat(deviceLocale, {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedNumber = formatter.format(bnAmount.toNumber());

  // Add the appropriate sign and percentage symbol
  if (bnAmount.gt(0)) {
    return `+${formattedNumber}%`;
  }

  // BigNumber already includes the negative sign in formattedNumber
  return `${formattedNumber}%`;
};

/**
 * Gets the decimal separator used by the device's locale
 *
 * @param {string} [locale] - Optional locale override; uses device locale by default
 * @returns {string} The decimal separator character ("." or ",")
 *
 * @example
 * getLocaleDecimalSeparator(); // Returns "." (en-US) or "," (de-DE)
 */
export const getLocaleDecimalSeparator = (locale?: string): string => {
  const deviceLocale = locale || getOSLocale();

  const formatter = new Intl.NumberFormat(deviceLocale);
  const parts = formatter.formatToParts(1.1); // dummy value to get the decimal separator
  const decimalPart = parts.find((part) => part.type === "decimal");
  return decimalPart?.value || ".";
};

/**
 * Parses a numeric string or BigNumber that may use locale-specific decimal separators
 *
 * This function normalizes locale-specific decimal input (e.g., "1,23" or "1.23")
 * to a standard JavaScript number. It handles both comma and dot as decimal separators,
 * and can also process BigNumber instances.
 *
 * @param {string | BigNumber} input - The numeric string or BigNumber to parse
 * @param {string} [locale] - Optional locale override; uses device locale by default
 * @returns {number} The parsed number
 *
 * @example
 * parseLocaleNumber("1,23"); // Returns 1.23 (handles comma decimal separator)
 * parseLocaleNumber("1.23"); // Returns 1.23 (handles dot decimal separator)
 * parseLocaleNumber("1,234.56"); // Returns 1234.56 (handles thousands separator)
 * parseLocaleNumber(new BigNumber("1.23")); // Returns 1.23 (handles BigNumber)
 */
export const parseLocaleNumber = (
  input: string | BigNumber,
  locale?: string,
): number => {
  // Handle BigNumber instances
  if (input instanceof BigNumber) {
    return input.toNumber();
  }

  if (!input || input === "") return 0;

  const deviceLocale = locale || getOSLocale();

  try {
    const formatter = new Intl.NumberFormat(deviceLocale);
    const parts = formatter.formatToParts(12345.6);

    const thousandSeparator =
      parts.find((part) => part.type === "group")?.value || ",";
    const decimalSeparator =
      parts.find((part) => part.type === "decimal")?.value || ".";

    // Remove thousand separators and normalize decimal separator to dot
    const normalized = input
      .replace(new RegExp(`\\${thousandSeparator}`, "g"), "")
      .replace(new RegExp(`\\${decimalSeparator}`), ".");

    return parseFloat(normalized) || 0;
  } catch (error) {
    // Fallback: try to handle both comma and dot as decimal separators
    const normalized = input
      .replace(/,/g, ".") // Convert comma to dot
      .replace(/[^\d.-]/g, ""); // Remove any non-numeric characters except dot and minus

    return parseFloat(normalized) || 0;
  }
};

/**
 * Parses a locale-formatted numeric string to a BigNumber instance
 *
 * This function is useful when you need to maintain precision and work with BigNumber
 * arithmetic operations while handling locale-specific input formatting.
 *
 * @param {string | BigNumber} input - The locale-formatted numeric string or BigNumber to parse
 * @param {string} [locale] - Optional locale override; uses device locale by default
 * @returns {BigNumber} A BigNumber instance representing the parsed value
 *
 * @example
 * parseLocaleNumberToBigNumber("1,23", "pt-BR"); // Returns BigNumber(1.23)
 * parseLocaleNumberToBigNumber("1.234,56", "de-DE"); // Returns BigNumber(1234.56)
 * parseLocaleNumberToBigNumber("1,234.56", "en-US"); // Returns BigNumber(1234.56)
 * parseLocaleNumberToBigNumber(new BigNumber("1.23")); // Returns BigNumber(1.23)
 */
export const parseLocaleNumberToBigNumber = (
  input: string | BigNumber,
  locale?: string,
): BigNumber => {
  // Handle BigNumber instances
  if (input instanceof BigNumber) {
    return input;
  }

  if (!input) {
    return new BigNumber(0);
  }

  const deviceLocale = locale || getOSLocale();

  try {
    const formatter = new Intl.NumberFormat(deviceLocale);
    const parts = formatter.formatToParts(12345.6);

    const thousandSeparator =
      parts.find((part) => part.type === "group")?.value || ",";
    const decimalSeparator =
      parts.find((part) => part.type === "decimal")?.value || ".";

    // Remove thousand separators and normalize decimal separator to dot
    const normalized = input
      .replace(new RegExp(`\\${thousandSeparator}`, "g"), "")
      .replace(new RegExp(`\\${decimalSeparator}`), ".");

    return new BigNumber(normalized);
  } catch (error) {
    // Fallback: try to handle both comma and dot as decimal separators
    const normalized = input
      .replace(/,/g, ".") // Convert comma to dot
      .replace(/[^\d.-]/g, ""); // Remove any non-numeric characters except dot and minus

    return new BigNumber(normalized);
  }
};

/**
 * Formats a numeric string value with locale-aware decimal separators
 *
 * This function takes any numeric string and formats it according to the user's locale.
 * Useful for displaying numeric values like fees, prices, or any decimal numbers in the correct format.
 *
 * @param {string | BigNumber} numericValue - The numeric value to format (e.g., "0.00001", "1.5", "123.456", or BigNumber instance)
 * @param {string} [locale] - Optional locale override; uses device locale by default
 * @returns {string} Formatted number with locale-appropriate decimal separator
 *
 * @example
 * formatNumberForLocale("0.00001"); // Returns "0.00001" (en-US) or "0,00001" (de-DE)
 * formatNumberForLocale("1.5", "pt-BR"); // Returns "1,5"
 * formatNumberForLocale("123.456"); // Returns "123.456" (en-US) or "123,456" (de-DE)
 * formatNumberForLocale(new BigNumber("1.5"), "pt-BR"); // Returns "1,5"
 */
export const formatNumberForLocale = (
  numericValue: string | BigNumber,
  locale?: string,
): string => {
  const deviceLocale = locale || getOSLocale();

  try {
    // Handle BigNumber instances
    const valueAsString =
      numericValue instanceof BigNumber
        ? numericValue.toString()
        : numericValue;

    const parsedValue = parseFloat(valueAsString);
    if (Number.isNaN(parsedValue)) {
      return valueAsString; // Return original if not a valid number
    }

    const formatter = new Intl.NumberFormat(deviceLocale, {
      useGrouping: false, // Don't add thousands separators for constants
      minimumFractionDigits: 0,
      maximumFractionDigits: 20, // Support high precision
    });

    return formatter.format(parsedValue);
  } catch (error) {
    // Fallback: manually replace dot with locale decimal separator
    const valueAsString =
      numericValue instanceof BigNumber
        ? numericValue.toString()
        : numericValue;
    const decimalSeparator = getLocaleDecimalSeparator(deviceLocale);
    return valueAsString.replace(".", decimalSeparator);
  }
};

/**
 * Formats a BigNumber with locale-aware decimal separators and proper precision handling
 *
 * This function is optimized for BigNumber instances and preserves their precision
 * while applying locale-specific formatting.
 *
 * @param {BigNumber} bigNumberValue - The BigNumber instance to format
 * @param {object} [options] - Formatting options
 * @param {string} [options.locale] - Optional locale override; uses device locale by default
 * @param {number} [options.decimalPlaces] - Number of decimal places to display
 * @param {boolean} [options.useGrouping] - Whether to use thousands separators (default: false)
 * @returns {string} Formatted number with locale-appropriate decimal separator
 *
 * @example
 * formatBigNumberForLocale(new BigNumber("1234.56789")); // Returns "1234.56789" (en-US) or "1234,56789" (de-DE)
 * formatBigNumberForLocale(new BigNumber("1234.56789"), { decimalPlaces: 2 }); // Returns "1234.57" (en-US) or "1234,57" (de-DE)
 * formatBigNumberForLocale(new BigNumber("1234.56"), { useGrouping: true }); // Returns "1,234.56" (en-US) or "1.234,56" (de-DE)
 */
export const formatBigNumberForLocale = (
  bigNumberValue: BigNumber,
  options: {
    locale?: string;
    decimalPlaces?: number;
    useGrouping?: boolean;
  } = {},
): string => {
  const { locale, decimalPlaces, useGrouping = false } = options;
  const deviceLocale = locale || getOSLocale();

  try {
    // Use BigNumber's precise string representation
    const valueString =
      decimalPlaces !== undefined
        ? bigNumberValue.toFixed(decimalPlaces)
        : bigNumberValue.toString();

    const numericValue = parseFloat(valueString);

    if (Number.isNaN(numericValue)) {
      return valueString;
    }

    const formatter = new Intl.NumberFormat(deviceLocale, {
      useGrouping,
      minimumFractionDigits: 0,
      maximumFractionDigits: decimalPlaces ?? 20,
    });

    return formatter.format(numericValue);
  } catch (error) {
    // Fallback: manually replace dot with locale decimal separator
    const valueString =
      decimalPlaces !== undefined
        ? bigNumberValue.toFixed(decimalPlaces)
        : bigNumberValue.toString();
    const decimalSeparator = getLocaleDecimalSeparator(deviceLocale);
    return valueString.replace(".", decimalSeparator);
  }
};

export const stroopToXlm = (
  stroops: BigNumber | string | number,
): BigNumber => {
  if (stroops instanceof BigNumber) {
    return stroops.dividedBy(1e7);
  }
  return new BigNumber(Number(stroops) / 1e7);
};

export const xlmToStroop = (lumens: BigNumber | string): BigNumber => {
  if (lumens instanceof BigNumber) {
    return lumens.times(1e7);
  }
  // round to nearest stroop
  return new BigNumber(Math.round(Number(lumens) * 1e7));
};

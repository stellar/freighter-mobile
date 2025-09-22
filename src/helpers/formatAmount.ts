import BigNumber from "bignumber.js";
import { getNumberFormatSettings } from "react-native-localize";

/**
 * Gets the number format settings from react-native-localize
 */
const getFormatSettings = () => {
  const { decimalSeparator, groupingSeparator } = getNumberFormatSettings();
  return { decimalSeparator, groupingSeparator };
};

/**
 * Formats a number using react-native-localize settings
 */
const formatNumberWithLocale = (
  value: number,
  options: {
    useGrouping?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {},
): string => {
  const { decimalSeparator, groupingSeparator } = getFormatSettings();
  const {
    useGrouping = true,
    minimumFractionDigits = 0,
    maximumFractionDigits = 7,
  } = options;

  // Convert to string with proper decimal places
  const fixedValue = value.toFixed(maximumFractionDigits);
  const [integerPart, decimalPart] = fixedValue.split(".");

  // Add grouping separators if needed
  let formattedInteger = integerPart;
  if (useGrouping && integerPart.length > 3) {
    formattedInteger = integerPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      groupingSeparator,
    );
  }

  // Handle decimal part
  if (decimalPart && decimalPart !== "0".repeat(decimalPart.length)) {
    // Remove trailing zeros but keep minimum fraction digits
    let trimmedDecimal = decimalPart.replace(/0+$/, "");
    if (trimmedDecimal.length < minimumFractionDigits) {
      trimmedDecimal = decimalPart.substring(0, minimumFractionDigits);
    }
    return `${formattedInteger}${decimalSeparator}${trimmedDecimal}`;
  }

  // Add minimum fraction digits if needed
  if (minimumFractionDigits > 0) {
    const zeros = "0".repeat(minimumFractionDigits);
    return `${formattedInteger}${decimalSeparator}${zeros}`;
  }

  return formattedInteger;
};

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
 * for displaying token amounts in the UI. Uses react-native-localize for consistent
 * decimal and thousands separators based on device settings.
 *
 * @param {string | number | { toString: () => string }} amount - The amount to format
 * @param {string} [code] - Optional token code to append to the formatted amount
 * @param {string} [locale] - Optional locale override (currently unused, kept for compatibility)
 * @returns {string} Formatted token amount string with optional token code
 *
 * @example
 * formatTokenAmount(1234.56); // Returns "1,234.56" (en-US) or "1.234,56" (de-DE)
 * formatTokenAmount("1234.56789"); // Returns "1,234.56789" (en-US) or "1.234,56789" (de-DE)
 * formatTokenAmount(1234.56, "XLM"); // Returns "1,234.56 XLM" (en-US) or "1.234,56 XLM" (de-DE)
 */
export const formatTokenAmount = (
  amount: string | number | { toString: () => string },
  code?: string,
) => {
  const bnAmount = convertToBigNumber(amount);

  // Calculate actual decimal places from BigNumber
  const amountString = bnAmount.toString();
  const decimalPlaces = amountString.includes(".")
    ? amountString.split(".")[1].length
    : 0;

  const formattedAmount = formatNumberWithLocale(bnAmount.toNumber(), {
    useGrouping: true,
    minimumFractionDigits: 2, // Always show at least 2 decimal places
    maximumFractionDigits: Math.max(2, decimalPlaces), // Use actual precision, minimum 2
  });

  // Return the formatted amount with the token code if provided
  return code ? `${formattedAmount} ${code}` : formattedAmount;
};

/**
 * Formats a numeric value as a currency amount in USD
 *
 * This function formats numbers as USD currency values with the $ symbol,
 * thousand separators, and exactly 2 decimal places. Uses react-native-localize
 * for consistent number formatting based on device settings.
 *
 * @param {string | number | { toString: () => string }} amount - The amount to format as currency
 * @param {string} [locale] - Optional locale override (currently unused, kept for compatibility)
 * @returns {string} Formatted currency string (e.g., "$1,234.56" or "1.234,56 $")
 *
 * @example
 * formatFiatAmount(1234.56); // Returns "$1,234.56" (en-US) or "1.234,56 $" (de-DE)
 * formatFiatAmount("1234.5"); // Returns "$1,234.50" (en-US) or "1.234,50 $" (de-DE)
 * formatFiatAmount(0.1); // Returns "$0.10" (en-US) or "0,10 $" (de-DE)
 */
export const formatFiatAmount = (
  amount: string | number | { toString: () => string },
) => {
  // Convert input to a number
  const numericAmount =
    typeof amount === "number" ? amount : parseFloat(amount.toString());

  // Format as USD currency with 2 decimal places using react-native-localize
  const formattedAmount = formatNumberWithLocale(numericAmount, {
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Handle negative values by putting the negative sign before the dollar sign
  if (numericAmount < 0) {
    return `-$${formattedAmount.substring(1)}`; // Remove the negative sign from formattedAmount and add it before $
  }

  return `$${formattedAmount}`;
};

/**
 * Formats a numeric value as a percentage with sign indicator
 *
 * This function formats numbers with 2 decimal places and adds a percentage symbol.
 * Positive numbers are prefixed with a '+' sign, and negative numbers with a '-' sign.
 * Uses react-native-localize for consistent decimal separator formatting.
 *
 * @param {string | number | { toString: () => string }} [amount] - The amount to format as percentage
 * @param {string} [locale] - Optional locale override (currently unused, kept for compatibility)
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
): string => {
  if (amount === null || amount === undefined) {
    return "--";
  }

  const bnAmount = convertToBigNumber(amount);

  // Format the number with exactly 2 decimal places using react-native-localize
  const formattedNumber = formatNumberWithLocale(bnAmount.toNumber(), {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Add the appropriate sign and percentage symbol
  if (bnAmount.gt(0)) {
    return `+${formattedNumber}%`;
  }

  // BigNumber already includes the negative sign in formattedNumber
  return `${formattedNumber}%`;
};

/**
 * Parses a display-formatted numeric string to a number
 *
 * This function takes a string that may be formatted according to device locale conventions
 * (e.g., "1,234.56" for US or "1.234,56" for German) and converts it to a JavaScript number.
 * Uses react-native-localize to determine the correct decimal and grouping separators.
 *
 * @param {string | BigNumber} input - The formatted numeric string to parse
 * @returns {number} Parsed numeric value
 *
 * @example
 * parseDisplayNumber("1,23"); // Returns 1.23 (handles comma decimal separator)
 * parseDisplayNumber("1.23"); // Returns 1.23 (handles dot decimal separator)
 * parseDisplayNumber("1,234.56"); // Returns 1234.56 (handles thousands separator)
 * parseDisplayNumber(new BigNumber("1.23")); // Returns 1.23 (handles BigNumber)
 */
export const parseDisplayNumber = (input: string | BigNumber): number => {
  // Handle BigNumber instances
  if (input instanceof BigNumber) {
    return input.toNumber();
  }

  if (!input || input === "") return 0;

  try {
    // Use device settings for decimal and grouping separators
    const { decimalSeparator, groupingSeparator } = getFormatSettings();

    // Remove thousand separators and normalize decimal separator to dot
    const normalized = input
      .replace(new RegExp(`\\${groupingSeparator}`, "g"), "")
      .replace(new RegExp(`\\${decimalSeparator}`), ".");

    const result = parseFloat(normalized);
    return Number.isNaN(result) ? NaN : result;
  } catch (error) {
    // Fallback: try to handle both comma and dot as decimal separators
    const normalized = input
      .replace(/,/g, ".") // Convert comma to dot
      .replace(/[^\d.-]/g, ""); // Remove any non-numeric characters except dot and minus

    const result = parseFloat(normalized);
    return Number.isNaN(result) ? NaN : result;
  }
};

/**
 * Parses a display-formatted numeric string to a BigNumber instance
 *
 * This function is useful when you need to maintain precision and work with BigNumber
 * arithmetic operations while handling display-formatted input using react-native-localize.
 *
 * @param {string | BigNumber} input - The display-formatted numeric string or BigNumber to parse
 * @returns {BigNumber} A BigNumber instance representing the parsed value
 *
 * @example
 * parseDisplayNumberToBigNumber("1,23"); // Returns BigNumber(1.23)
 * parseDisplayNumberToBigNumber("1.234,56"); // Returns BigNumber(1234.56)
 * parseDisplayNumberToBigNumber("1,234.56"); // Returns BigNumber(1234.56)
 * parseDisplayNumberToBigNumber(new BigNumber("1.23")); // Returns BigNumber(1.23)
 */
export const parseDisplayNumberToBigNumber = (
  input: string | BigNumber,
): BigNumber => {
  // Handle BigNumber instances
  if (input instanceof BigNumber) {
    return input;
  }

  if (!input) {
    return new BigNumber(0);
  }

  // Use parseDisplayNumber and convert to BigNumber
  const parsedNumber = parseDisplayNumber(input);
  return new BigNumber(parsedNumber);
};

/**
 * Formats a numeric string value with display-appropriate decimal separators
 *
 * This function takes any numeric string and formats it according to device settings
 * using react-native-localize. Useful for displaying numeric values like fees, prices,
 * or any decimal numbers in the correct format.
 *
 * @param {string | BigNumber} numericValue - The numeric value to format (e.g., "0.00001", "1.5", "123.456", or BigNumber instance)
 * @returns {string} Formatted number with display-appropriate decimal separator
 *
 * @example
 * formatNumberForDisplay("0.00001"); // Returns "0.00001" (en-US) or "0,00001" (de-DE)
 * formatNumberForDisplay("1.5"); // Returns "1.5" (en-US) or "1,5" (de-DE)
 * formatNumberForDisplay("123.456"); // Returns "123.456" (en-US) or "123,456" (de-DE)
 * formatNumberForDisplay(new BigNumber("1.5")); // Returns "1.5" (en-US) or "1,5" (de-DE)
 */
export const formatNumberForDisplay = (
  numericValue: string | BigNumber,
): string => {
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

    return formatNumberWithLocale(parsedValue, {
      useGrouping: false, // Don't add thousands separators for constants
      minimumFractionDigits: 0,
      maximumFractionDigits: 20, // Support high precision
    });
  } catch (error) {
    // Fallback: manually replace dot with locale decimal separator
    const valueAsString =
      numericValue instanceof BigNumber
        ? numericValue.toString()
        : numericValue;
    const { decimalSeparator } = getNumberFormatSettings();
    return valueAsString.replace(".", decimalSeparator);
  }
};

/**
 * Formats a BigNumber with display-appropriate decimal separators and proper precision handling
 *
 * This function is optimized for BigNumber instances and preserves their precision
 * while applying display formatting using react-native-localize.
 *
 * @param {BigNumber} bigNumberValue - The BigNumber instance to format
 * @param {object} [options] - Formatting options
 * @param {number} [options.decimalPlaces] - Number of decimal places to display
 * @param {boolean} [options.useGrouping] - Whether to use thousands separators (default: false)
 * @returns {string} Formatted number with display-appropriate decimal separator
 *
 * @example
 * formatBigNumberForDisplay(new BigNumber("1234.56789")); // Returns "1234.56789" (en-US) or "1234,56789" (de-DE)
 * formatBigNumberForDisplay(new BigNumber("1234.56789"), { decimalPlaces: 2 }); // Returns "1234.57" (en-US) or "1234,57" (de-DE)
 * formatBigNumberForDisplay(new BigNumber("1234.56"), { useGrouping: true }); // Returns "1,234.56" (en-US) or "1.234,56" (de-DE)
 */
export const formatBigNumberForDisplay = (
  bigNumberValue: BigNumber,
  options: {
    decimalPlaces?: number;
    useGrouping?: boolean;
  } = {},
): string => {
  const { decimalPlaces, useGrouping = false } = options;

  try {
    // Use BigNumber's precise string representation
    const valueString =
      decimalPlaces !== undefined
        ? bigNumberValue.toFixed(decimalPlaces)
        : bigNumberValue.toString();

    // Calculate actual decimal places from the string
    const actualDecimalPlaces = valueString.includes(".")
      ? valueString.split(".")[1].length
      : 0;

    const numericValue = parseFloat(valueString);

    if (Number.isNaN(numericValue)) {
      return valueString;
    }

    return formatNumberWithLocale(numericValue, {
      useGrouping,
      minimumFractionDigits: 0,
      maximumFractionDigits: decimalPlaces ?? actualDecimalPlaces,
    });
  } catch (error) {
    // Fallback: manually replace dot with locale decimal separator
    const valueString =
      decimalPlaces !== undefined
        ? bigNumberValue.toFixed(decimalPlaces)
        : bigNumberValue.toString();
    const { decimalSeparator } = getNumberFormatSettings();
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

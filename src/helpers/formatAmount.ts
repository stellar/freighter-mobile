import BigNumber from "bignumber.js";
import { DEFAULT_DECIMALS } from "config/constants";
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
const formatNumber = (
  value: string | number,
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
    maximumFractionDigits = DEFAULT_DECIMALS,
  } = options;

  // Convert to string with proper decimal places
  const valueStr = typeof value === "string" ? value : value.toString();
  const bnValue = new BigNumber(valueStr);

  // Always use the original string to preserve precision and avoid scientific notation
  let fixedValue = valueStr;

  // Only use toFixed if we need to limit decimal places and the original has more
  // But avoid using toFixed for very high precision numbers as it can truncate
  if (
    maximumFractionDigits > 0 &&
    maximumFractionDigits <= 20 && // Only use toFixed for reasonable precision limits
    (valueStr.includes(".")
      ? valueStr.split(".")[1].length > maximumFractionDigits
      : true) // If no decimal point, always apply toFixed if maxFractionDigits > 0
  ) {
    fixedValue = bnValue.toFixed(maximumFractionDigits);
  }
  // For very high precision numbers (more than 20 decimal places), always use original string

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
    // For very high precision numbers, preserve all digits including trailing zeros
    // Only remove trailing zeros for normal precision numbers
    let trimmedDecimal = decimalPart;
    if (decimalPart.length <= 20) {
      // Only trim trailing zeros if we don't have a minimum fraction digits requirement
      if (minimumFractionDigits === 0) {
        trimmedDecimal = decimalPart.replace(/0+$/, "");
      } else {
        // When minimumFractionDigits is set, preserve trailing zeros up to that minimum
        const minLength = Math.max(minimumFractionDigits, decimalPart.length);
        trimmedDecimal = decimalPart.substring(0, minLength);
      }
    }
    // For very high precision numbers (more than 20 decimal places), preserve all digits
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
 * @param {string | BigNumber} amount - The amount to format (string recommended for precision)
 * @param {string} [code] - Optional token code to append to the formatted amount
 * @returns {string} Formatted token amount string with optional token code
 *
 * @example
 * // US format (dot decimal, comma thousands)
 * formatTokenAmount("1234.56"); // Returns "1,234.56"
 * formatTokenAmount("1234567.89"); // Returns "1,234,567.89"
 * formatTokenAmount("0.0000012345"); // Returns "0.0000012345"
 * formatTokenAmount("9007199254740992.123456789012345"); // Returns "9,007,199,254,740,992.123456789012345"
 *
 * // European format (comma decimal, dot thousands) - when device locale is set to European
 * formatTokenAmount("1234,56"); // Returns "1.234,56" (based on device settings)
 * formatTokenAmount("1234567,89"); // Returns "1.234.567,89" (with thousands separators)
 * formatTokenAmount("0,0000012345"); // Returns "0,0000012345" (preserves precision)
 *
 * // BigNumber and token code examples
 * formatTokenAmount(new BigNumber("1234.56789")); // Returns "1,234.56789" (based on device settings)
 * formatTokenAmount("1234.56", "XLM"); // Returns "1,234.56 XLM" (based on device settings)
 * formatTokenAmount("1000000", "USDC"); // Returns "1,000,000.00 USDC" (with token code)
 */
export const formatTokenAmount = (
  amount: string | BigNumber,
  code?: string,
) => {
  const bnAmount = convertToBigNumber(amount);

  // Use original string to preserve precision and avoid scientific notation
  let originalString: string;
  if (typeof amount === "string") {
    originalString = amount;
  } else if (amount instanceof BigNumber) {
    // For BigNumber, configure it to avoid scientific notation and get the full string
    // Temporarily set EXPONENTIAL_AT to a high value to avoid scientific notation
    const originalExponentialAt = BigNumber.config().EXPONENTIAL_AT;
    BigNumber.config({ EXPONENTIAL_AT: 1e9 });
    originalString = bnAmount.toString();
    // Restore the original configuration
    BigNumber.config({ EXPONENTIAL_AT: originalExponentialAt });
  } else {
    // This should never happen with our type signature, but provide fallback
    originalString = bnAmount.toString();
  }

  // Calculate actual decimal places from the original string
  const decimalPlaces = originalString!.includes(".")
    ? originalString!.split(".")[1].length
    : 0;

  const formattedAmount = formatNumber(originalString!, {
    useGrouping: true,
    minimumFractionDigits: 2, // Always show at least 2 decimal places
    maximumFractionDigits: decimalPlaces > 0 ? decimalPlaces : 2, // Use actual precision, minimum 2
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
 * @param {string | BigNumber} amount - The amount to format (string recommended for precision) as currency
 * @returns {string} Formatted currency string (e.g., "$1,234.56" or "1.234,56 $")
 *
 * @example
 * // US format (dot decimal, comma thousands)
 * formatFiatAmount("1234.56"); // Returns "$1,234.56"
 * formatFiatAmount("1234567.89"); // Returns "$1,234,567.89"
 * formatFiatAmount("0.001"); // Returns "$0.00" (rounded to 2 decimal places)
 * formatFiatAmount("999999999.99"); // Returns "$999,999,999.99"
 *
 * // European format (comma decimal, dot thousands) - when device locale is set to European
 * formatFiatAmount("1234,56"); // Returns "1.234,56 $" (based on device settings)
 * formatFiatAmount("1234567,89"); // Returns "1.234.567,89 $" (with thousands separators)
 * formatFiatAmount("0,001"); // Returns "0,00 $" (rounded to 2 decimal places)
 * formatFiatAmount("999999999,99"); // Returns "999.999.999,99 $" (very large amounts)
 *
 * // BigNumber examples
 * formatFiatAmount(new BigNumber("1234.5")); // Returns "$1,234.50" (based on device settings)
 * formatFiatAmount("0.1"); // Returns "$0.10" (based on device settings)
 * formatFiatAmount("1000000"); // Returns "$1,000,000.00" (with thousands separators)
 */
export const formatFiatAmount = (amount: string | BigNumber) => {
  // Convert input to BigNumber for precision
  const bnAmount = convertToBigNumber(amount);

  // Use original string to preserve precision and avoid scientific notation
  let originalString;
  if (typeof amount === "string") {
    originalString = amount;
  } else if (amount instanceof BigNumber) {
    const bnString = bnAmount.toString();
    if (bnString.includes("e") || bnString.includes("E")) {
      // If it's in scientific notation, use toFixed with high precision
      // Use a very high precision to avoid truncation
      const fixedString = bnAmount.toFixed(100);
      // For very large numbers, we need to be more careful about trimming
      // Only trim trailing zeros if they weren't in the original number
      originalString = fixedString;
    } else {
      originalString = bnString;
    }
  }

  // Format as USD currency with 2 decimal places using react-native-localize
  const formattedAmount = formatNumber(originalString as string, {
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Handle negative values by putting the negative sign before the dollar sign
  if (bnAmount.lt(0)) {
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
 * @param {string | BigNumber} [amount] - The amount to format as percentage (string recommended for precision)
 * @returns {string} Formatted percentage string with sign (e.g., "+1.23%" or "-1.23%")
 *
 * @example
 * // US format (dot decimal)
 * formatPercentageAmount("1.23"); // Returns "+1.23%"
 * formatPercentageAmount("1234.56"); // Returns "+1234.56%" (large percentages)
 * formatPercentageAmount("0.1"); // Returns "+0.10%" (always 2 decimal places)
 * formatPercentageAmount("0.001"); // Returns "+0.00%" (rounded to 2 decimal places)
 *
 * // European format (comma decimal) - when device locale is set to European
 * formatPercentageAmount("1,23"); // Returns "+1,23%" (based on device settings)
 * formatPercentageAmount("1234,56"); // Returns "+1234,56%" (large percentages)
 * formatPercentageAmount("0,1"); // Returns "+0,10%" (always 2 decimal places)
 * formatPercentageAmount("0,001"); // Returns "+0,00%" (rounded to 2 decimal places)
 *
 * // BigNumber and edge cases
 * formatPercentageAmount(new BigNumber("-1.23")); // Returns "-1.23%"
 * formatPercentageAmount("0"); // Returns "0.00%"
 * formatPercentageAmount("999.99"); // Returns "+999.99%" (very large percentages)
 * formatPercentageAmount(); // Returns "--"
 */
export const formatPercentageAmount = (
  amount?: string | BigNumber | null,
): string => {
  if (amount === null || amount === undefined) {
    return "--";
  }

  const bnAmount = convertToBigNumber(amount);

  // Use original string to preserve precision and avoid scientific notation
  let originalString: string;
  if (typeof amount === "string") {
    originalString = amount;
  } else if (amount instanceof BigNumber) {
    // For BigNumber, use toFixed(2) to ensure exactly 2 decimal places for percentages
    originalString = bnAmount.toFixed(2);
  } else {
    // This should never happen with our type signature, but provide fallback
    originalString = bnAmount.toString();
  }

  // Format the number with exactly 2 decimal places using react-native-localize
  const formattedNumber = formatNumber(originalString, {
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
 * @returns {string} Parsed numeric value
 *
 * @example
 * // US format parsing (dot decimal, comma thousands)
 * parseDisplayNumber("1.23"); // Returns "1.23" (handles dot decimal separator)
 * parseDisplayNumber("1,234.56"); // Returns "1234.56" (handles thousands separator)
 * parseDisplayNumber("1,234,567.89"); // Returns "1234567.89" (multiple thousands separators)
 * parseDisplayNumber("0.0000012345"); // Returns "0.0000012345" (preserves precision)
 * parseDisplayNumber("999,999,999.99"); // Returns "999999999.99" (very large numbers)
 *
 * // European format parsing (comma decimal, dot thousands)
 * parseDisplayNumber("1,23"); // Returns "1.23" (handles comma decimal separator)
 * parseDisplayNumber("1.234,56"); // Returns "1234.56" (handles dot thousands separator)
 * parseDisplayNumber("1.234.567,89"); // Returns "1234567.89" (multiple thousands separators)
 * parseDisplayNumber("0,0000012345"); // Returns "0.0000012345" (preserves precision)
 * parseDisplayNumber("999.999.999,99"); // Returns "999999999.99" (very large numbers)
 *
 * // BigNumber and decimals parameter
 * parseDisplayNumber(new BigNumber("1.23")); // Returns "1.23" (handles BigNumber)
 * parseDisplayNumber(new BigNumber("1234.56789"), 2); // Returns "1234.57" (with decimals parameter)
 */
export const parseDisplayNumber = (
  input: string | BigNumber,
  decimals?: number,
): string => {
  // Handle BigNumber instances
  if (input instanceof BigNumber) {
    return decimals ? input.toFixed(decimals) : input.toString();
  }

  if (!input || input === "") return "0";

  try {
    // Use device settings for decimal and grouping separators
    const { decimalSeparator, groupingSeparator } = getFormatSettings();

    // Remove thousand separators and normalize decimal separator to dot
    const normalized = input
      .replace(new RegExp(`\\${groupingSeparator}`, "g"), "")
      .replace(new RegExp(`\\${decimalSeparator}`), ".");

    const result = parseFloat(normalized);
    return result.toString();
  } catch (error) {
    // Fallback: try to handle both comma and dot as decimal separators
    const normalized = input
      .replace(/,/g, ".") // Convert comma to dot
      .replace(/[^\d.-]/g, ""); // Remove any non-numeric characters except dot and minus

    const result = parseFloat(normalized);
    return result.toString();
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
 * // US format parsing (dot decimal, comma thousands)
 * parseDisplayNumberToBigNumber("1.23"); // Returns BigNumber(1.23)
 * parseDisplayNumberToBigNumber("1,234.56"); // Returns BigNumber(1234.56)
 * parseDisplayNumberToBigNumber("1,234,567.89"); // Returns BigNumber(1234567.89) (multiple thousands separators)
 * parseDisplayNumberToBigNumber("0.0000012345"); // Returns BigNumber(0.0000012345) (preserves precision)
 * parseDisplayNumberToBigNumber("999,999,999.99"); // Returns BigNumber(999999999.99) (very large numbers)
 *
 * // European format parsing (comma decimal, dot thousands)
 * parseDisplayNumberToBigNumber("1,23"); // Returns BigNumber(1.23) (comma decimal separator)
 * parseDisplayNumberToBigNumber("1.234,56"); // Returns BigNumber(1234.56) (dot thousands separator)
 * parseDisplayNumberToBigNumber("1.234.567,89"); // Returns BigNumber(1234567.89) (multiple thousands separators)
 * parseDisplayNumberToBigNumber("0,0000012345"); // Returns BigNumber(0.0000012345) (preserves precision)
 * parseDisplayNumberToBigNumber("999.999.999,99"); // Returns BigNumber(999999999.99) (very large numbers)
 *
 * // Edge cases
 * parseDisplayNumberToBigNumber(""); // Returns BigNumber(0) (empty input)
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
 * // US format (dot decimal)
 * formatNumberForDisplay("0.00001"); // Returns "0.00001" (based on device settings)
 * formatNumberForDisplay("1.5"); // Returns "1.5" (based on device settings)
 * formatNumberForDisplay("123.456"); // Returns "123.456" (based on device settings)
 * formatNumberForDisplay("1234567.89"); // Returns "1234567.89" (truncated to 7 decimal places)
 * formatNumberForDisplay("0.000000123456789"); // Returns "0.0000001" (truncated to 7 decimal places)
 * formatNumberForDisplay("999999999.123456789"); // Returns "999999999.1234568" (very large numbers)
 *
 * // European format (comma decimal) - when device locale is set to European
 * formatNumberForDisplay("0,00001"); // Returns "0,00001" (based on device settings)
 * formatNumberForDisplay("1,5"); // Returns "1,5" (based on device settings)
 * formatNumberForDisplay("123,456"); // Returns "123,456" (based on device settings)
 * formatNumberForDisplay("1234567,89"); // Returns "1234567,89" (truncated to 7 decimal places)
 * formatNumberForDisplay("0,000000123456789"); // Returns "0,0000001" (truncated to 7 decimal places)
 *
 * // BigNumber examples
 * formatNumberForDisplay(new BigNumber("123.456789")); // Returns "123.4568" (BigNumber input)
 * formatNumberForDisplay(new BigNumber("1.5")); // Returns "1.5" (based on device settings)
 */
export const formatNumberForDisplay = (
  numericValue: string | BigNumber,
): string => {
  try {
    // Handle BigNumber instances with configuration to avoid scientific notation
    const valueAsString =
      numericValue instanceof BigNumber
        ? (() => {
            const originalExponentialAt = BigNumber.config().EXPONENTIAL_AT;
            BigNumber.config({ EXPONENTIAL_AT: 1e9 });
            const result = numericValue.toString();
            BigNumber.config({ EXPONENTIAL_AT: originalExponentialAt });
            return result;
          })()
        : numericValue;

    // Validate that it's a valid number using BigNumber
    const bnValue = new BigNumber(valueAsString);
    if (bnValue.isNaN()) {
      return valueAsString; // Return original if not a valid number
    }

    return formatNumber(valueAsString, {
      useGrouping: false,
      minimumFractionDigits: 0,
      maximumFractionDigits: DEFAULT_DECIMALS,
    });
  } catch (error) {
    // Fallback: manually replace dot with locale decimal separator
    const valueAsString =
      numericValue instanceof BigNumber
        ? (() => {
            const originalExponentialAt = BigNumber.config().EXPONENTIAL_AT;
            BigNumber.config({ EXPONENTIAL_AT: 1e9 });
            const result = numericValue.toString();
            BigNumber.config({ EXPONENTIAL_AT: originalExponentialAt });
            return result;
          })()
        : numericValue;
    const { decimalSeparator } = getNumberFormatSettings();
    return valueAsString.replace(".", decimalSeparator);
  }
};

/**
 * Formats a BigNumber with display-appropriate decimal separators and proper precision handling
 *
 * This function is specifically designed for BigNumber instances and provides comprehensive
 * formatting capabilities while preserving the full precision of BigNumber arithmetic.
 * It's particularly useful for displaying cryptocurrency amounts, financial calculations,
 * and any numeric values that require arbitrary precision.
 * 
 * It avoids converting to scientific notation (e.g. 1.23e+10)
 * Uses the original string representation. 
 * Also does not use JavaScript numbers to avoid rounding errors.

 * For Displaying token balances with full precision, converting BigNumbers with proper grouping, while displaying amounts with the right decimal separator.
 * The exponential on BigNumber configuration is set at a high value to avoid scientific notation and return the long string representation.

 * @param {BigNumber} bigNumberValue - The BigNumber instance to format. Must be a valid BigNumber.
 * @param {object} [options] - Optional formatting configuration object
 * @param {number} [options.decimalPlaces] - Number of decimal places to display. If not provided,
 *   uses the actual decimal places from the BigNumber. When provided, rounds the number to the
 *   specified precision using BigNumber's toFixed() method.
 * @param {boolean} [options.useGrouping] - Whether to add thousands separators for better readability.
 *   Defaults to false. When true, adds locale-appropriate grouping separators (e.g., "1,234.56" in US locale).
 * @returns {string} Formatted number string with appropriate decimal separator based on device locale.
 *   Returns the original string representation if the BigNumber is invalid (NaN).
 *
 * @example
 * // Basic formatting with default options
 * formatBigNumberForDisplay(new BigNumber("1234.56789")); 
 * // Returns "1234.56789" (US locale) or "1234,56789" (European locale)
 * 
 * // Formatting with specific decimal places (rounds to 2 decimal places)
 * formatBigNumberForDisplay(new BigNumber("1234.56789"), { decimalPlaces: 2 }); 
 * // Returns "1234.57" (US locale) or "1234,57" (European locale)
 * 
 * // Formatting with thousands separators for large numbers
 * formatBigNumberForDisplay(new BigNumber("1234567.89"), { useGrouping: true }); 
 * // Returns "1,234,567.89" (US locale) or "1.234.567,89" (European locale)
 * 
 * // Combining decimal places and grouping
 * formatBigNumberForDisplay(new BigNumber("9999999.123456"), { 
 *   decimalPlaces: 3, 
 *   useGrouping: true 
 * }); 
 * // Returns "9,999,999.123" (US locale) or "9.999.999,123" (European locale)
 * 
 * // Very large numbers (prevents scientific notation)
 * formatBigNumberForDisplay(new BigNumber("123456789012345678901234567890")); 
 * // Returns "123456789012345678901234567890" (full precision, no scientific notation)
 * 
 * // Very small numbers (preserves precision)
 * formatBigNumberForDisplay(new BigNumber("0.000000000123456789")); 
 * // Returns "0.000000000123456789" (preserves all decimal places)
 * 
 * // Zero values
 * formatBigNumberForDisplay(new BigNumber("0")); 
 * // Returns "0"
 * 
 * // Negative numbers
 * formatBigNumberForDisplay(new BigNumber("-1234.56789")); 
 * // Returns "-1234.56789" (preserves negative sign)
 * 
 * // Edge case: Very high precision with grouping
 * formatBigNumberForDisplay(new BigNumber("1234567.123456789012345"), { 
 *   decimalPlaces: 8, 
 *   useGrouping: true 
 * }); 
 * // Returns "1,234,567.12345679" (rounded to 8 decimal places with grouping)
 * 
 * // Invalid BigNumber (NaN) handling
 * formatBigNumberForDisplay(new BigNumber("invalid")); 
 * // Returns "NaN" (graceful handling of invalid input)
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
    // Use BigNumber's precise string representation with configuration to avoid scientific notation
    const originalExponentialAt = BigNumber.config().EXPONENTIAL_AT;
    BigNumber.config({ EXPONENTIAL_AT: 1e9 });

    const valueString =
      decimalPlaces !== undefined
        ? bigNumberValue.toFixed(decimalPlaces)
        : bigNumberValue.toString();

    // Restore the original configuration
    BigNumber.config({ EXPONENTIAL_AT: originalExponentialAt });

    // Calculate actual decimal places from the string
    const actualDecimalPlaces = valueString.includes(".")
      ? valueString.split(".")[1].length
      : 0;

    // Validate using BigNumber instead of parseFloat
    if (bigNumberValue.isNaN()) {
      return valueString;
    }

    return formatNumber(valueString, {
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

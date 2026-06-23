import BigNumber from "bignumber.js";
import { DEFAULT_DECIMALS, MIN_TRANSACTION_FEE } from "config/constants";
import { Balance, PricedBalance } from "config/types";
import { hasDecimals } from "helpers/balances";
import { formatTokenForDisplay as formatSorobanTokenAmount } from "helpers/soroban";
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
        // When minimumFractionDigits is set, pad with zeros to reach minimum length
        const minLength = Math.max(minimumFractionDigits, decimalPart.length);
        trimmedDecimal = decimalPart.padEnd(minLength, "0");
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
 * The function automatically calculates the number of significant decimal places by
 * removing trailing zeros, but always shows a minimum of 2 decimal places and a maximum
 * of 7 decimal places (DEFAULT_DECIMALS) for consistency.
 *
 * IMPORTANT: Input should always be in dot notation (e.g., "123.45"), not comma notation.
 * The output format will depend on the device's locale settings.
 *
 * @param {string | BigNumber} amount - The amount to format in dot notation (string recommended for precision)
 * @param {string} [code] - Optional token code to append to the formatted amount
 * @returns {string} Formatted token amount string with optional token code
 *
 * @example
 * // Input should always be in dot notation, output format depends on device locale
 * // Trailing zeros are removed, but minimum 2 decimal places are shown
 * formatTokenForDisplay("1234.56"); // Returns "1,234.56" (US) or "1.234,56" (EU)
 * formatTokenForDisplay("1234.5000"); // Returns "1,234.50" (US) or "1.234,50" (EU) - trailing zeros removed
 * formatTokenForDisplay("1234.0000"); // Returns "1,234.00" (US) or "1.234,00" (EU) - minimum 2 decimal places
 * formatTokenForDisplay("0.0000012345"); // Returns "0.0000012345" (US) or "0,0000012345" (EU) - shows significant digits
 * formatTokenForDisplay("9007199254740992.123456789012345"); // Returns "9,007,199,254,740,992.1234567" (US) or "9.007.199.254.740.992,1234567" (EU) - capped at 7 decimals
 *
 * // BigNumber and token code examples
 * formatTokenForDisplay(new BigNumber("1234.56789")); // Returns "1,234.56789" (US) or "1.234,56789" (EU)
 * formatTokenForDisplay("1234.56", "XLM"); // Returns "1,234.56 XLM" (US) or "1.234,56 XLM" (EU)
 * formatTokenForDisplay("1000000", "USDC"); // Returns "1,000,000.00 USDC" (US) or "1.000.000,00 USDC" (EU)
 */
export const formatTokenForDisplay = (
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

  // Calculate significant decimal places (removing trailing zeros)
  let significantDecimalPlaces = 0;
  if (originalString!.includes(".")) {
    const decimalPart = originalString!.split(".")[1];
    // Remove trailing zeros to get significant decimal places
    const trimmedDecimal = decimalPart.replace(/0+$/, "");
    significantDecimalPlaces = trimmedDecimal.length;
  }

  // Use minimum of 2 decimal places, but cap at DEFAULT_DECIMALS (7)
  const minDecimalPlaces = 2;
  const maxDecimalPlaces = Math.min(
    DEFAULT_DECIMALS,
    Math.max(minDecimalPlaces, significantDecimalPlaces),
  );

  const formattedAmount = formatNumber(originalString!, {
    useGrouping: true,
    minimumFractionDigits: minDecimalPlaces,
    maximumFractionDigits: maxDecimalPlaces,
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
 * IMPORTANT: Input should always be in dot notation (e.g., "123.45"), not comma notation.
 * The output format will depend on the device's locale settings.
 *
 * @param {string | BigNumber} amount - The amount to format in dot notation (string recommended for precision) as currency
 * @returns {string} Formatted currency string (e.g., "$1,234.56" or "1.234,56 $")
 *
 * @example
 * // Input should always be in dot notation, output format depends on device locale
 * formatFiatAmount("1234.56"); // Returns "$1,234.56" (US) or "1.234,56 $" (EU)
 * formatFiatAmount("1234567.89"); // Returns "$1,234,567.89" (US) or "1.234.567,89 $" (EU)
 * formatFiatAmount("0.001"); // Returns "$0.00" (US) or "0,00 $" (EU) - rounded to 2 decimal places
 * formatFiatAmount("999999999.99"); // Returns "$999,999,999.99" (US) or "999.999.999,99 $" (EU)
 *
 * // BigNumber examples
 * formatFiatAmount(new BigNumber("1234.5")); // Returns "$1,234.50" (US) or "1.234,50 $" (EU)
 * formatFiatAmount("0.1"); // Returns "$0.10" (US) or "0,10 $" (EU)
 * formatFiatAmount("1000000"); // Returns "$1,000,000.00" (US) or "1.000.000,00 $" (EU)
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
 * IMPORTANT: Input should always be in dot notation (e.g., "1.23"), not comma notation.
 * The output format will depend on the device's locale settings.
 *
 * @param {string | BigNumber} [amount] - The amount to format in dot notation as percentage (string recommended for precision)
 * @returns {string} Formatted percentage string with sign (e.g., "+1.23%" or "-1.23%")
 *
 * @example
 * // Input should always be in dot notation, output format depends on device locale
 * formatPercentageAmount("1.23"); // Returns "+1.23%" (US) or "+1,23%" (EU)
 * formatPercentageAmount("1234.56"); // Returns "+1234.56%" (US) or "+1234,56%" (EU)
 * formatPercentageAmount("0.1"); // Returns "+0.10%" (US) or "+0,10%" (EU) - always 2 decimal places
 * formatPercentageAmount("0.001"); // Returns "+0.00%" (US) or "+0,00%" (EU) - rounded to 2 decimal places
 *
 * // BigNumber and edge cases
 * formatPercentageAmount(new BigNumber("-1.23")); // Returns "-1.23%" (US) or "-1,23%" (EU)
 * formatPercentageAmount("0"); // Returns "0.00%" (US) or "0,00%" (EU)
 * formatPercentageAmount("999.99"); // Returns "+999.99%" (US) or "+999,99%" (EU)
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
 * Sanitizes an arbitrary pasted/typed string into a clean, locale-formatted
 * numeric display string (or rejects it).
 *
 * The system keyboard delivers the whole field value on every change, so this
 * runs for typed input too — it must preserve in-progress typing (trailing
 * separators, trailing zeros) while coping with the worst a paste can carry:
 * foreign separators, grouping, currency symbols, whitespace, signs.
 *
 * Rules:
 *  - Strip every char that is not a digit, "." or ",".
 *  - Resolve the decimal separator: when BOTH "." and "," are present the
 *    RIGHTMOST one is the decimal and the other is grouping (so "1,234.56" and
 *    "1.234,56" both read as 1234.56 regardless of locale). A lone locale
 *    decimal is the decimal; a lone/repeated locale grouping separator is
 *    grouping; repeated locale-decimal separators are malformed.
 *  - Truncate the fraction to `maxDecimals` (never round — rounding could
 *    inflate a send amount).
 *  - Emit the decimal using the LOCALE separator so downstream parsing reads
 *    it as the decimal, not as grouping.
 *
 * @returns the sanitized locale-display string, "" for empty input (a clear),
 *   or null when the input is unparseable/ambiguous (caller should roll back).
 */
export const sanitizePastedAmount = (
  text: string,
  {
    decimalSeparator,
    maxDecimals,
  }: {
    decimalSeparator: string;
    maxDecimals: number;
  },
): string | null => {
  // Empty is a clear, not a reject.
  if (text === "") return "";

  // Normalize fullwidth/compatibility forms (e.g. CJK fullwidth digits "１２３"
  // and separators "．，") to ASCII so they aren't silently dropped below.
  const normalized = text.normalize("NFKC");

  // Reject scientific notation up front — stripping the "e" would silently
  // corrupt it into a wrong magnitude (e.g. "1e5" → "15").
  if (/\d[eE][-+]?\d/.test(normalized)) return null;

  // Keep only digits and the two separator characters (drops currency
  // symbols, letters, whitespace, and the sign — amounts are non-negative).
  let cleaned = normalized.replace(/[^0-9.,]/g, "");
  if (cleaned === "") return null;

  // A trailing separator can't be a decimal point (nothing follows it).
  // Preserve only a lone trailing LOCALE decimal — in-progress typing like
  // "1." / "100,". Otherwise strip trailing separators as junk/grouping so
  // "1.5," resolves to "1.5", not "15.".
  const otherSep = decimalSeparator === "." ? "," : ".";
  const preserveTrailingDecimal =
    cleaned.endsWith(decimalSeparator) &&
    (cleaned.match(new RegExp(`\\${decimalSeparator}`, "g")) || []).length ===
      1 &&
    !cleaned.includes(otherSep);
  if (!preserveTrailingDecimal) {
    cleaned = cleaned.replace(/[.,]+$/, "");
    if (cleaned === "") return null;
  }

  const dots = (cleaned.match(/\./g) || []).length;
  const commas = (cleaned.match(/,/g) || []).length;

  // A separator forms valid thousands grouping when the first group is 1-3
  // digits and every later group is exactly 3 (e.g. "1,234", "12,345,678").
  const isValidGrouping = (value: string, sep: string): boolean => {
    const parts = value.split(sep);
    return (
      parts.length > 1 &&
      parts[0].length >= 1 &&
      parts[0].length <= 3 &&
      parts.slice(1).every((part) => part.length === 3)
    );
  };

  let decimalChar: string | null = null;
  let digitsAndDecimal = cleaned;

  if (dots > 0 && commas > 0) {
    // Mixed: the rightmost separator is the decimal, the other is grouping.
    // The integer portion must be validly grouped (1-3 digits, then groups of
    // 3) and the fraction must be plain digits — otherwise it's ambiguous
    // garbage (e.g. "0.5,1", or irregular grouping like "1,23,456.78") and we
    // reject rather than guess a magnitude.
    decimalChar =
      cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",") ? "." : ",";
    const groupingChar = decimalChar === "." ? "," : ".";
    const lastDecimalIdx = cleaned.lastIndexOf(decimalChar);
    const integerPortion = cleaned.slice(0, lastDecimalIdx);
    const fractionPortion = cleaned.slice(lastDecimalIdx + 1);
    const groupedPattern = new RegExp(`^\\d{1,3}(\\${groupingChar}\\d{3})+$`);
    if (
      !groupedPattern.test(integerPortion) ||
      !/^\d*$/.test(fractionPortion)
    ) {
      return null;
    }
    digitsAndDecimal = `${integerPortion
      .split(groupingChar)
      .join("")}${decimalChar}${fractionPortion}`;
  } else if (dots > 0 || commas > 0) {
    const sepChar = dots > 0 ? "." : ",";
    const count = dots > 0 ? dots : commas;

    if (sepChar === decimalSeparator && count === 1) {
      // A lone locale decimal is the decimal point.
      decimalChar = sepChar;
    } else if (isValidGrouping(cleaned, sepChar)) {
      // Valid 3-digit groups → thousands grouping → integer. Also rescues a
      // foreign-grouped integer (e.g. "1,234,567" pasted on a comma-decimal
      // device).
      digitsAndDecimal = cleaned.split(sepChar).join("");
    } else if (count === 1 && sepChar !== decimalSeparator) {
      // A lone NON-locale separator that isn't valid grouping is a
      // foreign-formatted decimal (e.g. "5,2" on a US device → 5.2). This is
      // what prevents the silent 10x-100000x magnitude errors.
      decimalChar = sepChar;
    } else {
      // Repeated separators that don't form valid groups, or a repeated
      // locale decimal — unresolvable, reject.
      return null;
    }
  }

  let integerPart = digitsAndDecimal;
  let fractionPart = "";
  if (decimalChar) {
    const idx = digitsAndDecimal.indexOf(decimalChar);
    integerPart = digitsAndDecimal.slice(0, idx);
    fractionPart = digitsAndDecimal.slice(idx + 1);
  }

  integerPart = integerPart.replace(/^0+(?=\d)/, ""); // drop leading zeros
  fractionPart = fractionPart.slice(0, maxDecimals); // truncate, never round

  // A bare grouping separator with no digits is not a number.
  if (integerPart === "" && fractionPart === "" && !decimalChar) return null;

  if (!decimalChar) return integerPart;

  // Integer-only token (maxDecimals 0): drop the decimal entirely rather than
  // leaving a dangling "42." after truncating the fraction away.
  if (maxDecimals === 0) return integerPart || "0";

  return `${integerPart || "0"}${decimalSeparator}${fractionPart}`;
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
 * IMPORTANT: Input should always be in dot notation (e.g., "123.45"), not comma notation.
 * The output format will depend on the device's locale settings.
 *
 * @param {string | BigNumber} numericValue - The numeric value to format in dot notation (e.g., "0.00001", "1.5", "123.456", or BigNumber instance)
 * @returns {string} Formatted number with display-appropriate decimal separator
 *
 * @example
 * // Input should always be in dot notation, output format depends on device locale
 * formatNumberForDisplay("0.00001"); // Returns "0.00001" (US) or "0,00001" (EU)
 * formatNumberForDisplay("1.5"); // Returns "1.5" (US) or "1,5" (EU)
 * formatNumberForDisplay("123.456"); // Returns "123.456" (US) or "123,456" (EU)
 * formatNumberForDisplay("1234567.89"); // Returns "1234567.89" (US) or "1234567,89" (EU) - truncated to 7 decimal places
 * formatNumberForDisplay("0.000000123456789"); // Returns "0.0000001" (US) or "0,0000001" (EU) - truncated to 7 decimal places
 * formatNumberForDisplay("999999999.123456789"); // Returns "999999999.1234568" (US) or "999999999,1234568" (EU)
 *
 * // BigNumber examples
 * formatNumberForDisplay(new BigNumber("123.456789")); // Returns "123.4568" (US) or "123,4568" (EU)
 * formatNumberForDisplay(new BigNumber("1.5")); // Returns "1.5" (US) or "1,5" (EU)
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

/**
 * Splits a TOTAL transaction fee (XLM string) into the Stellar SDK's
 * per-operation base fee (stroops string). The network charges
 * `baseFee × numOperations`, so dividing the user-set total by the op count
 * keeps the total the user sees consistent regardless of how many operations
 * the transaction bundles (e.g. a swap-to-new-token's changeTrust + path
 * payment). Each op is clamped to the 100-stroop network minimum
 * (MIN_TRANSACTION_FEE) so the result is always a submittable base fee.
 */
export const getPerOperationBaseFeeStroops = (
  totalFeeXlm: string,
  operationCount: number,
): string =>
  BigNumber.max(
    xlmToStroop(totalFeeXlm).idiv(operationCount),
    xlmToStroop(MIN_TRANSACTION_FEE),
  ).toFixed(0);

/**
 * Formats a balance amount for display, handling custom tokens with decimals
 *
 * This function intelligently formats balance amounts by:
 * - Converting raw Soroban token amounts to decimal format when decimals are present
 * - Formatting native and classic tokens directly
 * - Supporting optional amount overrides (e.g., spendable amount)
 *
 * @param {Balance | PricedBalance} balance - The balance object to format
 * @param {string} [code] - Optional token code override
 * @param {BigNumber} [amountOverride] - Optional amount override (e.g., spendable amount)
 * @returns {string} Formatted balance amount string
 *
 * @example
 * // Format custom token with decimals
 * const customTokenBalance = { total: new BigNumber("10000"), decimals: 4, ... };
 * formatBalanceAmount(customTokenBalance, "TEST"); // Returns "1.00 TEST"
 *
 * // Format with amount override
 * formatBalanceAmount(balance, "XLM", spendableAmount); // Returns "50.25 XLM"
 */
export const formatBalanceAmount = (
  balance: Balance | PricedBalance,
  code?: string,
  amountOverride?: BigNumber,
): string => {
  const amount = amountOverride || balance.total;

  // Check if this is a SorobanBalance (custom token) with decimals
  if (hasDecimals(balance)) {
    // Convert raw amount to decimal format using the token's decimals
    const formattedTokenAmount = formatSorobanTokenAmount(
      amount,
      balance.decimals,
    );
    // Then format for display with locale settings
    return formatTokenForDisplay(formattedTokenAmount, code);
  }

  // For other balance types (native, classic, liquidity pools), format directly
  return formatTokenForDisplay(amount, code);
};
/**
 * Formats a fiat amount display string to a fiat amount string.
 * Handles mid-input formatting and supports both comma and dot decimal separators.
 *
 * This function takes a display value (which may contain commas for locale formatting)
 * and formats it as a USD currency string with 2 decimal places. It handles various
 * input formats including incomplete numbers during typing (e.g., "100,").
 *
 * @param {string} value - The fiat amount display string to format (may contain commas or dots)
 * @returns {string} The formatted fiat amount string with $ prefix (e.g., "$100.00" or "-$1,234.56")
 *
 * @example
 * // Valid numeric strings
 * formatFiatInputDisplay("1000");        // Returns "$1,000.00"
 * formatFiatInputDisplay("1234.56");     // Returns "$1,234.56"
 * formatFiatInputDisplay("1234,56");    // Returns "$1,234.56" (comma normalized)
 * formatFiatInputDisplay("0");           // Returns "$0.00"
 *
 * @example
 * // Mid-input formatting (user typing)
 * formatFiatInputDisplay("100,");        // Returns "$100.00"
 * formatFiatInputDisplay("100.");        // Returns "$100.00"
 * formatFiatInputDisplay("55,7");       // Returns "$55.70" (single digit decimal)
 * formatFiatInputDisplay("1234,1");      // Returns "$1,234.10"
 *
 * @example
 * // Large numbers and edge cases
 * formatFiatInputDisplay("1000000");      // Returns "$1,000,000.00"
 * formatFiatInputDisplay("9999999.99");   // Returns "$9,999,999.99"
 * formatFiatInputDisplay("-1000");        // Returns "-$1,000.00"
 *
 */
export const formatFiatInputDisplay = (value: string): string => {
  const normalizedValue = value.replace(",", ".");
  const parsed = parseFloat(normalizedValue);

  if (!Number.isNaN(parsed)) {
    return formatFiatAmount(parsed.toString());
  }

  const match = value.match(/^(\d+)([.,]?)(\d*)$/);
  if (match) {
    return formatFiatAmount(value);
  }

  return value;
};

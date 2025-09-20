import { getLocaleDecimalSeparator } from "helpers/formatAmount";

/**
 * Formats a numeric input based on user key presses (digits, decimal point, delete).
 *
 * Allows one decimal point and limits digits after the decimal based on `maxDecimals`.
 * Uses the device's locale decimal separator for consistency.
 *
 * @param {string} prevValue - The current value in the input field (e.g., "123.45" or "123,45")
 * @param {string} key - The key pressed ("0"-"9", ".", ",", or "" for delete)
 * @param {number} maxDecimals - The maximum number of decimal places allowed (e.g., 7 for XLM)
 * @param {string} [locale] - Optional locale override; uses device locale by default
 * @returns {string} The newly formatted value
 */
export const formatNumericInput = (
  prevValue: string,
  key: string,
  maxDecimals: number = 7, // Default to 7 for Stellar
  locale?: string,
): string => {
  const decimalSeparator = getLocaleDecimalSeparator(locale);
  // Handle delete key
  if (key === "") {
    // Reset to "0" if deleting the last digit/decimal or if the result is empty
    const newValue = prevValue.slice(0, -1);
    return newValue === "" ? "0" : newValue;
  }

  // Handle decimal point key (accept both "." and "," but use locale-appropriate separator)
  if (key === "." || key === ",") {
    // Allow only one decimal point
    if (prevValue.includes(decimalSeparator)) {
      return prevValue;
    }
    // Add "0" if decimal is the first key pressed or input is empty
    if (prevValue === "0" || prevValue === "") {
      return `0${decimalSeparator}`;
    }
    return `${prevValue}${decimalSeparator}`;
  }

  // Handle digit keys ("0" - "9")
  if (/^[0-9]$/.test(key)) {
    // Handle leading zero replacement
    if (prevValue === "0") {
      return key; // Replace "0" with the new digit
    }

    const decimalPointIndex = prevValue.indexOf(decimalSeparator);

    // If a decimal point exists, check decimal length limit
    if (decimalPointIndex !== -1) {
      const decimalPartLength = prevValue.length - decimalPointIndex - 1;
      if (decimalPartLength >= maxDecimals) {
        return prevValue; // Max decimal places reached
      }
    }

    if (prevValue.length >= 20) {
      return prevValue;
    }

    return prevValue + key;
  }

  return prevValue;
};

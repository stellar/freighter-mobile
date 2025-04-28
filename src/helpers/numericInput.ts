/**
 * Formats a numeric input with proper decimal places
 *
 * This function handles the formatting of numeric input with two decimal places,
 * ensuring proper handling of leading zeros and decimal point placement.
 *
 * @param {string} prevValue - The previous value
 * @param {string} key - The key pressed (number or empty string for delete)
 * @returns {string} The formatted value
 */
export const formatNumericInput = (prevValue: string, key: string): string => {
  if (key === "") {
    // Handle delete
    if (prevValue === "0.00") return "0.00";
    const withoutDecimal = prevValue.replace(".", "");
    const newStr = withoutDecimal.slice(0, -1);
    if (newStr === "" || newStr === "0") return "0.00";
    const paddedStr = newStr.padStart(3, "0");
    return `${paddedStr.slice(0, -2)}.${paddedStr.slice(-2)}`;
  }

  // Handle number input
  const withoutDecimal = prevValue.replace(".", "");
  if (withoutDecimal === "000") {
    return `0.0${key}`;
  }
  const newStr = withoutDecimal + key;
  return `${newStr.slice(0, -2)}.${newStr.slice(-2)}`;
};

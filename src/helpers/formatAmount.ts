import BigNumber from "bignumber.js";

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
 * Formats a numeric value as a human-readable asset amount with optional asset code
 *
 * This function formats numbers with thousand separators and appropriate decimal places
 * for displaying asset amounts in the UI.
 *
 * @param {string | number | { toString: () => string }} amount - The amount to format
 * @param {string} [code] - Optional asset code to append to the formatted amount
 * @returns {string} Formatted asset amount string with optional asset code
 *
 * @example
 * formatAssetAmount(1234.56); // Returns "1,234.56"
 * formatAssetAmount("1234.56789"); // Returns "1,234.56789"
 * formatAssetAmount(1234.56, "XLM"); // Returns "1,234.56 XLM"
 */
export const formatAssetAmount = (
  amount: string | number | { toString: () => string },
  code?: string,
) => {
  const bnAmount = convertToBigNumber(amount);

  const formatter = new Intl.NumberFormat("en-US", {
    useGrouping: true,
    minimumFractionDigits: 2, // Always show at least 2 decimal places
    maximumFractionDigits: 20, // Support high precision if needed
  });

  // Format the number and remove unnecessary trailing zeros
  const formattedAmount = formatter.format(bnAmount.toNumber());

  // Return the formatted amount with the asset code if provided
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
  return new Intl.NumberFormat("en-US", {
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
 * formatPercentageAmount(); // Returns "0.00%"
 */
export const formatPercentageAmount = (
  amount?: string | number | { toString: () => string } | null,
): string => {
  if (!amount) {
    return "--";
  }

  const bnAmount = convertToBigNumber(amount);

  // Format the number with 2 decimal places
  const formattedNumber = bnAmount.toFixed(2);

  // Add the appropriate sign and percentage symbol
  if (bnAmount.gt(0)) {
    return `+${formattedNumber}%`;
  }

  // BigNumber already includes the negative sign in formattedNumber
  return `${formattedNumber}%`;
};

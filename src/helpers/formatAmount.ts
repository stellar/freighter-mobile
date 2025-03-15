import BigNumber from "bignumber.js";

// Convert input to BigNumber for consistent handling
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

export const formatAssetAmount = (
  amount: string | number | { toString: () => string },
  code?: string,
) => {
  const bnAmount = convertToBigNumber(amount);

  const formatter = new Intl.NumberFormat("en-US", {
    useGrouping: true,
    minimumFractionDigits: 0, // Only display decimals if needed
    maximumFractionDigits: 20, // Support high precision if needed
  });

  // Format the number and remove unnecessary trailing zeros
  const formattedAmount = formatter.format(bnAmount.toNumber());

  // Return the formatted amount with the asset code if provided
  return code ? `${formattedAmount} ${code}` : formattedAmount;
};

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

export const formatPercentageAmount = (
  amount?: string | number | { toString: () => string },
): string => {
  if (!amount) {
    return "0.00%";
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

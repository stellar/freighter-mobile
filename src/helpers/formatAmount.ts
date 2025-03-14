import BigNumber from "bignumber.js";

export const formatAssetAmount = (
  amount: string | number | { toString: () => string },
  code?: string,
) => {
  let bnAmount;

  // Convert input to BigNumber for consistent handling
  if (typeof amount === "number") {
    bnAmount = new BigNumber(amount);
  } else if (amount instanceof BigNumber) {
    bnAmount = amount;
  } else {
    bnAmount = new BigNumber(amount.toString());
  }

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

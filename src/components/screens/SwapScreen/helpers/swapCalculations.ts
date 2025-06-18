import { BigNumber } from "bignumber.js";
import { PricedBalance } from "config/types";
import { formatAssetAmount } from "helpers/formatAmount";

/**
 * Calculates conversion rate between two amounts
 * Following the extension's conversion rules
 */
export const calculateConversionRate = (
  fromAmount: string,
  toAmount: string,
  conversionRate?: string,
): string => {
  if (conversionRate) return conversionRate;

  const fromAmountBN = new BigNumber(fromAmount);
  const toAmountBN = new BigNumber(toAmount);

  if (fromAmountBN.isZero()) return "0";

  const rate = toAmountBN.dividedBy(fromAmountBN);

  return formatAssetAmount(rate.toString());
};

/**
 * Formats conversion rate for display with proper symbols
 * Uses formatAssetAmount for consistent 7-decimal formatting following extension rules
 */
export const formatConversionRate = (
  rate: string,
  fromSymbol: string,
  toSymbol: string,
): string => {
  if (!rate || rate === "0") return "";

  const formattedRate = formatAssetAmount(rate);

  return `1 ${fromSymbol} ≈ ${formattedRate} ${toSymbol}`;
};

/**
 * Calculates minimum received amount based on slippage
 */
export const calculateMinimumReceived = (
  toAmount: string,
  allowedSlippage: string,
  minimumReceived?: string,
): string => {
  if (minimumReceived) return minimumReceived;

  const toAmountBN = new BigNumber(toAmount);
  const slippageMultiplier = BigNumber(1).minus(
    BigNumber(allowedSlippage).dividedBy(100),
  );

  return toAmountBN.multipliedBy(slippageMultiplier).toFixed(7);
};

/**
 * Formats transaction date for display
 */
export const formatTransactionDate = (createdAt?: string): string => {
  let dateObj: Date;

  if (createdAt) {
    dateObj = new Date(createdAt);
  } else {
    dateObj = new Date();
  }

  const formattedDate = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = dateObj
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();

  return `${formattedDate} · ${formattedTime}`;
};

/**
 * Gets contract address from different balance types
 */
export const getContractAddress = (balance: PricedBalance): string | null => {
  if ("contractId" in balance && balance.contractId) {
    return balance.contractId;
  }

  if ("token" in balance && balance.token && "issuer" in balance.token) {
    return balance.token.issuer.key;
  }

  if (balance.id === "native") {
    return null;
  }

  return null;
};

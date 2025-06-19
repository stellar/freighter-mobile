import { BigNumber } from "bignumber.js";
import { DEFAULT_DECIMALS, NETWORKS } from "config/constants";
import { PricedBalance } from "config/types";
import { formatAssetAmount } from "helpers/formatAmount";
import { getNativeContractDetails } from "helpers/soroban";

interface CalculateConversionRateParams {
  sourceAmount: string;
  destinationAmount: string;
  conversionRate?: string;
}

interface FormatConversionRateParams {
  rate: string;
  sourceSymbol: string;
  destinationSymbol: string;
}

interface CalculateMinimumReceivedParams {
  destinationAmount: string;
  allowedSlippage: string;
  minimumReceived?: string;
}

interface GetContractAddressParams {
  balance: PricedBalance;
  network: NETWORKS;
}

/**
 * Calculates conversion rate between two amounts
 * Following the extension's conversion rules
 */
export const calculateConversionRate = ({
  sourceAmount,
  destinationAmount,
  conversionRate,
}: CalculateConversionRateParams): string => {
  if (conversionRate) return conversionRate;

  const sourceAmountBN = new BigNumber(sourceAmount);
  const destinationAmountBN = new BigNumber(destinationAmount);

  // Validate input amounts
  if (sourceAmountBN.isNaN() || destinationAmountBN.isNaN()) {
    return "0";
  }

  if (sourceAmountBN.isZero()) return "0";

  const rate = destinationAmountBN.dividedBy(sourceAmountBN);

  // Validate the calculated rate
  if (rate.isNaN() || !rate.isFinite()) {
    return "0";
  }

  // Return the rate directly as a string with fixed decimals instead of using formatAssetAmount
  // This avoids the NaN issue that can occur when formatAssetAmount calls .toNumber()
  return rate.toFixed(DEFAULT_DECIMALS);
};

/**
 * Formats conversion rate for display with proper symbols
 * Uses formatAssetAmount for consistent 7-decimal formatting following extension rules
 */
export const formatConversionRate = ({
  rate,
  sourceSymbol,
  destinationSymbol,
}: FormatConversionRateParams): string => {
  if (!rate || rate === "0" || rate === "NaN") return "";

  const rateBN = new BigNumber(rate);

  // Validate the rate is a valid number
  if (rateBN.isNaN() || !rateBN.isFinite() || rateBN.isZero()) {
    return "";
  }

  const roundedRate = rateBN.toFixed(DEFAULT_DECIMALS);
  const formattedRate = formatAssetAmount(roundedRate);

  return `1 ${sourceSymbol} ≈ ${formattedRate} ${destinationSymbol}`;
};

/**
 * Calculates minimum received amount based on slippage
 */
export const calculateMinimumReceived = ({
  destinationAmount,
  allowedSlippage,
  minimumReceived,
}: CalculateMinimumReceivedParams): string => {
  if (minimumReceived) return minimumReceived;

  const destinationAmountBN = new BigNumber(destinationAmount);
  const slippageMultiplier = BigNumber(1).minus(
    BigNumber(allowedSlippage).dividedBy(100),
  );

  return destinationAmountBN.multipliedBy(slippageMultiplier).toFixed(7);
};

/**
 * Gets contract address from different balance types
 * For native XLM, returns the network-specific Stellar Asset Contract address
 */
export const getContractAddress = ({
  balance,
  network,
}: GetContractAddressParams): string | null => {
  if ("contractId" in balance && balance.contractId) {
    return balance.contractId;
  }

  if ("token" in balance && balance.token && "issuer" in balance.token) {
    return balance.token.issuer.key;
  }

  if (balance.id === "native") {
    const nativeContractDetails = getNativeContractDetails(network);

    return nativeContractDetails.contract || null;
  }

  return null;
};

import { BigNumber } from "bignumber.js";
import { DEFAULT_DECIMALS, NETWORKS } from "config/constants";
import { PricedBalance } from "config/types";
import { formatAssetAmount } from "helpers/formatAmount";
import { getNativeContractDetails } from "helpers/soroban";

interface CalculateConversionRateParams {
  fromAmount: string;
  toAmount: string;
  conversionRate?: string;
}

interface FormatConversionRateParams {
  rate: string;
  fromSymbol: string;
  toSymbol: string;
}

interface CalculateMinimumReceivedParams {
  toAmount: string;
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
  fromAmount,
  toAmount,
  conversionRate,
}: CalculateConversionRateParams): string => {
  if (conversionRate) return conversionRate;

  const fromAmountBN = new BigNumber(fromAmount);
  const toAmountBN = new BigNumber(toAmount);

  if (fromAmountBN.isZero()) return "0";

  const rate = toAmountBN.dividedBy(fromAmountBN);

  return formatAssetAmount(rate.toFixed(DEFAULT_DECIMALS));
};

/**
 * Formats conversion rate for display with proper symbols
 * Uses formatAssetAmount for consistent 7-decimal formatting following extension rules
 */
export const formatConversionRate = ({
  rate,
  fromSymbol,
  toSymbol,
}: FormatConversionRateParams): string => {
  if (!rate || rate === "0") return "";

  const roundedRate = BigNumber(rate).toFixed(DEFAULT_DECIMALS);
  const formattedRate = formatAssetAmount(roundedRate);

  return `1 ${fromSymbol} ≈ ${formattedRate} ${toSymbol}`;
};

/**
 * Calculates minimum received amount based on slippage
 */
export const calculateMinimumReceived = ({
  toAmount,
  allowedSlippage,
  minimumReceived,
}: CalculateMinimumReceivedParams): string => {
  if (minimumReceived) return minimumReceived;

  const toAmountBN = new BigNumber(toAmount);
  const slippageMultiplier = BigNumber(1).minus(
    BigNumber(allowedSlippage).dividedBy(100),
  );

  return toAmountBN.multipliedBy(slippageMultiplier).toFixed(7);
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

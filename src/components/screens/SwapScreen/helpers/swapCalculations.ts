import { BigNumber } from "bignumber.js";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { DEFAULT_DECIMALS, isNativeAssetId, NETWORKS } from "config/constants";
import {
  PricedBalance,
  TokenPricesMap,
  TokenTypeWithCustomToken,
} from "config/types";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { getNativeContractDetails } from "helpers/soroban";

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

/**
 * Minimum fields needed to derive a token's contract address and
 * stellar.expert URL. Both PricedBalance and FormattedSearchTokenRecord
 * project into this shape.
 */
export type TokenReference = {
  /** Unique balance identifier (e.g. "XLM", "USDC:GA5Z..."). Present on PricedBalance. */
  id?: string;
  /** Short code for the token (e.g. "XLM", "USDC"). */
  tokenCode?: string;
  /** Flat issuer public key string. Present on FormattedSearchTokenRecord. */
  issuer?: string;
  /** Soroban contract ID. Present on SorobanBalance and CustomToken search results. */
  contractId?: string;
  /** Token type discriminator. */
  tokenType?: TokenTypeWithCustomToken;
  /**
   * Nested token object present on PricedBalance (ClassicBalance / SorobanBalance).
   * Carries the issuer key under `token.issuer.key`.
   */
  token?: {
    issuer?: {
      key: string;
    };
  };
};

interface GetContractAddressParams {
  balance: TokenReference;
  network: NETWORKS;
}

/**
 * Formats conversion rate for display with proper symbols
 * Uses formatTokenForDisplay for consistent 7-decimal formatting following extension rules
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
  const formattedRate = formatTokenForDisplay(roundedRate);

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

  return formatTokenForDisplay(
    destinationAmountBN
      .multipliedBy(slippageMultiplier)
      .toFixed(DEFAULT_DECIMALS),
  );
};

/**
 * Gets contract address from different token reference shapes.
 * For native XLM, returns the network-specific Stellar Token Contract address.
 *
 * Handles both PricedBalance (nested `token.issuer.key`) and
 * FormattedSearchTokenRecord (flat `issuer` string).
 */
export const getContractAddress = ({
  balance,
  network,
}: GetContractAddressParams): string | null => {
  if (balance.contractId) {
    return balance.contractId;
  }

  // PricedBalance (ClassicBalance / SorobanBalance) path: nested issuer key
  if (balance.token?.issuer?.key) {
    return balance.token.issuer.key;
  }

  // FormattedSearchTokenRecord path: flat issuer string
  if (balance.issuer) {
    return balance.issuer;
  }

  if (isNativeAssetId(balance.id)) {
    const nativeContractDetails = getNativeContractDetails(network);

    return nativeContractDetails.contract || null;
  }

  return null;
};

/**
 * Fiat equivalent of the simulated destination amount for the Receive
 * card. Held tokens read currentPrice off the PricedBalance; non-held
 * tokens read from the prices store.
 *
 * Returns undefined when:
 * - destination amount is empty / "0"
 * - the parsed BigNumber is non-finite or zero
 * - neither a held-balance currentPrice nor a prices-store entry exists
 *
 * The prices-map key is "<code>:<issuer>", with issuer omitted for
 * native XLM.
 */
export const computeDestinationFiat = ({
  destinationAmount,
  destinationBalance,
  destinationTokenDescriptor,
  prices,
}: {
  destinationAmount: string;
  destinationBalance: PricedBalance | undefined;
  destinationTokenDescriptor: DestinationTokenDescriptor | null;
  prices: TokenPricesMap;
}): BigNumber | undefined => {
  if (!destinationAmount || destinationAmount === "0") return undefined;
  const amount = new BigNumber(destinationAmount);
  if (!amount.isFinite() || amount.isZero()) return undefined;
  if (
    destinationBalance &&
    "currentPrice" in destinationBalance &&
    destinationBalance.currentPrice
  ) {
    return amount.times(destinationBalance.currentPrice);
  }
  if (destinationTokenDescriptor) {
    const tokenId = destinationTokenDescriptor.issuer
      ? `${destinationTokenDescriptor.tokenCode}:${destinationTokenDescriptor.issuer}`
      : destinationTokenDescriptor.tokenCode;
    const priceInfo = prices[tokenId];
    if (priceInfo?.currentPrice) {
      return amount.times(priceInfo.currentPrice);
    }
  }
  return undefined;
};

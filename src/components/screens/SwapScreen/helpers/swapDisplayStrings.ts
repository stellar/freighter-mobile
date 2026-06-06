import BigNumber from "bignumber.js";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { PricedBalance, Token } from "config/types";
import { formatBalanceAmount, formatFiatAmount } from "helpers/formatAmount";

/**
 * Sell-card secondary line.
 *
 * In token-input mode the user types a token amount, so the secondary line
 * shows the fiat equivalent. In fiat-input mode the user types a fiat
 * amount, so the secondary line shows the token equivalent ("0.123 USDC").
 */
export const buildSellSecondaryText = ({
  showFiatAmount,
  tokenAmountDisplay,
  sourceTokenSymbol,
  fiatAmountDisplay,
}: {
  showFiatAmount: boolean;
  tokenAmountDisplay: string;
  sourceTokenSymbol: string;
  fiatAmountDisplay: string;
}): string =>
  showFiatAmount
    ? `${tokenAmountDisplay || "0"} ${sourceTokenSymbol}`.trim()
    : formatFiatAmount(new BigNumber(fiatAmountDisplay || "0"));

/**
 * Pick the most-complete token shape we can hand to AmountCard's picker chip:
 * prefer the held PricedBalance, fall back to a synthetic Token built from the
 * descriptor (issuer = classic; no issuer = native XLM), and finally
 * undefined when the user hasn't picked anything yet.
 */
export const buildDestinationPickerToken = ({
  destinationBalance,
  destinationTokenDescriptor,
}: {
  destinationBalance: PricedBalance | undefined;
  destinationTokenDescriptor: DestinationTokenDescriptor | null;
}): PricedBalance | Token | undefined => {
  if (destinationBalance) return destinationBalance;
  if (destinationTokenDescriptor?.issuer) {
    return {
      type: destinationTokenDescriptor.tokenType,
      code: destinationTokenDescriptor.tokenCode,
      issuer: { key: destinationTokenDescriptor.issuer },
    } as Token;
  }
  if (destinationTokenDescriptor) {
    return { type: "native", code: NATIVE_TOKEN_CODE } as Token;
  }
  return undefined;
};

/**
 * Receive-card amount strings: big = active editable mode value (token or
 * fiat); small = the other one. Both default to "0" / "$0.00" if the
 * destination amount isn't computed yet.
 */
export const buildReceiveTexts = ({
  showFiatAmount,
  destinationAmount,
  destinationFiat,
  destinationTokenLabel,
}: {
  showFiatAmount: boolean;
  destinationAmount: string;
  destinationFiat: BigNumber | undefined;
  destinationTokenLabel: string;
}): {
  destinationAmountToken: string;
  destinationFiatString: string;
  receiveBigText: string;
  receiveSmallText: string;
} => {
  const destinationAmountToken = destinationAmount || "0";
  const destinationFiatString = destinationFiat
    ? formatFiatAmount(destinationFiat)
    : "$0.00";
  return {
    destinationAmountToken,
    destinationFiatString,
    receiveBigText: showFiatAmount
      ? destinationFiatString
      : destinationAmountToken,
    receiveSmallText: showFiatAmount
      ? `${destinationAmountToken} ${destinationTokenLabel}`.trim()
      : destinationFiatString,
  };
};

/**
 * Sell-card right-aligned available-balance text. Returns "" when no source
 * balance is selected so the caller can render null instead of an empty
 * label.
 *
 * `formatBalanceAmount` already produces "<amount> <code>" — don't append
 * the code a second time (caused the "123.45 USDC USDC" double-code bug).
 * The trailing " available" suffix matches the Send card's wording for
 * cross-flow consistency; pass the resolved i18n string in via
 * `availableLabel` so this helper stays pure.
 */
export const buildSourceBalanceRight = ({
  sourceBalance,
  sourceTokenSymbol,
  spendableAmount,
  availableLabel,
}: {
  sourceBalance: PricedBalance | undefined;
  sourceTokenSymbol: string;
  spendableAmount: BigNumber | null;
  availableLabel: string;
}): string => {
  if (!sourceBalance) return "";
  return `${formatBalanceAmount(
    sourceBalance,
    sourceBalance.tokenCode ?? sourceTokenSymbol,
    spendableAmount ?? undefined,
  )} ${availableLabel}`;
};

import BigNumber from "bignumber.js";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { PricedBalance, Token } from "config/types";
import {
  formatBalanceAmount,
  formatFiatAmount,
  formatFiatInputDisplay,
  formatTokenForDisplay,
} from "helpers/formatAmount";

/**
 * Sell-card secondary line.
 *
 * In token-input mode the user types a token amount, so the secondary line
 * shows the fiat equivalent. In fiat-input mode the user types a fiat
 * amount, so the secondary line shows the token equivalent ("0.123 USDC").
 *
 * Pass the converter's RAW values (dot-notation), not the locale-
 * formatted *Display fields. formatTokenForDisplay constructs a
 * BigNumber internally and would coerce a comma-decimal string to
 * NaN — same trap formatFiatInputDisplay sidesteps because it
 * normalises "," to "." up front. Mirrors the Send flow's AmountCard
 * secondary-line wiring.
 */
export const buildSellSecondaryText = ({
  showFiatAmount,
  tokenAmount,
  sourceTokenSymbol,
  fiatAmountDisplay,
}: {
  showFiatAmount: boolean;
  tokenAmount: string;
  sourceTokenSymbol: string;
  fiatAmountDisplay: string;
}): string =>
  showFiatAmount
    ? formatTokenForDisplay(tokenAmount || "0", sourceTokenSymbol)
    : formatFiatInputDisplay(fiatAmountDisplay || "0");

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
 * fiat); small = the other one. Both default to locale-formatted zero
 * values (e.g. "0,00" / "$0,00" on EU-style locales) when the
 * destination amount isn't computed yet.
 *
 * `destinationFiat === undefined` ambiguously covers two cases: the
 * amount is zero (no fiat to compute yet) AND the token has no known
 * price. `hasDestinationPrice` resolves that ambiguity — known price +
 * zero amount stays at "$0.00", unknown price renders "--".
 */
export const buildReceiveTexts = ({
  showFiatAmount,
  destinationAmount,
  destinationFiat,
  hasDestinationPrice,
  destinationTokenLabel,
}: {
  showFiatAmount: boolean;
  destinationAmount: string;
  destinationFiat: BigNumber | undefined;
  hasDestinationPrice: boolean;
  destinationTokenLabel: string;
}): {
  destinationAmountToken: string;
  destinationFiatString: string;
  receiveBigText: string;
  receiveSmallText: string;
} => {
  // `destinationAmount` arrives from Horizon/the path-finder as a raw
  // dot-notation string ("0.1228789"). Run it through
  // formatTokenForDisplay so the rendered amount uses the device
  // locale's decimal separator (e.g. "0,1228789" on EU-style locales).
  const destinationAmountToken = formatTokenForDisplay(
    destinationAmount || "0",
  );
  const destinationAmountWithCode = destinationTokenLabel
    ? `${destinationAmountToken} ${destinationTokenLabel}`
    : destinationAmountToken;
  let destinationFiatString: string;
  if (destinationFiat) {
    destinationFiatString = formatFiatAmount(destinationFiat);
  } else if (hasDestinationPrice) {
    // Token has a known price, just no amount to multiply yet — show
    // zero so the placeholder reads "you'd receive ~$0.00" rather
    // than the "unknown price" sentinel.
    destinationFiatString = formatFiatAmount("0");
  } else {
    destinationFiatString = "--";
  }
  return {
    destinationAmountToken,
    destinationFiatString,
    receiveBigText: showFiatAmount
      ? destinationFiatString
      : destinationAmountToken,
    receiveSmallText: showFiatAmount
      ? destinationAmountWithCode
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

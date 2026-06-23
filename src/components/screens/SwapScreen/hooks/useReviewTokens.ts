import {
  calculateTokenFiatAmount,
  getTokenFromBalance,
} from "components/screens/SwapScreen/helpers";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { NATIVE_TOKEN_CODE } from "config/constants";
import {
  NativeToken,
  NonNativeToken,
  PricedBalance,
  TokenTypeWithCustomToken,
} from "config/types";
import { usePricesStore } from "ducks/prices";
import { SwapPathResult } from "ducks/swap";
import { formatFiatAmount } from "helpers/formatAmount";
import { useMemo } from "react";

/**
 * Derives the swap review sheet's Sell / Receive view-model from the live
 * balances + path result:
 *
 *   - `sourceBalance` / `destinationBalance` — held PricedBalance matching
 *     the swap store's source / destination ids (undefined when the user
 *     isn't holding the asset — typical for non-held destinations awaiting
 *     a trustline).
 *   - `sourceToken` / `destinationToken` — token objects suitable for the
 *     TokenIcon component. Destination prefers the held balance but falls
 *     back to a synthetic token built from the descriptor so non-held
 *     classic assets still render their issuer-keyed icon instead of XLM.
 *   - `sourceTokenFiatAmount` / `destinationTokenFiatAmount` — fiat-string
 *     equivalents using calculateTokenFiatAmount, with "--" preserved as
 *     the not-known sentinel (formatFiatAmount would otherwise turn the
 *     sentinel into a literal "$--").
 */
export const useReviewTokens = ({
  balanceItems,
  sourceTokenId,
  sourceAmount,
  destinationAmount,
  destinationTokenDescriptor,
  pathResult,
}: {
  balanceItems: Array<PricedBalance & { id: string }>;
  sourceTokenId: string | undefined;
  sourceAmount: string;
  destinationAmount: string;
  destinationTokenDescriptor: DestinationTokenDescriptor | null;
  pathResult: SwapPathResult | null;
}): {
  sourceToken: NativeToken | NonNativeToken;
  destinationToken: NativeToken | NonNativeToken;
  sourceTokenFiatAmount: string;
  destinationTokenFiatAmount: string;
} => {
  const sourceBalance = useMemo(
    () => balanceItems.find((item) => item.id === sourceTokenId),
    [balanceItems, sourceTokenId],
  );

  const destinationBalance = useMemo(
    () =>
      destinationTokenDescriptor
        ? balanceItems.find((item) => item.id === destinationTokenDescriptor.id)
        : undefined,
    [balanceItems, destinationTokenDescriptor],
  );

  const sourceToken = getTokenFromBalance(sourceBalance);

  // For non-held destinations `destinationBalance` is undefined (the user
  // doesn't have a trustline yet). Falling back to
  // getTokenFromBalance(undefined) returns the XLM native token — which
  // renders the wrong icon. Build the token directly from the descriptor
  // when no balance is found.
  const destinationToken = useMemo<NativeToken | NonNativeToken>(() => {
    if (destinationBalance) return getTokenFromBalance(destinationBalance);
    // No descriptor OR native → XLM. Non-native without an issuer is
    // an invalid descriptor (constructors guarantee an issuer for
    // classic types); fall through to the XLM fallback rather than
    // silently producing a NonNativeToken with `issuer: undefined`.
    if (
      !destinationTokenDescriptor ||
      destinationTokenDescriptor.tokenType ===
        TokenTypeWithCustomToken.NATIVE ||
      !destinationTokenDescriptor.issuer
    ) {
      return { type: "native" as const, code: NATIVE_TOKEN_CODE as "XLM" };
    }
    return {
      type: destinationTokenDescriptor.tokenType,
      code: destinationTokenDescriptor.tokenCode,
      issuer: { key: destinationTokenDescriptor.issuer },
    };
  }, [destinationBalance, destinationTokenDescriptor]);

  // Pass the live prices map through so non-held destinations resolve
  // their fiat via the token-id lookup (strategy 3) — without it the
  // review sheet renders "--" instead of the dollar amount for any
  // token the user doesn't already hold.
  const prices = usePricesStore((state) => state.prices);

  const sourceTokenFiatAmountValue = calculateTokenFiatAmount({
    token: sourceToken,
    amount: pathResult?.sourceAmount || sourceAmount,
    balanceItems,
    prices,
  });
  const sourceTokenFiatAmount =
    sourceTokenFiatAmountValue !== "--"
      ? formatFiatAmount(sourceTokenFiatAmountValue)
      : "--";

  const destinationTokenFiatAmountValue = calculateTokenFiatAmount({
    token: destinationToken,
    amount: pathResult?.destinationAmount || destinationAmount,
    balanceItems,
    prices,
  });
  const destinationTokenFiatAmount =
    destinationTokenFiatAmountValue !== "--"
      ? formatFiatAmount(destinationTokenFiatAmountValue)
      : "--";

  return {
    sourceToken,
    destinationToken,
    sourceTokenFiatAmount,
    destinationTokenFiatAmount,
  };
};

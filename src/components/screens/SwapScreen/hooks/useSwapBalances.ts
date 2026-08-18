import BigNumber from "bignumber.js";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { isNativeAssetId } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { useMemo } from "react";

/**
 * Derives the three balance-keyed selections SwapAmountScreen needs from
 * the live balanceItems + swap-store state:
 *
 * - `sourceBalance` — the held PricedBalance matching the swap store's
 *   `sourceTokenId`, or undefined if the source isn't held / not yet
 *   picked.
 * - `destinationBalance` — the held PricedBalance matching the swap
 *   store's destination descriptor id. Undefined for non-held
 *   destinations (the user hasn't added the trustline yet).
 * - `bestNonXlmClassicBalance` — the highest-fiat-value classic non-XLM
 *   balance the user holds, used as the fallback sell token for the
 *   "Swap for 0.5 XLM" affordance on the XlmReserveBottomSheet when the
 *   current source is XLM or unset. Sorted by fiatTotal desc, breaking
 *   ties by raw total. Undefined when the user holds only XLM.
 *
 * Each value is a memoised projection — no effects, refs, or
 * navigation. Returns an object so consumers can destructure selectively.
 */
export const useSwapBalances = ({
  balanceItems,
  sourceTokenId,
  destinationTokenDescriptor,
}: {
  balanceItems: HeldBalanceItem[];
  sourceTokenId: string | undefined;
  destinationTokenDescriptor: DestinationTokenDescriptor | null;
}): {
  sourceBalance: HeldBalanceItem | undefined;
  destinationBalance: HeldBalanceItem | undefined;
  bestNonXlmClassicBalance: HeldBalanceItem | undefined;
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

  // Falls back to total when fiatTotal is missing (e.g. unsupported price).
  const bestNonXlmClassicBalance = useMemo(() => {
    const candidates = balanceItems
      .filter(
        (b) =>
          (b.tokenType === TokenTypeWithCustomToken.CREDIT_ALPHANUM4 ||
            b.tokenType === TokenTypeWithCustomToken.CREDIT_ALPHANUM12) &&
          !isNativeAssetId(b.id) &&
          b.total?.gt(0),
      )
      .sort((a, b) => {
        const aFiat = a.fiatTotal ?? new BigNumber(0);
        const bFiat = b.fiatTotal ?? new BigNumber(0);
        if (!aFiat.eq(bFiat)) return bFiat.comparedTo(aFiat);
        return (b.total ?? new BigNumber(0)).comparedTo(
          a.total ?? new BigNumber(0),
        );
      });
    return candidates[0];
  }, [balanceItems]);

  return { sourceBalance, destinationBalance, bestNonXlmClassicBalance };
};

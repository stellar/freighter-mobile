import { recordTokenId } from "components/screens/SwapScreen/helpers";
import { FormattedSearchTokenRecord, TokenPricesMap } from "config/types";
import { usePricesStore } from "ducks/prices";
import { useCallback, useEffect } from "react";

/**
 * Batch-fetches prices for a set of token records and returns the live
 * prices map. Used by SwapAmountScreen — the Trending list, the
 * Receive-card fiat conversion, and the TrendingTokenDetailBottomSheet
 * price fallback all read from the same map.
 *
 * Gated by `enabled` (typically `showTrending`) so the source picker —
 * which doesn't render the Trending section — doesn't fire a fetch.
 *
 * The initial fetch dedupes tokens already in the store; `refreshPrices`
 * force-refetches them (wired to pull-to-refresh).
 */
export const useSwapTokenPrices = ({
  enabled,
  tokens,
}: {
  enabled: boolean;
  tokens: FormattedSearchTokenRecord[];
}): { prices: TokenPricesMap; refreshPrices: () => Promise<void> } => {
  const fetchPricesForTokenIds = usePricesStore(
    (state) => state.fetchPricesForTokenIds,
  );
  const prices = usePricesStore((state) => state.prices);

  useEffect(() => {
    if (!enabled || tokens.length === 0) return;
    const ids = tokens.map(recordTokenId);
    fetchPricesForTokenIds({ tokens: ids });
  }, [enabled, tokens, fetchPricesForTokenIds]);

  const refreshPrices = useCallback(async () => {
    if (tokens.length === 0) return;
    const ids = tokens.map(recordTokenId);
    await fetchPricesForTokenIds({ tokens: ids, forceRefresh: true });
  }, [tokens, fetchPricesForTokenIds]);

  return { prices, refreshPrices };
};

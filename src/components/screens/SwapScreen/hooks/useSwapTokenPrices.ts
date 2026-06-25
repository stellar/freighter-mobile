import { recordTokenId } from "components/screens/SwapScreen/helpers";
import { FormattedSearchTokenRecord, TokenPricesMap } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { usePricesStore } from "ducks/prices";
import { useCallback, useEffect, useMemo } from "react";

/**
 * Batch-fetches prices for a set of token records and returns the live
 * prices map. Used by SwapAmountScreen — the Trending list, the
 * Receive-card fiat conversion, and the TrendingTokenDetailBottomSheet
 * price fallback all read from the same map.
 *
 * Two fetch sources, merged into one effect:
 *
 *   - `tokens` — the Trending list, gated by `enabled` (= showTrending).
 *     Trending tokens that happen to overlap the active swap pair give
 *     the receive card a working fiat value "for free".
 *   - `extraTokenIds` — explicit ids the caller wants priced regardless
 *     of trending (typically the active swap source + destination).
 *     Without this, picking a non-held destination that isn't in the
 *     trending top 50 leaves the receive card stuck on "--" until the
 *     user adds a trustline (which triggers the held-balance fetch).
 *
 * The store dedupes already-loaded ids, so the union is safe to fire
 * eagerly — no extra network traffic for prices we already have.
 */
export const useSwapTokenPrices = ({
  enabled,
  tokens,
  extraTokenIds,
}: {
  enabled: boolean;
  tokens: FormattedSearchTokenRecord[];
  extraTokenIds?: string[];
}): { prices: TokenPricesMap; refreshPrices: () => Promise<void> } => {
  const fetchPricesForTokenIds = usePricesStore(
    (state) => state.fetchPricesForTokenIds,
  );
  const prices = usePricesStore((state) => state.prices);
  const network = useAuthenticationStore((state) => state.network);

  // Stabilise the extra-ids array so the effect doesn't fire on every
  // render when the caller passes a fresh literal.
  const extraTokenIdsKey = (extraTokenIds ?? []).join("|");
  const stableExtraTokenIds = useMemo(
    () => extraTokenIds ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extraTokenIdsKey],
  );

  useEffect(() => {
    const trendingIds = enabled ? tokens.map(recordTokenId) : [];
    const ids = [...trendingIds, ...stableExtraTokenIds];
    if (ids.length === 0) return;
    fetchPricesForTokenIds({ tokens: ids, network });
  }, [enabled, tokens, stableExtraTokenIds, fetchPricesForTokenIds, network]);

  const refreshPrices = useCallback(async () => {
    const trendingIds = tokens.map(recordTokenId);
    const ids = [...trendingIds, ...stableExtraTokenIds];
    if (ids.length === 0) return;
    await fetchPricesForTokenIds({ tokens: ids, network, forceRefresh: true });
  }, [tokens, stableExtraTokenIds, fetchPricesForTokenIds, network]);

  return { prices, refreshPrices };
};

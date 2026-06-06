import { recordTokenId } from "components/screens/SwapScreen/helpers";
import { FormattedSearchTokenRecord, TokenPricesMap } from "config/types";
import { usePricesStore } from "ducks/prices";
import { useEffect } from "react";

/**
 * Batch-fetches token prices when the SwapAmountScreen's Trending list
 * updates so each SwapTokenRow can display its price + 24h chip via the
 * prices-store `priceInfo`.
 *
 * No-ops when the Trending list isn't currently visible or is empty —
 * the parent screen decides when to render Trending (search active /
 * destination empty / etc.) and passes the resulting `showTrending`
 * boolean in.
 *
 * Returns the live `prices` map so the caller can pass it through to
 * the row components without subscribing to the store a second time.
 */
export const useSwapTrendingPrices = ({
  showTrending,
  trendingTokens,
}: {
  showTrending: boolean;
  trendingTokens: FormattedSearchTokenRecord[];
}): { prices: TokenPricesMap } => {
  const fetchPricesForTokenIds = usePricesStore(
    (state) => state.fetchPricesForTokenIds,
  );
  const prices = usePricesStore((state) => state.prices);

  useEffect(() => {
    if (!showTrending || trendingTokens.length === 0) return;
    const ids = trendingTokens.map(recordTokenId);
    fetchPricesForTokenIds({ tokens: ids });
  }, [showTrending, trendingTokens, fetchPricesForTokenIds]);

  return { prices };
};

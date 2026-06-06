import { recordTokenId } from "components/screens/SwapScreen/helpers";
import { FormattedSearchTokenRecord, TokenPricesMap } from "config/types";
import { usePricesStore } from "ducks/prices";
import { useEffect } from "react";

/**
 * Batch-fetches prices for the trending token list and returns the live
 * prices map. No-ops when `showTrending` is false or the list is empty.
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

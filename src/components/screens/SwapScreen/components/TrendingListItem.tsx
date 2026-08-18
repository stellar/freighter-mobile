import BigNumber from "bignumber.js";
import { SwapTokenRow } from "components/screens/SwapScreen/components/SwapTokenRow";
import { recordTokenId } from "components/screens/SwapScreen/helpers";
import { NETWORKS } from "config/constants";
import { FormattedSearchTokenRecord, TokenPricesMap } from "config/types";
import React from "react";
import { View } from "react-native";

/**
 * Trending-list row. Falls back to the stellar.expert spot price when
 * /token-prices has no entry (no 24h% available in that case).
 */
const TrendingListItemComponent: React.FC<{
  item: FormattedSearchTokenRecord;
  prices: TokenPricesMap;
  network: NETWORKS;
  onPress: () => void;
}> = ({ item, prices, network, onPress }) => {
  const tokenId = recordTokenId(item);
  const priceInfo = prices[tokenId] ?? {};
  const fallbackPrice =
    item.price !== undefined ? new BigNumber(item.price) : undefined;
  return (
    <View>
      <SwapTokenRow
        variant="trending"
        record={item}
        priceInfo={{
          currentPrice: priceInfo.currentPrice ?? fallbackPrice,
          percentagePriceChange24h:
            priceInfo.percentagePriceChange24h ?? undefined,
        }}
        network={network}
        onPress={onPress}
      />
    </View>
  );
};

// Memoized so a parent re-render (e.g. amount keystroke) doesn't re-render
// rows whose inputs are unchanged. Default shallow compare is correct here:
// item / prices / onPress all get new references when their data changes.
export const TrendingListItem = React.memo(TrendingListItemComponent);

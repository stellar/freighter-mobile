import BigNumber from "bignumber.js";
import { SwapTokenRow } from "components/screens/SwapScreen/components/SwapTokenRow";
import { recordTokenId } from "components/screens/SwapScreen/helpers";
import { NETWORKS } from "config/constants";
import { FormattedSearchTokenRecord, TokenPricesMap } from "config/types";
import React from "react";
import { View } from "react-native";

/**
 * One row of the SwapAmountScreen trending list. Resolves the token's
 * price from the prices map (falling back to the stellar.expert spot
 * price when /token-prices has no entry — design doc §5.3, no 24h%
 * available in the fallback case) and forwards the lookup result to
 * `SwapTokenRow` in its `trending` variant.
 *
 * Side-effects on tap (analytics-track, keyboard dismiss, sheet
 * presentation) stay with the parent screen — passed in as a single
 * onPress prop so the component itself stays purely presentational
 * and the screen retains its trending-detail-sheet ownership.
 */
export const TrendingListItem: React.FC<{
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

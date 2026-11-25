import BigNumber from "bignumber.js";
import { TokenIconWithBadge } from "components/TokenIconWithBadge";
import TokenPriceDelta from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceDelta";
import { useInspectedHeaderPrice } from "components/screens/TokenDetailsScreen/components/TokenBalanceHeader";
import { Display, Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import {
  FormattedSearchTokenRecord,
  TokenTypeWithCustomToken,
} from "config/types";
import { usePricesForNetwork, usePricesStore } from "ducks/prices";
import { formatFiatAmount } from "helpers/formatAmount";
import { formatPriceHistoryLabel } from "helpers/priceHistoryChart";
import React, { useEffect } from "react";
import { View } from "react-native";

interface NonHeldTokenHeaderProps {
  tokenId: string;
  network: NETWORKS;
  record: FormattedSearchTokenRecord;
}

/**
 * Icon, name, price, delta for a token the account does not hold — the same
 * markup as {@link TokenBalanceHeader}, whose balance lookup has nothing to
 * find here. The price is the store's when it has one, else the search
 * record's spot price.
 */
const NonHeldTokenHeader: React.FC<NonHeldTokenHeaderProps> = ({
  tokenId,
  network,
  record,
}) => {
  const fetchPricesForTokenIds = usePricesStore(
    (state) => state.fetchPricesForTokenIds,
  );
  const storeEntry = usePricesForNetwork(network)[tokenId];
  const inspectedHeaderPrice = useInspectedHeaderPrice(network, tokenId);

  useEffect(() => {
    fetchPricesForTokenIds({ tokens: [tokenId], network });
  }, [fetchPricesForTokenIds, tokenId, network]);

  const price =
    storeEntry?.currentPrice ??
    (record.price !== undefined ? new BigNumber(record.price) : undefined);

  const renderPrice = () => {
    if (inspectedHeaderPrice !== undefined) {
      return formatPriceHistoryLabel(inspectedHeaderPrice);
    }

    return price !== undefined ? formatFiatAmount(price) : "--";
  };

  return (
    <View className="gap-2">
      <TokenIconWithBadge
        iconUrl={record.iconUrl}
        token={{
          type: record.tokenType as TokenTypeWithCustomToken,
          code: record.tokenCode,
          issuer: {
            key: record.issuer,
          },
        }}
        securityLevel={record.securityLevel}
      />
      <View className="gap-2">
        <Text md medium secondary>
          {record.name ?? record.tokenCode}
        </Text>
        <View className="gap-1">
          <Display xs medium testID="token-price-header-price">
            {renderPrice()}
          </Display>
          <TokenPriceDelta
            tokenId={tokenId}
            network={network}
            percentagePriceChange24h={storeEntry?.percentagePriceChange24h}
          />
        </View>
      </View>
    </View>
  );
};

export default NonHeldTokenHeader;

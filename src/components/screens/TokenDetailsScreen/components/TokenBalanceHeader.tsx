/* eslint-disable react/no-unstable-nested-components */
import { List } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import TokenPriceDelta from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceDelta";
import { Display, Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import { useBalancesStore } from "ducks/balances";
import {
  useInspectedPriceHistory,
  useSelectedPriceHistoryRange,
} from "ducks/priceHistory";
import { isNativeAssetId } from "helpers/assetIdentity";
import { formatBalanceAmount, formatFiatAmount } from "helpers/formatAmount";
import { formatPriceHistoryLabel } from "helpers/priceHistoryChart";
import { isContractId } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import usePriceHistoryEnabled from "hooks/usePriceHistoryEnabled";
import React from "react";
import { View } from "react-native";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

interface TokenBalanceHeaderProps {
  tokenId: string;
  tokenSymbol: string;
  /** Active network — the delta under the price is a mainnet-only chart read */
  network: NETWORKS;
  actualTokenSymbol?: string;
  tokenName?: string;
}

interface TokenDisplayInfo {
  symbol: string;
  name: string;
}

/**
 * The balance this screen is about. Soroban balances are keyed
 * SYMBOL:CONTRACTID, so a contract id has to be matched on `contractId`
 * rather than looked up directly. Shared by the header and the balance rows,
 * which the screen renders on either side of the chart.
 */
const useTokenDetailBalance = (tokenId: string) => {
  const { pricedBalances } = useBalancesStore();

  if (isContractId(tokenId)) {
    return Object.values(pricedBalances).find(
      (balance) => "contractId" in balance && balance.contractId === tokenId,
    );
  }

  return pricedBalances[tokenId];
};

const TokenBalanceHeader: React.FC<TokenBalanceHeaderProps> = ({
  tokenId,
  tokenSymbol,
  network,
  actualTokenSymbol,
  tokenName,
}) => {
  const { t } = useAppTranslation();
  const isSorobanToken = isContractId(tokenId);
  const tokenBalance = useTokenDetailBalance(tokenId);
  const isPriceHistoryEnabled = usePriceHistoryEnabled(network);
  const inspected = useInspectedPriceHistory(network, tokenId);
  const selectedRange = useSelectedPriceHistoryRange(network, tokenId);

  // Early return if tokenBalance is not available
  if (!tokenBalance) {
    return null;
  }

  const getTokenDisplayInfo = (): TokenDisplayInfo => {
    if (isNativeAssetId(tokenId)) {
      return {
        symbol: NATIVE_TOKEN_CODE,
        name: tokenBalance.displayName || tokenSymbol,
      };
    }

    if (isSorobanToken) {
      if (actualTokenSymbol && tokenName) {
        // `actualTokenSymbol` arrives from useTokenDetails, which already
        // resolves the symbol against the contract address, so it is shown
        // as it stands.
        return { symbol: actualTokenSymbol, name: tokenName };
      }

      const shortAddress = truncateAddress(tokenId);
      return {
        symbol: shortAddress,
        name: t("tokenDetailsScreen.sorobanToken"),
      };
    }

    return {
      symbol: tokenSymbol,
      name: tokenBalance.displayName || tokenSymbol,
    };
  };

  const { name } = getTokenDisplayInfo();
  const hasPrice = tokenBalance.currentPrice && tokenBalance.fiatTotal;

  // While a drag-to-inspect is in progress the price is the inspected
  // point's close; released, it is spot again (Phase 3). Guarded on the
  // SELECTED range too, exactly like {@link TokenPriceDelta}: keeps the price
  // honest if an inspection ever carries another range. `scrollEnabled` needs
  // no such guard — it follows the gesture itself, independent of range.
  // Otherwise the price is live spot and does NOT vary by timeframe; only the
  // delta beneath it follows the chart's selected range (§7.3).
  const inspectedHeaderPrice =
    isPriceHistoryEnabled && inspected && inspected.range === selectedRange
      ? inspected.point.p
      : undefined;

  // An active inspection re-points the header even without a spot quote — the
  // chart is fetched independently of it, so a spot-price failure must not
  // hide a drawable, inspectable series.
  const renderPriceInfo = () => (
    <View className="gap-1">
      <Display xs medium testID="token-price-header-price">
        {inspectedHeaderPrice !== undefined
          ? formatPriceHistoryLabel(inspectedHeaderPrice)
          : formatFiatAmount(tokenBalance.currentPrice ?? "0")}
      </Display>
      <TokenPriceDelta
        tokenId={tokenId}
        network={network}
        percentagePriceChange24h={tokenBalance.percentagePriceChange24h}
      />
    </View>
  );

  const renderBalanceInfo = () => (
    <Display xs medium>
      {formatBalanceAmount(tokenBalance, tokenBalance.tokenCode)}
    </Display>
  );

  // Icon, name, price, delta — and nothing else. The Balance/Value rows are
  // {@link TokenBalanceDetails}, which the screen renders BELOW the chart, as
  // the extension does: the chart belongs to the price above it, not under
  // the holdings. `gap-2` between the icon and the name matches the
  // extension's 8px `AssetDetail__title` margin.
  return (
    <View className="gap-2">
      <TokenIcon token={tokenBalance} />
      <View className="gap-2">
        <Text md medium secondary>
          {name}
        </Text>
        {hasPrice || inspectedHeaderPrice !== undefined
          ? renderPriceInfo()
          : renderBalanceInfo()}
      </View>
    </View>
  );
};

/**
 * The Balance / Value rows. Rendered below the chart so the screen reads
 * icon -> name -> price -> delta -> chart -> holdings, matching the extension.
 */
export const TokenBalanceDetails: React.FC<{ tokenId: string }> = ({
  tokenId,
}) => {
  const { t } = useAppTranslation();
  const tokenBalance = useTokenDetailBalance(tokenId);

  if (!tokenBalance) {
    return null;
  }

  // The same two-field guard the header above uses. Not load-bearing today —
  // `ducks/balances` derives `fiatTotal` from `currentPrice`, so the two are
  // falsy together — but the rows and the header must agree about what counts
  // as "priced", and only one of them reading both fields invites drift.
  const hasPrice = !!tokenBalance.currentPrice && !!tokenBalance.fiatTotal;
  const rows = [
    {
      titleComponent: (
        <Text md secondary>
          {t("tokenDetailsScreen.balance")}
        </Text>
      ),
      trailingContent: (
        <Text md>
          {formatBalanceAmount(tokenBalance, tokenBalance.tokenCode)}
        </Text>
      ),
    },
    ...(hasPrice
      ? [
          {
            titleComponent: (
              <Text md secondary>
                {t("tokenDetailsScreen.value")}
              </Text>
            ),
            trailingContent: (
              <Text md>{formatFiatAmount(tokenBalance.fiatTotal ?? "0")}</Text>
            ),
          },
        ]
      : []),
  ];

  return <List variant="secondary" items={rows} />;
};

export default TokenBalanceHeader;

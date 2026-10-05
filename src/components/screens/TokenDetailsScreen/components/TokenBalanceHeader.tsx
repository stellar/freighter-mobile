/* eslint-disable react/no-unstable-nested-components */
import { List } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import TokenPriceDelta, {
  deltaRowHeight,
} from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceDelta";
import Shimmer from "components/sds/Shimmer";
import {
  Display,
  DISPLAY_SIZES,
  Text,
  TEXT_SIZES,
} from "components/sds/Typography";
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import { Balance } from "config/types";
import { useBalancesStore } from "ducks/balances";
import { isNativeAssetId } from "helpers/assetIdentity";
import { fsValue, pxValue } from "helpers/dimensions";
import { formatBalanceAmount, formatFiatAmount } from "helpers/formatAmount";
import { isContractId } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import usePriceHistoryEnabled from "hooks/usePriceHistoryEnabled";
import React from "react";
import { useWindowDimensions, View } from "react-native";

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
const findTokenDetailBalance = <T extends Balance>(
  balances: Record<string, T>,
  tokenId: string,
): T | undefined => {
  if (isContractId(tokenId)) {
    return Object.values(balances).find(
      (balance) => "contractId" in balance && balance.contractId === tokenId,
    );
  }

  return balances[tokenId];
};

const useTokenDetailBalance = (tokenId: string) => {
  const { pricedBalances } = useBalancesStore();
  return findTokenDetailBalance(pricedBalances, tokenId);
};

/** The price line (`Display xs`) at the live text scale, for its placeholder. */
export const priceRowHeight = (fontScale: number): number =>
  fsValue(DISPLAY_SIZES.xs.lineHeight) * fontScale;

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
  const isLoadingBalances = useBalancesStore((state) => state.isLoading);
  const { fontScale } = useWindowDimensions();
  const isPriceHistoryEnabled = usePriceHistoryEnabled(network);

  // Loading placeholders, from the Figma "Data loading" frame: one pill at the
  // price line and one at the delta row, while there is no balance at all. A
  // balance that is present but unpriced always shows the amount instead (see
  // `hasPrice` below) — the store reports loading on every refresh, and a
  // token that settled without a price must not flash back to pills.
  const renderLoadingPriceInfo = () => (
    <View
      testID="token-price-header-loading"
      className="gap-1"
      accessible
      accessibilityState={{ busy: true }}
      accessibilityLabel={t("tokenDetailsScreen.loadingPriceA11yLabel")}
    >
      <Shimmer
        testID="token-price-header-price-skeleton"
        width={pxValue(146)}
        height={priceRowHeight(fontScale)}
      />
      {/* Only where TokenPriceDelta reserves a row to hand over to. */}
      {isPriceHistoryEnabled && (
        <Shimmer
          testID="token-price-header-delta-skeleton"
          width={pxValue(146)}
          height={deltaRowHeight(fontScale)}
        />
      )}
    </View>
  );

  // Before the no-balance branch so a loading header names the token as the
  // loaded one will.
  const getTokenDisplayInfo = (): TokenDisplayInfo => {
    if (isNativeAssetId(tokenId)) {
      return {
        symbol: NATIVE_TOKEN_CODE,
        name: tokenBalance?.displayName || tokenSymbol,
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
      name: tokenBalance?.displayName || tokenSymbol,
    };
  };

  const { name } = getTokenDisplayInfo();

  if (!tokenBalance) {
    if (!isLoadingBalances) {
      return null;
    }

    // No balance yet, so no icon (TokenIcon needs the balance); the rest is
    // placeholder.
    return (
      <View className="gap-2">
        <View className="gap-2">
          <Text md medium secondary>
            {name}
          </Text>
          {renderLoadingPriceInfo()}
        </View>
      </View>
    );
  }

  const hasPrice = tokenBalance.currentPrice && tokenBalance.fiatTotal;

  // The price is live spot and does NOT vary by timeframe; only the delta
  // beneath it follows the chart's selected range (§7.3).
  const renderPriceInfo = () => (
    <View className="gap-1">
      <Display xs medium testID="token-price-header-price">
        {formatFiatAmount(tokenBalance.currentPrice ?? "0")}
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
        {hasPrice ? renderPriceInfo() : renderBalanceInfo()}
      </View>
    </View>
  );
};

/**
 * The Balance / Value rows. Rendered below the chart so the screen reads
 * icon -> name -> price -> delta -> chart -> holdings, matching the extension.
 */
export const TokenBalanceDetails: React.FC<{
  tokenId: string;
  network: NETWORKS;
}> = ({ tokenId, network }) => {
  const { t } = useAppTranslation();
  const tokenBalance = useTokenDetailBalance(tokenId);
  // Raw balances land before prices do; the amount needs no price.
  const rawBalance = useBalancesStore((state) =>
    findTokenDetailBalance(state.balances, tokenId),
  );
  const isLoadingBalances = useBalancesStore((state) => state.isLoading);
  const { fontScale } = useWindowDimensions();
  const rowHeight = fsValue(TEXT_SIZES.md.lineHeight) * fontScale;

  if (!tokenBalance && !isLoadingBalances) {
    return null;
  }

  // The same two-field guard the header above uses. Not load-bearing today —
  // `ducks/balances` derives `fiatTotal` from `currentPrice`, so the two are
  // falsy together — but the rows and the header must agree about what counts
  // as "priced", and only one of them reading both fields invites drift.
  const hasPrice = !!tokenBalance?.currentPrice && !!tokenBalance?.fiatTotal;
  // Loading pills show only while there is no balance at all (the guard
  // above already returned null for "no balance, not loading"). A present
  // but unpriced balance keeps the plain list, even mid-refresh — see the
  // header's own comment for why.
  const isAnyPending = !tokenBalance;

  let balanceCell;
  if (tokenBalance) {
    balanceCell = (
      <Text md>
        {formatBalanceAmount(tokenBalance, tokenBalance.tokenCode)}
      </Text>
    );
  } else if (rawBalance) {
    balanceCell = (
      <Text md>
        {formatBalanceAmount(
          rawBalance,
          "token" in rawBalance ? rawBalance.token.code : undefined,
        )}
      </Text>
    );
  } else {
    balanceCell = (
      <Shimmer
        testID="token-balance-skeleton"
        width={pxValue(102)}
        height={rowHeight}
      />
    );
  }

  let valueRow = null;
  if (hasPrice) {
    valueRow = {
      titleComponent: (
        <Text md secondary>
          {t("tokenDetailsScreen.value")}
        </Text>
      ),
      trailingContent: (
        <Text md>{formatFiatAmount(tokenBalance.fiatTotal ?? "0")}</Text>
      ),
    };
  } else if (!tokenBalance && network === NETWORKS.PUBLIC) {
    // The guard above already returned null for "no balance, not loading",
    // so reaching here with no balance means isLoadingBalances is true. Only
    // mainnet is priced (PRICE_NETWORK_PARAMS in services/backend), so only
    // there can a Value row replace the pill.
    valueRow = {
      titleComponent: (
        <Text md secondary>
          {t("tokenDetailsScreen.value")}
        </Text>
      ),
      trailingContent: (
        <Shimmer
          testID="token-value-skeleton"
          width={pxValue(64)}
          height={rowHeight}
        />
      ),
    };
  }

  const rows = [
    {
      titleComponent: (
        <Text md secondary>
          {t("tokenDetailsScreen.balance")}
        </Text>
      ),
      trailingContent: balanceCell,
    },
    ...(valueRow ? [valueRow] : []),
  ];

  const list = <List variant="secondary" items={rows} />;

  if (!isAnyPending) {
    return list;
  }

  // While anything is pending the card announces once; the pills inside it
  // are decorative, matching the header's own loading wrapper above.
  return (
    <View
      testID="token-balance-details-loading"
      accessible
      accessibilityState={{ busy: true }}
      accessibilityLabel={t("tokenDetailsScreen.loadingBalanceA11yLabel")}
    >
      {list}
    </View>
  );
};

export default TokenBalanceHeader;

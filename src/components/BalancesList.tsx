import { AssetIcon } from "components/AssetIcon";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { THEME } from "config/theme";
import { PricedBalance } from "config/types";
import { useBalancesStore } from "ducks/balances";
import { usePricesStore } from "ducks/prices";
import { px } from "helpers/dimensions";
import {
  formatAssetAmount,
  formatFiatAmount,
  formatPercentageAmount,
} from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import styled from "styled-components/native";

const EmptyState = styled.View`
  padding: 32px 16px;
  align-items: center;
  justify-content: center;
`;

const ListWrapper = styled.View`
  flex: 1;
`;

const ListTitle = styled.View`
  margin-bottom: ${px(24)};
`;

const BalanceRow = styled.View`
  flex-direction: row;
  width: 100%;
  height: ${px(44)};
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${px(24)};
`;

const LeftSection = styled.View`
  flex-direction: row;
  align-items: center;
`;

const AssetTextContainer = styled.View`
  flex-direction: column;
  margin-left: ${px(16)};
`;

const RightSection = styled.View`
  flex-direction: column;
  align-items: flex-end;
  margin-left: ${px(16)};
`;

/**
 * Extended PricedBalance type with an id field for use in FlatList
 */
type BalanceItem = PricedBalance & {
  id: string;
};

/**
 * BalancesList Component Props
 */
interface BalancesListProps {
  publicKey: string;
  network: NETWORKS;
}

/**
 * BalancesList Component
 *
 * A component that displays a user's token balances in a scrollable list.
 * Features include:
 * - Displays regular tokens and liquidity pool tokens
 * - Shows token balances with corresponding fiat values
 * - Displays 24h price changes with color indicators
 * - Supports pull-to-refresh to update balances and prices
 * - Shows loading, error, and empty states
 *
 * @param {BalancesListProps} props - Component props
 * @returns {JSX.Element} A FlatList of balance items or an empty state message
 */
export const BalancesList: React.FC<BalancesListProps> = ({
  publicKey,
  network,
}) => {
  const { t } = useAppTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reference to track refresh timeout
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    balances,
    pricedBalances,
    isLoading: isBalancesLoading,
    error: balancesError,
    fetchAccountBalances,
  } = useBalancesStore();

  const isPricesLoading = usePricesStore((state) => state.isLoading);

  /**
   * Cleanup timeout on component unmount to prevent memory leaks
   */
  useEffect(
    () => () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    },
    [],
  );

  /**
   * Handles manual refresh via pull-to-refresh gesture
   * Ensures the refresh spinner is visible for at least 1 second for a better UX
   */
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    const refreshStartTime = Date.now();

    fetchAccountBalances({
      publicKey,
      network,
    }).finally(() => {
      const elapsedTime = Date.now() - refreshStartTime;
      const remainingTime = Math.max(0, 1000 - elapsedTime);

      // Keep spinner visible for at least 1 second for a smoother UX
      refreshTimeoutRef.current = setTimeout(() => {
        setIsRefreshing(false);
        refreshTimeoutRef.current = null;
      }, remainingTime);
    });
  }, [fetchAccountBalances, publicKey, network]);

  // Display error state if there's an error loading balances
  if (balancesError) {
    return (
      <EmptyState>
        <Text md>Error loading balances</Text>
      </EmptyState>
    );
  }

  // If no balances or empty object, show empty state
  if (!balances || Object.keys(balances).length === 0) {
    return (
      <EmptyState>
        <Text md>
          {isBalancesLoading ? "Loading balances..." : "No balances found"}
        </Text>
      </EmptyState>
    );
  }

  // Convert balances object to array for FlatList
  const balanceItems: BalanceItem[] = Object.entries(pricedBalances).map(
    ([id, balance]) =>
      ({
        id,
        ...balance,
      }) as BalanceItem,
  );

  /**
   * Renders an individual balance item in the list
   * Handles both regular tokens and liquidity pool tokens
   * Displays token name, amount, fiat value, and price change
   *
   * @param {Object} params - The render item parameters
   * @param {BalanceItem} params.item - The balance item to render
   * @returns {JSX.Element} The rendered balance row
   */
  const renderItem = ({ item }: { item: BalanceItem }) => (
    <BalanceRow>
      <LeftSection>
        <AssetIcon token={item} />
        <AssetTextContainer>
          <Text medium>{item.displayName}</Text>
          <Text sm medium secondary>
            {formatAssetAmount(item.total, item.tokenCode)}
          </Text>
        </AssetTextContainer>
      </LeftSection>
      <RightSection>
        {item.fiatTotal ? (
          <>
            <Text medium>{formatFiatAmount(item.fiatTotal)}</Text>
            <Text
              sm
              medium
              color={
                item.percentagePriceChange24h?.gt(0)
                  ? THEME.colors.status.success
                  : THEME.colors.text.secondary
              }
            >
              {formatPercentageAmount(item.percentagePriceChange24h)}
            </Text>
          </>
        ) : (
          <Text medium>--</Text>
        )}
      </RightSection>
    </BalanceRow>
  );

  return (
    <ListWrapper>
      <ListTitle>
        <Text medium>{t("balancesList.title")}</Text>
      </ListTitle>
      <FlatList
        testID="balances-list"
        showsVerticalScrollIndicator={false}
        data={balanceItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isPricesLoading}
            onRefresh={handleRefresh}
            tintColor="white"
          />
        }
      />
    </ListWrapper>
  );
};

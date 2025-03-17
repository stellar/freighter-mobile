import { useFocusEffect } from "@react-navigation/native";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { Balance } from "config/types";
import { useBalances, useBalancesFetcher } from "ducks/balances";
import { usePrices, usePricesFetcher } from "ducks/prices";
import {
  isLiquidityPool,
  getTokenPriceFromBalance,
  getLPShareCode,
} from "helpers/balances";
import { debug } from "helpers/debug";
import {
  formatAssetAmount,
  formatFiatAmount,
  formatPercentageAmount,
} from "helpers/formatAmount";
import React, { useCallback, useEffect, useState, useRef } from "react";
import { FlatList, RefreshControl } from "react-native";
import styled from "styled-components/native";

const BalanceRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom-width: 1px;
  border-bottom-color: blue;
`;

const LeftSection = styled.View`
  flex-direction: row;
  align-items: center;
`;

const AssetTextContainer = styled.View`
  flex-direction: column;
  margin-left: 12px;
`;

const AmountText = styled(Text)`
  color: gray;
  margin-top: 2px;
`;

const RightSection = styled.View`
  flex-direction: column;
  align-items: flex-end;
`;

/**
 * Interface for PriceChangeText styling props
 * @property {boolean} isPositive - Whether the price change is positive (green) or negative (red)
 * @property {React.ReactNode} [children] - Child elements
 * @property {boolean} [sm] - Whether to use small text size
 */
interface PriceChangeTextProps {
  isPositive: boolean;
  children?: React.ReactNode;
  sm?: boolean;
}

const PriceChangeText = styled(Text)<PriceChangeTextProps>`
  color: ${(props: PriceChangeTextProps) =>
    props.isPositive ? "green" : "red"};
`;

const IconPlaceholder = styled.View`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: green;
  justify-content: center;
  align-items: center;
`;

const EmptyState = styled.View`
  padding: 32px 16px;
  align-items: center;
  justify-content: center;
`;

/**
 * Extended Balance type with an id field for use in FlatList
 */
type BalanceItem = Balance & { id: string };

/**
 * BalancesList Component
 *
 * A self-contained component that displays a user's token balances in a scrollable list.
 * Features include:
 * - Displays regular tokens and liquidity pool tokens
 * - Shows token balances with corresponding fiat values
 * - Displays 24h price changes with color indicators
 * - Supports pull-to-refresh to update balances and prices
 * - Shows loading, error, and empty states
 * - Auto-refreshes when the screen comes into focus
 *
 * @returns {JSX.Element} A FlatList of balance items or an empty state message
 */
export const BalancesList: React.FC = () => {
  // TODO: Hardcoded values for testing, we'll get this from the wallet context
  const publicKey = "GBNMQBDE2BPGG7QMNZTKA5VMKMSUNBQMMADANNMPS6VNRUYIVAU5TJRQ";
  const network = NETWORKS.TESTNET;

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reference to track refresh timeout
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { fetchAccountBalances } = useBalancesFetcher();
  const {
    balances,
    isLoading: isBalancesLoading,
    error: balancesError,
  } = useBalances();

  const { fetchPricesForBalances } = usePricesFetcher();
  const { prices, isLoading: isPricesLoading } = usePrices();

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
   * Fetches account balances for the current publicKey and network
   * Does not fetch prices directly - this is handled by the useEffect that watches balances
   *
   * @returns {Promise<void>} Promise that resolves when balances are fetched
   */
  const fetchBalances = useCallback(async () => {
    await fetchAccountBalances({
      publicKey,
      network,
    });
    // Don't fetch prices here - let the useEffect handle that
  }, [fetchAccountBalances, publicKey, network]);

  /**
   * Handles manual refresh via pull-to-refresh gesture
   * Ensures the refresh spinner is visible for at least 1 second for a better UX
   */
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    const refreshStartTime = Date.now();

    fetchBalances().finally(() => {
      const elapsedTime = Date.now() - refreshStartTime;
      const remainingTime = Math.max(0, 1000 - elapsedTime);

      // Keep spinner visible for at least 1 second for a smoother UX
      refreshTimeoutRef.current = setTimeout(() => {
        setIsRefreshing(false);
        refreshTimeoutRef.current = null;
      }, remainingTime);
    });
  }, [fetchBalances]);

  /**
   * Fetch balances when component comes into focus
   * Does not show a spinner, as this is background refreshing
   */
  useFocusEffect(
    useCallback(() => {
      fetchBalances();
    }, [fetchBalances]),
  );

  /**
   * Fetch token prices whenever balances are updated
   * Only fetches if balances exist and are not empty
   */
  useEffect(() => {
    // Check if balances is available and not empty
    if (balances && Object.keys(balances).length > 0) {
      debug("Fetching prices for tokens", "Balances: ", balances);

      fetchPricesForBalances({
        balances,
        publicKey,
        network,
      });
    }
  }, [balances, fetchPricesForBalances, publicKey, network]);

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
  const balanceItems: BalanceItem[] = Object.entries(balances).map(
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
  const renderItem = ({ item }: { item: Balance & { id: string } }) => {
    // Determine the asset code based on balance type
    let assetCode: string;
    let firstChar: string;

    // Get price data from store
    const priceData = getTokenPriceFromBalance(prices, item);
    const currentPrice = priceData?.currentPrice;
    const percentagePriceChange24h = priceData?.percentagePriceChange24h;

    if (isLiquidityPool(item)) {
      // Handle liquidity pool balances
      assetCode = getLPShareCode(item);
      firstChar = "LP";
    } else {
      // Handle regular asset balances
      assetCode = item.token.code;
      firstChar = assetCode.charAt(0);
    }

    // Calculate total value in USD
    const fiatValue = item.total.multipliedBy(currentPrice || 0);

    return (
      <BalanceRow>
        <LeftSection>
          <IconPlaceholder>
            <Text md>{firstChar}</Text>
          </IconPlaceholder>
          <AssetTextContainer>
            <Text md>{assetCode}</Text>
            <AmountText sm>{formatAssetAmount(item.total)}</AmountText>
          </AssetTextContainer>
        </LeftSection>
        <RightSection>
          <Text md>{currentPrice ? formatFiatAmount(fiatValue) : "—"}</Text>
          <PriceChangeText sm isPositive={!percentagePriceChange24h?.lt(0)}>
            {percentagePriceChange24h
              ? formatPercentageAmount(percentagePriceChange24h)
              : "—"}
          </PriceChangeText>
        </RightSection>
      </BalanceRow>
    );
  };

  return (
    <FlatList
      testID="balances-list"
      data={balanceItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing || isPricesLoading}
          onRefresh={handleRefresh}
          tintColor="blue"
        />
      }
    />
  );
};

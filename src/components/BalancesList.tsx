import { useFocusEffect } from "@react-navigation/native";
import { Asset, Horizon } from "@stellar/stellar-sdk";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { useBalances, useBalancesFetcher } from "ducks/balances";
import { getTokenPrice, usePrices, usePricesFetcher } from "ducks/prices";
import { debug } from "helpers/debug";
import {
  formatAssetAmount,
  formatFiatAmount,
  formatPercentageAmount,
} from "helpers/formatAmount";
import { isLiquidityPool } from "helpers/isLiquidityPool";
import debounce from "lodash/debounce";
import React, { useCallback, useEffect, useState, useRef } from "react";
import { FlatList, RefreshControl } from "react-native";
import { Balance } from "services/backend";
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

// Define the props explicitly with types to fix linter error
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

const getLPShareCode = (reserves: Horizon.HorizonApi.Reserve[]) => {
  if (!reserves[0] || !reserves[1]) {
    return "";
  }

  let assetA = reserves[0].asset.split(":")[0];
  let assetB = reserves[1].asset.split(":")[0];

  if (assetA === Asset.native().toString()) {
    assetA = Asset.native().code;
  }
  if (assetB === Asset.native().toString()) {
    assetB = Asset.native().code;
  }

  return `${assetA} / ${assetB}`;
};

// Type definition for the debounced function with cancel method
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): ReturnType<T> | undefined;
  cancel: () => void;
};

/**
 * A fully self-contained component to display a list of token balances
 */
export const BalancesList: React.FC = () => {
  // TODO: Hardcoded values for testing, we'll get this from the wallet context
  const publicKey = "GBNMQBDE2BPGG7QMNZTKA5VMKMSUNBQMMADANNMPS6VNRUYIVAU5TJRQ";
  const network = NETWORKS.TESTNET;

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Properly typed reference for the debounced function
  const debouncedFetchPricesRef = useRef<DebouncedFunction<
    (balancesData: Record<string, Balance>) => void
  > | null>(null);

  const { fetchAccountBalances } = useBalancesFetcher();
  const { balances, isLoading: isBalancesLoading, error } = useBalances();

  const { fetchPricesForBalances } = usePricesFetcher();
  const { prices, isLoading: isPricesLoading } = usePrices();

  // Setup the debounced fetch prices function to prevent spamming the API
  useEffect(() => {
    debouncedFetchPricesRef.current = debounce(
      (balancesData: Record<string, Balance>) => {
        debug("Fetching prices (debounced)");

        fetchPricesForBalances({
          balances: balancesData,
          publicKey,
          network,
        });
      },
      300,
    ); // 300ms debounce time

    // Clean up the debounced function on unmount
    return () => {
      if (debouncedFetchPricesRef.current?.cancel) {
        debouncedFetchPricesRef.current.cancel();
      }
      debouncedFetchPricesRef.current = null;
    };
  }, [fetchPricesForBalances, publicKey, network]);

  // Function to fetch balances (used for both initial load and refresh)
  const fetchBalances = useCallback(async () => {
    debug("Fetching balances");
    await fetchAccountBalances({
      publicKey,
      network,
    });
  }, [fetchAccountBalances, publicKey, network]);

  // Fetch balances when component comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchBalances();
    }, [fetchBalances]),
  );

  // When balances change, fetch prices with debounce
  useEffect(() => {
    if (balances && Object.keys(balances).length > 0) {
      debouncedFetchPricesRef.current?.(balances);
    }
  }, [balances]);

  // Function to handle manual refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);

    fetchBalances().finally(() => {
      setIsRefreshing(false);
    });
  }, [fetchBalances]);

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

  // Display error state if there's an error
  if (error) {
    return (
      <EmptyState>
        <Text md>Error loading balances</Text>
      </EmptyState>
    );
  }

  // Convert balances object to array for FlatList
  const balanceItems = Object.entries(balances).map(([id, balance]) => ({
    id,
    ...balance,
  }));

  // Render each balance item
  const renderItem = ({ item }: { item: Balance & { id: string } }) => {
    // Determine the asset code based on balance type
    let assetCode: string;
    let firstChar: string;

    // Get price data from store
    const priceData = getTokenPrice(prices, item);
    const currentPrice = priceData?.currentPrice;
    const percentagePriceChange24h = priceData?.percentagePriceChange24h;

    if (isLiquidityPool(item)) {
      // Handle liquidity pool balances
      assetCode = getLPShareCode(item.reserves);
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
      data={balanceItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing || isBalancesLoading || isPricesLoading}
          onRefresh={handleRefresh}
          tintColor="blue"
        />
      }
    />
  );
};

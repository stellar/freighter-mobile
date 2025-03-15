import { useFocusEffect } from "@react-navigation/native";
import { Asset, Horizon } from "@stellar/stellar-sdk";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { useBalances, useBalancesFetcher } from "ducks/balances";
import { debug } from "helpers/debug";
import {
  formatAssetAmount,
  formatFiatAmount,
  formatPercentageAmount,
} from "helpers/formatAmount";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import { Balance, LiquidityPoolBalance } from "services/backend";
import styled from "styled-components/native";

// Styled components for the list items
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

// Function to determine if a balance is a liquidity pool
const isLiquidityPool = (balance: Balance): balance is LiquidityPoolBalance =>
  "liquidityPoolId" in balance && "reserves" in balance;

/**
 * A fully self-contained component to display a list of token balances
 * Fetches its own data using hardcoded values (in a real app, these would come from a global store)
 */
export const BalancesList: React.FC = () => {
  // Hardcoded values - in a real app, these would come from a global wallet store/context
  const publicKey = "GBNMQBDE2BPGG7QMNZTKA5VMKMSUNBQMMADANNMPS6VNRUYIVAU5TJRQ";
  const network = NETWORKS.TESTNET;

  // State for tracking manual refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use the hooks to fetch and access balances
  const { fetchAccountBalances } = useBalancesFetcher();
  const { balances, isLoading, error } = useBalances();

  // Fetch balances when component comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchAccountBalances({
        publicKey,
        network,
      });
    }, [fetchAccountBalances, publicKey, network]),
  );

  // Function to handle manual refresh
  const handleRefresh = useCallback(() => {
    debug("Manual refresh triggered");
    setIsRefreshing(true);

    fetchAccountBalances({
      publicKey,
      network,
    }).finally(() => {
      setIsRefreshing(false);
    });
  }, [fetchAccountBalances, publicKey, network]);

  // Log balances to console when they change
  useEffect(() => {
    if (balances) {
      debug("BalancesList", "Current balances:", Object.keys(balances));
    }
  }, [balances]);

  // If no balances or empty object, show empty state
  if (!balances || Object.keys(balances).length === 0) {
    return (
      <EmptyState>
        <Text md>
          {isLoading ? "Loading balances..." : "No balances found"}
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

    // Use random fake numbers for price and percentage as requested
    const currentPrice = 0.001 + Math.random() * 99.999; // Random number between 0.001 and 100
    const percentagePriceChange24h = Math.random() * 10 - 5; // Random number between -5 and 5

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
    const fiatValue = item.total.multipliedBy(currentPrice);

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
          <Text md>{formatFiatAmount(fiatValue)}</Text>
          <PriceChangeText sm isPositive={percentagePriceChange24h >= 0}>
            {formatPercentageAmount(percentagePriceChange24h)}
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
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="blue" // Customize the loading indicator color
        />
      }
    />
  );
};

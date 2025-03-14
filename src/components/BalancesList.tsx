import { useFocusEffect } from "@react-navigation/native";
import { Asset, Horizon } from "@stellar/stellar-sdk";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { useBalances, useBalancesFetcher } from "ducks/balances";
import React, { useCallback } from "react";
import { FlatList } from "react-native";
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

const IconPlaceholder = styled.View`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: green;
  margin-right: 12px;
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

// Helper function to format amounts (you can move this to a utils file)
const formatAmount = (amount: string): string =>
  // Basic formatting, you might want to enhance this
  parseFloat(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });

/**
 * A fully self-contained component to display a list of token balances
 * Fetches its own data using hardcoded values (in a real app, these would come from a global store)
 */
export const BalancesList: React.FC = () => {
  // Hardcoded values - in a real app, these would come from a global wallet store/context
  const publicKey = "GBNMQBDE2BPGG7QMNZTKA5VMKMSUNBQMMADANNMPS6VNRUYIVAU5TJRQ";
  const network = NETWORKS.TESTNET;

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
    // Determine the token code based on balance type
    let tokenCode: string;
    let firstChar: string;

    if (isLiquidityPool(item)) {
      // Handle liquidity pool balances
      tokenCode = getLPShareCode(item.reserves);
      firstChar = "LP";
    } else {
      // Handle regular token balances (native, asset, token)
      tokenCode = item.token.code;
      firstChar = tokenCode.charAt(0);
    }

    return (
      <BalanceRow>
        <LeftSection>
          <IconPlaceholder>
            <Text md>{firstChar}</Text>
          </IconPlaceholder>
          <Text md>{tokenCode}</Text>
        </LeftSection>
        <Text md>{formatAmount(item.total.toString())}</Text>
      </BalanceRow>
    );
  };

  return (
    <FlatList
      data={balanceItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
    />
  );
};

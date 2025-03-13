import { useFocusEffect } from "@react-navigation/native";
import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { useBalances, useBalancesFetcher } from "ducks/balances";
import { debug } from "helpers/debug";
import React, { useCallback } from "react";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  padding: 16px;
`;

const Header = styled.View`
  margin-bottom: 20px;
`;

export const HomeScreen = () => {
  const { fetchAccountBalances } = useBalancesFetcher();
  const { balances, isLoading, error } = useBalances();

  // TODO: read the below from store
  const publicKey = "GBNMQBDE2BPGG7QMNZTKA5VMKMSUNBQMMADANNMPS6VNRUYIVAU5TJRQ";
  const network = NETWORKS.TESTNET;

  const loadBalances = useCallback(() => {
    fetchAccountBalances({
      publicKey,
      network,
    });
  }, [fetchAccountBalances, network]);

  // Fetch balances when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadBalances();
    }, [loadBalances]),
  );

  // Debug balances state
  useFocusEffect(
    useCallback(() => {
      debug("HOME balances state", {
        isLoading,
        error,
        balances,
      });
    }, [balances, isLoading, error]),
  );

  return (
    <BaseLayout>
      <Container>
        <Header>
          <Text md>Tokens</Text>
        </Header>

        {error ? (
          <Text md>Error loading balances: {error}</Text>
        ) : (
          <BalancesList balances={balances} isLoading={isLoading} />
        )}
      </Container>
    </BaseLayout>
  );
};

import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { useBalancesStore } from "ducks/balances";
import React, { useEffect } from "react";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  padding: 16px;
`;

const Header = styled.View`
  margin-bottom: 20px;
`;

export const HomeScreen = () => {
  // TODO: Get this from wallet context
  const publicKey = "GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG";
  const network = NETWORKS.TESTNET;

  const fetchAccountBalances = useBalancesStore(
    (state) => state.fetchAccountBalances,
  );

  useEffect(() => {
    fetchAccountBalances({
      publicKey,
      network,
    });
  }, [fetchAccountBalances, publicKey, network]);

  return (
    <BaseLayout>
      <Container>
        <Header>
          <Text md>Tokens</Text>
        </Header>
        <BalancesList publicKey={publicKey} network={network} />
      </Container>
    </BaseLayout>
  );
};

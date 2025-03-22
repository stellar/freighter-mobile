import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { useFetchAssetIcons } from "hooks/useFetchAssetIcons";
import { useFetchPricedBalances } from "hooks/useFetchPricedBalances";
import React from "react";
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

  // Fetch balances when component mounts or when publicKey/network changes
  useFetchPricedBalances({ publicKey, network });

  // Fetch icons whenever balances are updated
  useFetchAssetIcons();

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

import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Text } from "components/sds/Typography";
import { TESTNET_NETWORK_DETAILS } from "config/constants";
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
  // const publicKey = "GDVCNUP2GJFDCKTIMWFKJHWC7U5ULLCODKWX2YNMRJ5UEW3WJYBZ67QY";
  // const networkDetails = PUBLIC_NETWORK_DETAILS;
  const publicKey = "GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG";
  const networkDetails = TESTNET_NETWORK_DETAILS;

  // Fetch balances when component mounts or when publicKey/network changes
  useFetchPricedBalances({ publicKey, network: networkDetails.network });

  // Fetch icons whenever balances are updated
  useFetchAssetIcons(networkDetails.networkUrl);

  return (
    <BaseLayout>
      <Container>
        <Header>
          <Text md>Tokens</Text>
        </Header>
        <BalancesList publicKey={publicKey} network={networkDetails.network} />
      </Container>
    </BaseLayout>
  );
};

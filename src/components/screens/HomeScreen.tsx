import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Text } from "components/sds/Typography";
import { TESTNET_NETWORK_DETAILS } from "config/constants";
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
  // const publicKey = "GD7HIY2E4EASBGTJ7R4XEL3RDPKMNGE7V6GMEQSWFXRHMYZOGSVRB7OO";
  // const networkDetails = PUBLIC_NETWORK_DETAILS;
  const publicKey = "GAG5Q24OEIY6CMPNDCYZQAKP2I3SS4SGR2RT3WXK4YQSPY46DPTCHOGM";
  const networkDetails = TESTNET_NETWORK_DETAILS;

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

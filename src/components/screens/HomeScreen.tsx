import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { TEST_NETWORK_DETAILS, TEST_PUBLIC_KEY } from "navigators/TabNavigator";
import React from "react";
import styled from "styled-components/native";

const Spacing = styled.View`
  margin-bottom: 100px;
`;

export const HomeScreen = () => {
  const publicKey = TEST_PUBLIC_KEY;
  const networkDetails = TEST_NETWORK_DETAILS;

  return (
    <BaseLayout>
      <Spacing />
      <BalancesList publicKey={publicKey} network={networkDetails.network} />
    </BaseLayout>
  );
};

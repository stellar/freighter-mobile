import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { TEST_NETWORK_DETAILS, TEST_PUBLIC_KEY } from "config/constants";
import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import React from "react";
import { Dimensions } from "react-native";
import styled from "styled-components/native";

const { width } = Dimensions.get("window");

const Spacing = styled.View`
  height: ${px(300)};
  width: ${width}px;
  margin-left: ${px(-24)};
  margin-bottom: ${px(24)};
  border-bottom-width: ${px(1)};
  border-bottom-color: ${THEME.colors.border.default};
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

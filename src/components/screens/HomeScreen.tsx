import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Display, Text } from "components/sds/Typography";
import { TEST_NETWORK_DETAILS, TEST_PUBLIC_KEY } from "config/constants";
import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import React from "react";
import { Dimensions } from "react-native";
import styled from "styled-components/native";

const { width } = Dimensions.get("window");

const TopSection = styled.View`
  margin-top: ${px(86)};
  padding-top: ${px(48)};
  gap: ${px(32)};
  width: 100%;
  align-items: center;
`;

const AccountTotal = styled.View`
  flex-direction: column;
  gap: ${px(12)};
  align-items: center;
`;

const AccountNameRow = styled.View`
  flex-direction: row;
  gap: ${px(6)};
  align-items: center;
`;

const BorderLine = styled.View`
  width: ${width}px;
  margin-left: ${px(-24)};
  border-bottom-width: ${px(1)};
  border-bottom-color: ${THEME.colors.border.default};
  margin-bottom: ${px(24)};
`;

export const HomeScreen = () => {
  const publicKey = TEST_PUBLIC_KEY;
  const networkDetails = TEST_NETWORK_DETAILS;

  return (
    <BaseLayout>
      <TopSection>
        <AccountTotal>
          <AccountNameRow>
            <Avatar size="sm" publicAddress={publicKey} />
            <Text>Test Balances Account</Text>
          </AccountNameRow>
          <Display lg medium>
            $1,305.13
          </Display>
        </AccountTotal>
      </TopSection>
      <BorderLine />
      <BalancesList publicKey={publicKey} network={networkDetails.network} />
    </BaseLayout>
  );
};

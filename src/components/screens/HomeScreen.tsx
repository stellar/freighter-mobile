import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Text } from "components/sds/Typography";
import React from "react";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  padding: 16px;
`;

const Header = styled.View`
  margin-bottom: 20px;
`;

export const HomeScreen = () => (
  <BaseLayout>
    <Container>
      <Header>
        <Text md>Tokens</Text>
      </Header>
      <BalancesList />
    </Container>
  </BaseLayout>
);

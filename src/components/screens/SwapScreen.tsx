import { BaseLayout } from "components/layout/BaseLayout";
import { THEME } from "config/sds/theme";
import { fs } from "helpers/dimensions";
import React from "react";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const ScreenText = styled.Text`
  color: ${THEME.colors.text.default};
  font-size: ${fs(16)};
`;

export const SwapScreen = () => (
  <BaseLayout>
    <Container>
      <ScreenText>Swap</ScreenText>
    </Container>
  </BaseLayout>
);

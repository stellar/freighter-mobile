import React from "react";
import styled from "styled-components/native";

import { THEME } from "../../config/sds/theme";
import { fs } from "../../helpers/dimensions";
import { BaseLayout } from "../layout/BaseLayout";

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const ScreenText = styled.Text`
  color: ${THEME.colors.text.default};
  font-size: ${fs(16)};
`;

export const HomeScreen = () => (
  <BaseLayout>
    <Container>
      <ScreenText>Home</ScreenText>
    </Container>
  </BaseLayout>
);

import { BaseLayout } from "components/layout/BaseLayout";
import { PALETTE, THEME } from "config/theme";
import { fs, px, pxValue } from "helpers/dimensions";
import React from "react";
import styled from "styled-components/native";
import { Button } from "components/sds/Button";

import ClipboardIcon from "assets/icons/clipboard.svg";

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  margin-horizontal: ${px(24)};
`;

const ScreenText = styled.Text`
  color: ${THEME.colors.text.primary};
  font-size: ${fs(16)};
  margin-bottom: ${px(50)};
`;

export const HomeScreen = () => (
  <BaseLayout>
    <Container>
      <ScreenText>Home</ScreenText>

      <Button secondary lg isFullWidth icon={<ClipboardIcon width={pxValue(16)} height={pxValue(16)} stroke={PALETTE.dark.gray["09"]} />}>
        Test Button with Icon
      </Button>
    </Container>
  </BaseLayout>
);

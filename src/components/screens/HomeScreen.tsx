import ClipboardIcon from "assets/icons/clipboard.svg";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { PALETTE, THEME } from "config/theme";
import { fs, px, pxValue } from "helpers/dimensions";
import React from "react";
import styled from "styled-components/native";

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

      <Text
        md
        secondary
        weight="medium"
        style={{
          textAlign: "center",
        }}
      >
        By proceeding, you agree to
        {"\n"}
        Freighter&apos;s{" "}
        <Text md weight="medium" url="https://stellar.org/terms-of-service">
          terms of use
        </Text>
      </Text>

      <Button
        secondary
        lg
        isFullWidth
        icon={
          <ClipboardIcon
            width={pxValue(16)}
            height={pxValue(16)}
            stroke={PALETTE.dark.gray["09"]}
          />
        }
      >
        Test Button with Icon
      </Button>
    </Container>
  </BaseLayout>
);

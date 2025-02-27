import ClipboardIcon from "assets/icons/clipboard.svg";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { PALETTE, THEME } from "config/theme";
import { fs, px, pxValue } from "helpers/dimensions";
import React, { useState } from "react";
import { View } from "react-native";
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

export const HomeScreen = () => {
  const [passwordValue, setPasswordValue] = useState("");

  return (
    <BaseLayout>
      <Container>
        <ScreenText>Home</ScreenText>

        <Input
          isPassword
          placeholder="Type your password"
          fieldSize="lg"
          note="Minimum 8 characters"
          value={passwordValue}
          onChangeText={setPasswordValue}
          error="Password is too short"
          success="Password is valid"
        />

        <View style={{ height: 40 }} />

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
};

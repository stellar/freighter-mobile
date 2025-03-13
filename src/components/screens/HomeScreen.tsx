import ClipboardIcon from "assets/icons/clipboard.svg";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { PALETTE, THEME } from "config/theme";
import { fs, px, pxValue } from "helpers/dimensions";
import useAppTranslation from "helpers/useAppTranslation";
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
  const { t } = useAppTranslation();

  return (
    <BaseLayout>
      <Container>
        <ScreenText>{t("home.title")}</ScreenText>

        <Input
          isPassword
          placeholder={t("onboarding.typePassword")}
          fieldSize="lg"
          note={t("onboarding.typePasswordNote")}
          value={passwordValue}
          onChangeText={setPasswordValue}
        />

        <Text
          md
          secondary
          weight="medium"
          style={{
            textAlign: "center",
          }}
        >
          {t("welcomeScreen.terms.byProceeding")}
          <Text md weight="medium" url="https://stellar.org/terms-of-service">
            {t("welcomeScreen.terms.termsOfService")}
          </Text>
        </Text>

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
          {t("onboarding.testButton")}
        </Button>
      </Container>
    </BaseLayout>
  );
};

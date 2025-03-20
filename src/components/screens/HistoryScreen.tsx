import { logos } from "assets/logos";
import { BaseLayout } from "components/layout/BaseLayout";
import { Asset } from "components/sds/Asset";
import { THEME } from "config/theme";
import { fs, px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-horizontal: ${px(24)};
`;

const ScreenText = styled.Text`
  color: ${THEME.colors.text.primary};
  font-size: ${fs(16)};
`;

export const HistoryScreen = () => {
  const { t } = useAppTranslation();

  return (
    <BaseLayout>
      <Container>
        <ScreenText>{t("history.title")}</ScreenText>

        <View style={{ height: 40 }} />
        <Asset
          variant="single"
          size="lg"
          sourceOne={{
            image: logos.stellar,
            altText: "Stellar Logo",
            backgroundColor: "#041A40", // Optional background color
          }}
        />

        <View style={{ height: 40 }} />

        <Asset
          variant="swap"
          size="lg"
          sourceOne={{
            image: logos.stellar,
            altText: "Stellar Logo",
          }}
          sourceTwo={{
            image: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=002",
            altText: "USDC Logo",
          }}
        />

        <View style={{ height: 40 }} />

        <Asset
          variant="pair"
          size="lg"
          sourceOne={{
            image: logos.stellar,
            altText: "Stellar Logo",
          }}
          sourceTwo={{
            image: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=002",
            altText: "USDC Logo",
          }}
        />

        <View style={{ height: 40 }} />

        <Asset
          variant="platform"
          size="lg"
          sourceOne={{
            image: logos.stellar,
            altText: "Stellar Logo",
          }}
          sourceTwo={{
            image: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=002",
            altText: "USDC Logo",
          }}
        />

        <View style={{ height: 40 }} />
      </Container>
    </BaseLayout>
  );
};

import { logos } from "assets/logos";
import { BaseLayout } from "components/layout/BaseLayout";
import { Asset } from "components/sds/Asset";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { fs, px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect } from "react";
import { View } from "react-native";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-horizontal: ${px(24)};
`;

const ButtonContainer = styled.View`
  margin-top: ${px(16)};
  width: 100%;
  gap: ${px(12)};
`;

const ErrorText = styled(Text)`
  margin-bottom: ${px(12)};
`;

const ScreenText = styled.Text`
  color: ${THEME.colors.text.primary};
  font-size: ${fs(16)};
`;

const LoadingText = styled(Text)`
  margin-bottom: ${px(12)};
`;

export const HistoryScreen = () => {
  const { t } = useAppTranslation();
  const { logout } = useAuthenticationStore();
  const { account, isLoading, error, fetchActiveAccount } =
    useGetActiveAccount();

  const handleLogout = () => {
    logout();
  };

  useEffect(() => {
    fetchActiveAccount();
  }, [fetchActiveAccount]);

  // const callLoginScreen = () => {

  // };

  return (
    <BaseLayout>
      <Container>
        <ScreenText>{t("history.title")}</ScreenText>
        {isLoading && <LoadingText>Loading...</LoadingText>}

        {error && <ErrorText color="error">{error}</ErrorText>}

        {account && (
          <>
            <Text>{account.accountName}</Text>
            <Text>{account.publicKey}</Text>
          </>
        )}

        <ButtonContainer>
          <Button onPress={handleLogout}>
            <Text>Logout</Text>
          </Button>
          <Button onPress={handleLogout}>
            <Text>Login Screen</Text>
          </Button>
        </ButtonContainer>
        <View style={{ height: 40 }} />
        <Asset
          variant="single"
          sourceOne={{
            image: logos.stellar,
            altText: "Stellar Logo",
            backgroundColor: "#041A40", // Optional background color
          }}
        />

        <View style={{ height: 40 }} />

        <Asset
          variant="swap"
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

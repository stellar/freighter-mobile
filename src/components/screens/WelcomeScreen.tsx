import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import FreighterLogo from "assets/logos/freighter-logo-dark.svg";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button, ButtonSizes, ButtonVariants } from "components/sds/Button";
import { Display, Text } from "components/sds/Typography";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { px } from "helpers/dimensions";
import React from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import styled from "styled-components/native";

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<
    AuthStackParamList,
    typeof AUTH_STACK_ROUTES.WELCOME_SCREEN
  >;
};

const Container = styled.View`
  flex: 1;
  justify-content: space-between;
  padding-horizontal: ${px(24)};
`;

const StyledDisplay = styled(Display)`
  text-align: center;
`;

const StyledIconContainer = styled.View`
  align-items: center;
  margin-top: ${px(32)};
`;

const StyledTermsTextContainer = styled.View`
  margin-bottom: ${px(70)};
`;

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();

  const handleCreateNewWallet = () => {
    navigation.push(AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN);
  };

  const handleIAlreadyHaveWallet = () => {
    navigation.push(AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN);
  };

  return (
    <BaseLayout useSafeArea>
      <Container>
        <StyledIconContainer>
          <FreighterLogo width={px(32)} height={px(32)} />
        </StyledIconContainer>
        <View>
          <StyledDisplay>Freighter Wallet</StyledDisplay>
          <View style={{ height: 32 }} />
          <Button
            variant={ButtonVariants.TERTIARY}
            size={ButtonSizes.LARGE}
            onPress={handleCreateNewWallet}
          >
            {t("welcomeScreen.createNewWallet")}
          </Button>
          <View style={{ height: 12 }} />
          <Button
            variant={ButtonVariants.SECONDARY}
            size={ButtonSizes.LARGE}
            onPress={handleIAlreadyHaveWallet}
          >
            {t("welcomeScreen.iAlreadyHaveWallet")}
          </Button>
        </View>
        <StyledTermsTextContainer>
          <Text
            md
            secondary
            weight="medium"
            style={{
              textAlign: "center",
              paddingHorizontal: 32,
            }}
          >
            {t("welcomeScreen.terms.byProceeding")}
            <Text md weight="medium" url="https://stellar.org/terms-of-service">
              {t("welcomeScreen.terms.termsOfService")}
            </Text>
          </Text>
        </StyledTermsTextContainer>
      </Container>
    </BaseLayout>
  );
};

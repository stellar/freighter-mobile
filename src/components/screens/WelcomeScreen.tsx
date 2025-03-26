import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import FreighterLogo from "assets/logos/freighter-logo-dark.svg";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Display, Text } from "components/sds/Typography";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
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

const StyledTermsText = styled(Text)`
  text-align: center;
  padding-horizontal: ${px(32)};
`;

interface StyledProps {
  $size: number;
}

const StyledSpacer = styled.View<StyledProps>`
  height: ${({ $size }: StyledProps) => px($size)};
`;

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const { t } = useAppTranslation();

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
          <StyledDisplay>{t("freighterWallet")}</StyledDisplay>
          <StyledSpacer $size={32} />
          <Button tertiary lg onPress={handleCreateNewWallet}>
            {t("welcomeScreen.createNewWallet")}
          </Button>
          <StyledSpacer $size={12} />
          <Button secondary lg onPress={handleIAlreadyHaveWallet}>
            {t("welcomeScreen.iAlreadyHaveWallet")}
          </Button>
        </View>
        <StyledTermsTextContainer>
          <StyledTermsText md secondary medium>
            {t("welcomeScreen.terms.byProceeding")}
            <Text md medium url="https://stellar.org/terms-of-service">
              {t("welcomeScreen.terms.termsOfService")}
            </Text>
          </StyledTermsText>
        </StyledTermsTextContainer>
      </Container>
    </BaseLayout>
  );
};

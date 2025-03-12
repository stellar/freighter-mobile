import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button, ButtonSizes, ButtonVariants } from "components/sds/Button";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { fs } from "helpers/dimensions";
import React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components/native";

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<
    MainTabStackParamList,
    typeof MAIN_TAB_ROUTES.TAB_SETTINGS
  >;
};

const Container = styled.View`
  flex: 1;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
`;

const TopSection = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const ScreenText = styled.Text`
  color: ${THEME.colors.text.primary};
  font-size: ${fs(16)};
`;

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation();

  const handleSignOut = () => {
    // TODO: Implement sign-out
    navigation.replace(MAIN_TAB_ROUTES.TAB_HOME);
  };

  return (
    <BaseLayout>
      <Container>
        <TopSection>
          <ScreenText>{t("settings.title")}</ScreenText>
        </TopSection>
        <Button
          variant={ButtonVariants.DESTRUCTIVE}
          size={ButtonSizes.LARGE}
          onPress={handleSignOut}
        >
          {t("settings.signOut")}
        </Button>
      </Container>
    </BaseLayout>
  );
};

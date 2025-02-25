import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button, ButtonSizes, ButtonVariants } from "components/sds/Button";
import { ROUTES, RootStackParamList } from "config/routes";
import { THEME } from "config/sds/theme";
import { fs } from "helpers/dimensions";
import React from "react";
import styled from "styled-components/native";

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

type SettingsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.MAIN_TABS
>;

export const SettingsScreen = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();

  const handleSignOut = () => {
    navigation.replace(ROUTES.LOGIN);
  };

  return (
    <BaseLayout>
      <Container>
        <TopSection>
          <ScreenText>Settings</ScreenText>
        </TopSection>
        <Button
          variant={ButtonVariants.DESTRUCTIVE}
          size={ButtonSizes.LARGE}
          onPress={handleSignOut}
        >
          Sign out
        </Button>
      </Container>
    </BaseLayout>
  );
};

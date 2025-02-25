import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button, ButtonSizes, ButtonVariants } from "components/sds/Button";
import { ROUTES, RootStackParamList } from "config/routes";
import React from "react";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.LOGIN
>;

export const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();

  const handleLogin = () => {
    navigation.replace(ROUTES.MAIN_TABS);
  };

  return (
    <BaseLayout useSafeArea>
      <Container>
        <Button
          variant={ButtonVariants.PRIMARY}
          size={ButtonSizes.LARGE}
          onPress={handleLogin}
        >
          Login
        </Button>
      </Container>
    </BaseLayout>
  );
};

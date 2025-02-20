import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import styled from "styled-components/native";

import { ROUTES, RootStackParamList } from "../../config/routes";
import { BaseLayout } from "../layout/BaseLayout";
import { Button, ButtonSize, ButtonVariant } from "../sds/Button";

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
          variant={ButtonVariant.PRIMARY}
          size={ButtonSize.LARGE}
          onPress={handleLogin}
        >
          Login
        </Button>
      </Container>
    </BaseLayout>
  );
};

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import FreighterLogo from "assets/logos/freighter-logo-dark.svg";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { Display, Text } from "components/sds/Typography";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { AUTH_STATUS } from "config/types";
import { getActiveAccountPublicKey, useAuthenticationStore } from "ducks/auth";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components/native";

type LockScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN
>;

const Container = styled.View`
  flex: 1;
  justify-content: space-between;
`;

const StyledIconContainer = styled.View`
  align-items: center;
`;

const StyledFormContainer = styled.View`
  align-items: center;
  justify-content: center;
  background-color: ${THEME.colors.background.tertiary};
  border-radius: ${px(24)};
  padding: ${px(24)};
  gap: ${px(8)};
`;

const ForgotPasswordContainer = styled.View`
  margin-bottom: ${px(32)};
`;

const StyledInputContainer = styled.View`
  width: 100%;
  gap: ${px(12)};
  margin-top: ${px(32)};
`;

export const LockScreen: React.FC<LockScreenProps> = ({ navigation }) => {
  const {
    signIn,
    isLoading: isSigningIn,
    error,
    authStatus,
    logout,
  } = useAuthenticationStore();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const { t } = useAppTranslation();

  // Monitor auth status changes to navigate when unlocked
  useEffect(() => {
    if (authStatus === AUTH_STATUS.AUTHENTICATED) {
      // Add a small delay to ensure state is settled before navigation
      const navigationTimeout = setTimeout(() => {
        navigation.replace(ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK);
      }, 100);

      return () => {
        clearTimeout(navigationTimeout);
      };
    }
    return undefined;
  }, [authStatus, navigation]);

  useEffect(() => {
    const fetchActiveAccountPublicKey = async () => {
      const retrievedPublicKey = await getActiveAccountPublicKey();
      setPublicKey(retrievedPublicKey);
    };

    fetchActiveAccountPublicKey();
  }, []);

  const canContinue = useMemo(
    () =>
      passwordValue.length >= PASSWORD_MIN_LENGTH &&
      passwordValue.length <= PASSWORD_MAX_LENGTH,
    [passwordValue],
  );

  const handleUnlock = useCallback(() => {
    if (!canContinue) return;

    // Disable other navigation attempts while signing in
    if (isSigningIn) return;

    // Try to sign in - error handling is in the auth store
    signIn({ password: passwordValue });
    // Navigation will happen automatically through the authStatus effect
  }, [canContinue, passwordValue, signIn, isSigningIn]);

  const handlePasswordChange = useCallback((value: string) => {
    setPasswordValue(value);
  }, []);

  return (
    <BaseLayout
      useSafeArea
      useKeyboardAvoidingView
      insets={{
        bottom: false,
      }}
    >
      <Container>
        <StyledIconContainer>
          <FreighterLogo width={px(48)} height={px(48)} />
        </StyledIconContainer>
        <StyledFormContainer>
          <Avatar size="lg" publicAddress={publicKey ?? ""} />
          <Display xs semiBold>
            {t("lockScreen.title")}
          </Display>
          <Text secondary>{t("lockScreen.description")}</Text>
          <StyledInputContainer>
            <Input
              isPassword
              placeholder={t("lockScreen.passwordInputPlaceholder")}
              fieldSize="lg"
              value={passwordValue}
              onChangeText={handlePasswordChange}
              error={error}
            />
            <Button
              tertiary
              lg
              onPress={handleUnlock}
              disabled={!canContinue}
              isLoading={isSigningIn}
            >
              {t("lockScreen.unlockButtonText")}
            </Button>
          </StyledInputContainer>
        </StyledFormContainer>
        <ForgotPasswordContainer>
          <Button secondary lg onPress={() => logout(true)}>
            {t("lockScreen.forgotPasswordButtonText")}
          </Button>
        </ForgotPasswordContainer>
      </Container>
    </BaseLayout>
  );
};

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import FreighterLogo from "assets/logos/freighter-logo-dark.svg";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { fs, px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { getActiveAccountPublicKey } from "hooks/useGetActiveAccount";
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

const StyledTitle = styled(Text)`
  font-size: ${fs(24)};
  font-weight: 600;
`;

export const LockScreen: React.FC<LockScreenProps> = ({ navigation }) => {
  const { signIn, isLoading: isSigningIn, error } = useAuthenticationStore();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const { t } = useAppTranslation();

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

    signIn({ password: passwordValue }).then(() => {
      if (navigation.getState().index > 0) {
        navigation.goBack();
      } else {
        navigation.replace(ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK);
      }
    });
  }, [canContinue, passwordValue, signIn, navigation]);

  const handlePasswordChange = useCallback((value: string) => {
    setPasswordValue(value);
  }, []);

  return (
    <BaseLayout useSafeArea useKeyboardAvoidingView>
      <Container>
        <StyledIconContainer>
          <FreighterLogo width={px(48)} height={px(48)} />
        </StyledIconContainer>
        <StyledFormContainer>
          <Avatar size="lg" publicAddress={publicKey ?? ""} />
          <StyledTitle>{t("lockScreen.title")}</StyledTitle>
          <Text secondary>{t("lockScreen.description")}</Text>
          <StyledInputContainer>
            <Input
              isPassword
              placeholder={t("lockScreen.passwordInputPlaceholder")}
              fieldSize="lg"
              value={passwordValue}
              onChangeText={handlePasswordChange}
            />
            {error && <Text>{error}</Text>}
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
          <Button secondary lg onPress={() => {}}>
            {t("lockScreen.forgotPasswordButtonText")}
          </Button>
        </ForgotPasswordContainer>
      </Container>
    </BaseLayout>
  );
};

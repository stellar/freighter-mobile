import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { PASSWORD_MIN_LENGTH } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback, useMemo, useState } from "react";

type LoginScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.LOGIN_SCREEN
>;

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const { t } = useAppTranslation();

  const canContinue = useMemo(
    () => confirmPasswordValue.length >= PASSWORD_MIN_LENGTH,
    [confirmPasswordValue],
  );

  const handleLogin = useCallback(() => {
    if (!canContinue) return;

    navigation.pop();
  }, [canContinue, navigation]);

  const handlePasswordChange = useCallback((value: string) => {
    setConfirmPasswordValue(value);
  }, []);

  return (
    <OnboardLayout
      icon={<Icon.PasscodeLock circle />}
      title={t("confirmPasswordScreen.title")}
      isDefaultActionButtonDisabled={!canContinue}
      defaultActionButtonText={t(
        "confirmPasswordScreen.defaultActionButtonText",
      )}
      footerNoteText={
        canContinue ? t("confirmPasswordScreen.footerNoteText") : undefined
      }
      onPressDefaultActionButton={handleLogin}
    >
      <Input
        isPassword
        placeholder={t("confirmPasswordScreen.passwordInputPlaceholder")}
        fieldSize="lg"
        note={t("confirmPasswordScreen.passwordNote")}
        value={confirmPasswordValue}
        onChangeText={handlePasswordChange}
      />
    </OnboardLayout>
  );
};

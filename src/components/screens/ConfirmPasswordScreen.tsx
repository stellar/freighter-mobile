import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { PASSWORD_MIN_LENGTH } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";

type ConfirmPasswordScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.CONFIRM_PASSWORD_SCREEN
>;

export const ConfirmPasswordScreen: React.FC<ConfirmPasswordScreenProps> = ({
  navigation,
  route,
}) => {
  const { password } = route.params;
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const { t } = useAppTranslation();

  const handleContinue = () => {
    navigation.navigate(AUTH_STACK_ROUTES.RECOVERY_PHRASE_ALERT_SCREEN);
  };

  const canContinue =
    confirmPasswordValue.length >= PASSWORD_MIN_LENGTH &&
    confirmPasswordValue === password;

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
      onPressDefaultActionButton={handleContinue}
    >
      <Input
        isPassword
        placeholder={t("confirmPasswordScreen.passwordInputPlaceholder")}
        fieldSize="lg"
        note={t("confirmPasswordScreen.passwordNote")}
        value={confirmPasswordValue}
        onChangeText={setConfirmPasswordValue}
      />
    </OnboardLayout>
  );
};

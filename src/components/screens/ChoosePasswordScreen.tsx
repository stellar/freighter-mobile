import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";

type ChoosePasswordScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN
>;

export const ChoosePasswordScreen: React.FC<ChoosePasswordScreenProps> = ({
  navigation,
  route,
}) => {
  const { isImporting } = route.params;
  const [password, setPassword] = useState("");
  const { t } = useAppTranslation();

  const handleContinue = () => {
    navigation.navigate(AUTH_STACK_ROUTES.CONFIRM_PASSWORD_SCREEN, {
      password,
      isImporting,
    });
  };

  const canContinue =
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH;

  return (
    <OnboardLayout
      icon={<Icon.PasscodeLock circle />}
      title={t("choosePasswordScreen.title")}
      isDefaultActionButtonDisabled={!canContinue}
      defaultActionButtonText={t(
        "choosePasswordScreen.defaultActionButtonText",
      )}
      footerNoteText={
        canContinue ? t("choosePasswordScreen.footerNoteText") : undefined
      }
      onPressDefaultActionButton={handleContinue}
    >
      <Input
        isPassword
        placeholder={t("choosePasswordScreen.passwordInputPlaceholder")}
        fieldSize="lg"
        note={t("choosePasswordScreen.passwordNote")}
        value={password}
        onChangeText={setPassword}
      />
    </OnboardLayout>
  );
};

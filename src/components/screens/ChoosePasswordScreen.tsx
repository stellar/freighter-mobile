import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

type ChoosePasswordScreenProps = {
  navigation: NativeStackNavigationProp<
    AuthStackParamList,
    typeof AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN
  >;
};

export const ChoosePasswordScreen: React.FC<ChoosePasswordScreenProps> = ({
  navigation,
}) => {
  const [passwordValue, setPasswordValue] = useState("");
  const { t } = useTranslation();

  const handleContinue = () => {
    navigation.navigate(AUTH_STACK_ROUTES.CONFIRM_PASSWORD_SCREEN);
  };

  const canContinue = passwordValue.length >= 8;

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
        value={passwordValue}
        onChangeText={setPasswordValue}
      />
    </OnboardLayout>
  );
};

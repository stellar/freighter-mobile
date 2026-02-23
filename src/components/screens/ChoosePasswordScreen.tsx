import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useLoginDataStore } from "ducks/loginData";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
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
  const [localPassword, setLocalPassword] = useState("");
  const { setPassword } = useLoginDataStore();
  const [localShowPassword, setLocalShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const handleContinue = () => {
    setPassword(localPassword);
    navigation.navigate(AUTH_STACK_ROUTES.CONFIRM_PASSWORD_SCREEN, {
      isImporting,
    });
  };

  const canContinue =
    localPassword.length >= PASSWORD_MIN_LENGTH &&
    localPassword.length <= PASSWORD_MAX_LENGTH;

  return (
    <OnboardLayout
      icon={
        <Icon.PasscodeLock
          circle
          circleBackground={themeColors.lilac[3]}
          circleBorder={themeColors.lilac[6]}
        />
      }
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
        autoCapitalize="none"
        isPassword
        secureTextEntry={!localShowPassword}
        placeholder={t("choosePasswordScreen.passwordInputPlaceholder")}
        fieldSize="lg"
        note={t("passwordInput.passwordNote")}
        error={error}
        value={localPassword}
        testID="password-input"
        onChangeText={(text) => {
          setLocalPassword(text);
          if (text.length > PASSWORD_MAX_LENGTH) {
            setError(t("choosePasswordScreen.passwordTooLong"));
          } else {
            setError(null);
          }
        }}
        rightElement={
          localShowPassword ? (
            <Icon.EyeOff
              testID="eye-icon-off"
              size={16}
              color={themeColors.foreground.primary}
              onPress={() => setLocalShowPassword(false)}
            />
          ) : (
            <Icon.Eye
              testID="eye-icon"
              size={16}
              color={themeColors.foreground.primary}
              onPress={() => setLocalShowPassword(true)}
            />
          )
        }
      />
    </OnboardLayout>
  );
};

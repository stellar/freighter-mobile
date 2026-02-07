import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useLoginDataStore } from "ducks/loginData";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback, useMemo, useState } from "react";

type ConfirmPasswordScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.CONFIRM_PASSWORD_SCREEN
>;

export const ConfirmPasswordScreen: React.FC<ConfirmPasswordScreenProps> = ({
  navigation,
  route,
}) => {
  const { password } = useLoginDataStore();
  const { isImporting } = route.params;
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const canContinue = useMemo(
    () =>
      confirmPasswordValue.length >= PASSWORD_MIN_LENGTH &&
      confirmPasswordValue.length <= PASSWORD_MAX_LENGTH &&
      confirmPasswordValue === password,
    [confirmPasswordValue, password],
  );

  const handleContinue = useCallback(() => {
    if (!canContinue) return;

    if (isImporting) {
      navigation.navigate(AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN);
    } else {
      navigation.navigate(AUTH_STACK_ROUTES.RECOVERY_PHRASE_ALERT_SCREEN);
    }
  }, [canContinue, isImporting, navigation]);

  const handlePasswordChange = useCallback((value: string) => {
    setConfirmPasswordValue(value);
  }, []);

  return (
    <OnboardLayout
      icon={
        <Icon.PasscodeLock
          circle
          circleBackground={themeColors.lilac[3]}
          circleBorder={themeColors.lilac[6]}
        />
      }
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
        autoCapitalize="none"
        isPassword
        secureTextEntry={!showPassword}
        placeholder={t("confirmPasswordScreen.passwordInputPlaceholder")}
        fieldSize="lg"
        note={t("passwordInput.passwordNote")}
        error={error}
        value={confirmPasswordValue}
        testID="confirm-password-input"
        onChangeText={(text) => {
          handlePasswordChange(text);
          if (text.length > PASSWORD_MAX_LENGTH) {
            setError(t("choosePasswordScreen.passwordTooLong"));
          } else {
            setError(null);
          }
        }}
        rightElement={
          showPassword ? (
            <Icon.EyeOff
              testID="eye-icon-off"
              size={16}
              color={themeColors.foreground.primary}
              onPress={() => setShowPassword(false)}
            />
          ) : (
            <Icon.Eye
              testID="eye-icon"
              size={16}
              color={themeColors.foreground.primary}
              onPress={() => setShowPassword(true)}
            />
          )
        }
      />
    </OnboardLayout>
  );
};

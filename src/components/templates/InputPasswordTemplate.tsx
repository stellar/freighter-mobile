import { PasswordField } from "components/PasswordField";
import { VarialLogo } from "components/VarialLogo";
import { BaseLayout, BaseLayoutInsets } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { BiometricToggleButton } from "components/sds/BiometricToggleButton";
import { Button } from "components/sds/Button";
import { Display, Text } from "components/sds/Typography";
import { LoginType } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { isValidPasswordLength } from "helpers/passwordValidation";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { TextInput, View } from "react-native";

interface InputPasswordTemplateProps {
  publicKey: string | null;
  error: string | null;
  handleContinue:
    | ((password: string) => void)
    | ((password: string) => Promise<unknown>);
  isLoading: boolean;
  handleLogout?: () => void;
  continueButtonText?: string;
  title?: string;
  description?: string;
  showLogo?: boolean;
  /** Whether to focus the password field on mount. Defaults to true. */
  autoFocus?: boolean;
  insets?: BaseLayoutInsets;
  testID?: string;
  continueButtonTestID?: string;
  forgotPasswordButtonTestID?: string;
}

const InputPasswordTemplate: React.FC<InputPasswordTemplateProps> = ({
  publicKey,
  error,
  handleContinue,
  isLoading,
  handleLogout,
  continueButtonText,
  title,
  description,
  insets,
  showLogo = true,
  autoFocus = true,
  testID,
  continueButtonTestID,
  forgotPasswordButtonTestID,
}) => {
  const { t } = useAppTranslation();
  const [passwordValue, setPasswordValue] = useState("");
  const inputRef = useRef<TextInput>(null);
  const { signInMethod } = useAuthenticationStore();

  const canContinue = useMemo(
    () =>
      isValidPasswordLength(passwordValue) ||
      signInMethod !== LoginType.PASSWORD,
    [passwordValue, signInMethod],
  );

  const handlePasswordChange = useCallback((value: string) => {
    setPasswordValue(value);
  }, []);

  return (
    <BaseLayout
      useSafeArea
      useKeyboardAvoidingView
      insets={insets}
      testID={testID}
    >
      <View className="flex-1 justify-between">
        <View className="items-center mt-10">{showLogo && <VarialLogo />}</View>
        <View className="items-center justify-center bg-background-tertiary rounded-2xl p-8 gap-2 mt-4 mb-10">
          <Avatar size="xl" publicAddress={publicKey ?? ""} hasDarkBackground />
          <Display xs semiBold>
            {title ?? t("lockScreen.title")}
          </Display>
          <Text
            secondary
            style={{
              textAlign: "center",
            }}
          >
            {description ?? t("lockScreen.description")}
          </Text>
          <View className="w-full gap-4 mt-8">
            {signInMethod === LoginType.PASSWORD && (
              <PasswordField
                ref={inputRef}
                testID="password-input"
                placeholder={t("lockScreen.passwordInputPlaceholder")}
                value={passwordValue}
                onChangeText={handlePasswordChange}
                error={error}
                autoFocus={autoFocus}
              />
            )}
            <Button
              biometric
              secondary
              xl
              onPress={(password) => {
                handleContinue((password as string) ?? passwordValue);
              }}
              disabled={!canContinue}
              isLoading={isLoading}
              testID={continueButtonTestID}
            >
              {continueButtonText ?? t("lockScreen.unlockButtonText")}
            </Button>
            <BiometricToggleButton size="xl" />
          </View>
        </View>

        <View className="mt-4">
          {handleLogout && (
            <Button
              tertiary
              xl
              onPress={handleLogout}
              testID={forgotPasswordButtonTestID}
            >
              {t("lockScreen.forgotPasswordButtonText")}
            </Button>
          )}
        </View>
      </View>
    </BaseLayout>
  );
};

export default InputPasswordTemplate;

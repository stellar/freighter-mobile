import { FreighterLogo } from "components/FreighterLogo";
import { BaseLayout, BaseLayoutInsets } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { BiometricToggleButton } from "components/sds/BiometricToggleButton";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Display, Text } from "components/sds/Typography";
import {
  LoginType,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
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
  insets?: BaseLayoutInsets;
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
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { signInMethod } = useAuthenticationStore();

  const canContinue = useMemo(
    () =>
      (passwordValue.length >= PASSWORD_MIN_LENGTH &&
        passwordValue.length <= PASSWORD_MAX_LENGTH) ||
      signInMethod !== LoginType.PASSWORD,
    [passwordValue, signInMethod],
  );

  const handlePasswordChange = useCallback((value: string) => {
    setPasswordValue(value);
  }, []);

  return (
    <BaseLayout useSafeArea useKeyboardAvoidingView insets={insets}>
      <View className="flex-1 justify-between">
        <View className="items-center mt-10">
          {showLogo && <FreighterLogo />}
        </View>
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
              <Input
                ref={inputRef}
                secureTextEntry={!showPassword}
                isPassword
                placeholder={t("lockScreen.passwordInputPlaceholder")}
                fieldSize="lg"
                autoCapitalize="none"
                value={passwordValue}
                onChangeText={handlePasswordChange}
                error={error}
                autoFocus
                rightElement={
                  showPassword ? (
                    <Icon.EyeOff
                      size={16}
                      color={themeColors.foreground.primary}
                      onPress={() => setShowPassword(false)}
                    />
                  ) : (
                    <Icon.Eye
                      size={16}
                      color={themeColors.foreground.primary}
                      onPress={() => setShowPassword(true)}
                    />
                  )
                }
              />
            )}
            <Button
              biometric
              tertiary
              xl
              onPress={(password) => {
                handleContinue((password as string) ?? passwordValue);
              }}
              disabled={!canContinue}
              isLoading={isLoading}
            >
              {continueButtonText ?? t("lockScreen.unlockButtonText")}
            </Button>
            <BiometricToggleButton size="sm" />
          </View>
        </View>

        <View className="mt-4">
          {handleLogout && (
            <Button secondary xl onPress={handleLogout}>
              {t("lockScreen.forgotPasswordButtonText")}
            </Button>
          )}
        </View>
      </View>
    </BaseLayout>
  );
};

export default InputPasswordTemplate;

import { FreighterLogo } from "components/FreighterLogo";
import { BaseLayout, BaseLayoutInsets } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { BiometricToggleButton } from "components/sds/BiometricToggleButton";
import { Button, IconPosition } from "components/sds/Button";
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
  const [passwordValue, setPasswordValue] = useState("");
  const inputRef = useRef<TextInput>(null);
  const { themeColors } = useColors();
  const { signInMethod, verifyActionWithBiometrics } = useAuthenticationStore();

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

  const getButtonIcon = useCallback(() => {
    if (signInMethod === LoginType.PASSWORD) {
      return undefined;
    }
    if (signInMethod === LoginType.FACE) {
      return <Icon.FaceId color={themeColors.foreground.secondary} />;
    }
    return <Icon.Fingerprint01 color={themeColors.foreground.secondary} />;
  }, [signInMethod, themeColors]);

  const handleContinueWithFaceId = useCallback(() => {
    verifyActionWithBiometrics((password) => {
      handleContinue(password);
      return Promise.resolve();
    });
  }, [handleContinue, verifyActionWithBiometrics]);

  return (
    <BaseLayout useSafeArea useKeyboardAvoidingView insets={insets}>
      <View className="flex-1 justify-between">
        <View className="items-center mt-10">
          {showLogo && <FreighterLogo />}
        </View>
        <View className="items-center justify-center bg-background-tertiary rounded-2xl p-8 gap-2 mt-4 mb-10">
          <Avatar size="xl" publicAddress={publicKey ?? ""} />
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
                isPassword
                placeholder={t("lockScreen.passwordInputPlaceholder")}
                fieldSize="lg"
                autoCapitalize="none"
                value={passwordValue}
                onChangeText={handlePasswordChange}
                error={error}
                autoFocus
              />
            )}
            <Button
              tertiary
              lg
              onPress={handleContinueWithFaceId}
              disabled={!canContinue && signInMethod === LoginType.PASSWORD}
              icon={getButtonIcon()}
              iconPosition={IconPosition.LEFT}
              isLoading={isLoading}
            >
              {continueButtonText ?? t("lockScreen.unlockButtonText")}
            </Button>
            <BiometricToggleButton size="sm" />
          </View>
        </View>

        <View className="mt-4">
          {handleLogout && (
            <Button secondary lg onPress={handleLogout}>
              {t("lockScreen.forgotPasswordButtonText")}
            </Button>
          )}
        </View>
      </View>
    </BaseLayout>
  );
};

export default InputPasswordTemplate;

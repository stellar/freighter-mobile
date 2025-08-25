import { FreighterLogo } from "components/FreighterLogo";
import { BaseLayout, BaseLayoutInsets } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Display, Text } from "components/sds/Typography";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { BIOMETRY_TYPE } from "react-native-keychain";

enum BiometricsLoginType {
  FACE_ID = "faceId",
  FINGERPRINT = "fingerprint",
  PASSWORD = "password",
}

interface InputPasswordTemplateProps {
  publicKey: string | null;
  error: string | null;
  handleContinue: (password: string) => void;
  isLoading: boolean;
  handleLogout?: () => void;
  continueButtonText?: string;
  title?: string;
  description?: string;
  showLogo?: boolean;
  insets?: BaseLayoutInsets;
  signInMethod: BiometricsLoginType;
  setSignInMethod: (method: BiometricsLoginType) => void;
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
  signInMethod,
  setSignInMethod,
}) => {
  const { t } = useAppTranslation();
  const [passwordValue, setPasswordValue] = useState("");
  const inputRef = useRef<TextInput>(null);
  const { themeColors } = useColors();
  const { isBiometricsAvailable, biometryType } = useBiometrics();

  const canContinue = useMemo(
    () =>
      (passwordValue.length >= PASSWORD_MIN_LENGTH &&
        passwordValue.length <= PASSWORD_MAX_LENGTH) ||
      signInMethod === BiometricsLoginType.FACE_ID ||
      signInMethod === BiometricsLoginType.FINGERPRINT,
    [passwordValue, signInMethod],
  );

  const handlePasswordChange = useCallback((value: string) => {
    setPasswordValue(value);
  }, []);

  const fallbackButtonText: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("lockScreen.useFaceIdInstead"),
      [BIOMETRY_TYPE.FINGERPRINT]: t("lockScreen.useFingerprintInstead"),
      [BIOMETRY_TYPE.FACE]: t("lockScreen.useFaceRecognitionInstead"),
      [BIOMETRY_TYPE.TOUCH_ID]: t("lockScreen.useTouchIdInstead"),
    }),
    [t],
  );
  const handleFaceIdToggle = useCallback(() => {
    setSignInMethod(
      signInMethod === BiometricsLoginType.FACE_ID
        ? BiometricsLoginType.PASSWORD
        : BiometricsLoginType.FACE_ID,
    );
  }, [signInMethod, setSignInMethod]);

  const getButtonIcon = useCallback(() => {
    if (signInMethod === BiometricsLoginType.PASSWORD) {
      return undefined;
    }
    if (signInMethod === BiometricsLoginType.FACE_ID) {
      return <Icon.FaceId color={themeColors.foreground.secondary} />;
    }
    return <Icon.Fingerprint01 color={themeColors.foreground.secondary} />;
  }, [signInMethod, themeColors]);

  const handleContinueWithFaceId = useCallback(() => {
    if (signInMethod === BiometricsLoginType.PASSWORD) {
      handleContinue(passwordValue);
    } else {
      handleContinue("");
    }
  }, [handleContinue, passwordValue, signInMethod]);

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
            {signInMethod === BiometricsLoginType.PASSWORD && (
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
              disabled={
                !canContinue && signInMethod === BiometricsLoginType.PASSWORD
              }
              icon={getButtonIcon()}
              iconPosition={IconPosition.LEFT}
              isLoading={isLoading}
            >
              {continueButtonText ?? t("lockScreen.unlockButtonText")}
            </Button>
            {isBiometricsAvailable && (
              <Button minimal sm onPress={handleFaceIdToggle}>
                {biometryType && signInMethod === BiometricsLoginType.PASSWORD
                  ? fallbackButtonText[biometryType]
                  : t("lockScreen.enterPassword")}
              </Button>
            )}
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

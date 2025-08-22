import { FreighterLogo } from "components/FreighterLogo";
import { BaseLayout, BaseLayoutInsets } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Display, Text } from "components/sds/Typography";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useFaceId } from "hooks/useFaceId";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TextInput, View } from "react-native";

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
  signInMethod: "password" | "faceId";
  setSignInMethod: (method: "password" | "faceId") => void;
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
  const { isFaceIdActive, verifyFaceId } = useFaceId();
  const { themeColors } = useColors();

  const canContinue = useMemo(
    () =>
      (passwordValue.length >= PASSWORD_MIN_LENGTH &&
        passwordValue.length <= PASSWORD_MAX_LENGTH) ||
      signInMethod === "faceId",
    [passwordValue, signInMethod],
  );

  const handlePasswordChange = useCallback((value: string) => {
    setPasswordValue(value);
  }, []);

  const handleFaceIdToggle = useCallback(() => {
    setSignInMethod(signInMethod === "faceId" ? "password" : "faceId");
  }, [signInMethod, setSignInMethod]);

  const handleContinueWithFaceId = useCallback(async () => {
    if (signInMethod === "password") {
      handleContinue(passwordValue);
    } else {
      const result = await verifyFaceId();
      if (result.success) {
        handleContinue("");
      }
    }
  }, [handleContinue, passwordValue, verifyFaceId, signInMethod]);

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
            {signInMethod === "password" && (
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
              disabled={!canContinue && signInMethod === "password"}
              icon={
                signInMethod === "password" ? undefined : (
                  <Icon.FaceId color={themeColors.foreground.secondary} />
                )
              }
              iconPosition={IconPosition.LEFT}
              isLoading={isLoading}
            >
              {continueButtonText ?? t("lockScreen.unlockButtonText")}
            </Button>
            {isFaceIdActive && (
              <Button minimal sm onPress={handleFaceIdToggle}>
                {signInMethod === "password"
                  ? t("lockScreen.useFaceId")
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

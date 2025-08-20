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
import React, { useCallback, useMemo, useRef, useState } from "react";
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
  const { isFaceIdActive } = useFaceId();
  const [isPasswordFieldVisible, setIsPasswordFieldVisible] =
    useState(!isFaceIdActive);
  const { themeColors } = useColors();

  const canContinue = useMemo(
    () =>
      passwordValue.length >= PASSWORD_MIN_LENGTH &&
      passwordValue.length <= PASSWORD_MAX_LENGTH,
    [passwordValue],
  );

  const handlePasswordChange = useCallback((value: string) => {
    setPasswordValue(value);
  }, []);

  const handleFaceIdToggle = useCallback(() => {
    setIsPasswordFieldVisible(!isPasswordFieldVisible);
  }, [isPasswordFieldVisible]);

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
            {isPasswordFieldVisible && (
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
              onPress={() => handleContinue(passwordValue)}
              disabled={!canContinue && isPasswordFieldVisible}
              icon={
                isPasswordFieldVisible ? undefined : (
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
                {isPasswordFieldVisible
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

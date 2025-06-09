import FreighterLogo from "assets/logos/freighter-logo-dark.svg";
import { BaseLayout, BaseLayoutInsets } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { Display, Text } from "components/sds/Typography";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "config/constants";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
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

  const canContinue = useMemo(
    () =>
      passwordValue.length >= PASSWORD_MIN_LENGTH &&
      passwordValue.length <= PASSWORD_MAX_LENGTH,
    [passwordValue],
  );

  const handlePasswordChange = useCallback((value: string) => {
    setPasswordValue(value);
  }, []);

  return (
    <BaseLayout useSafeArea useKeyboardAvoidingView insets={insets}>
      <View className="flex-1 justify-between">
        <View className="items-center">
          {showLogo && <FreighterLogo width={px(48)} height={px(48)} />}
        </View>
        <View className="items-center justify-center bg-background-tertiary rounded-2xl p-8 gap-2">
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
            <Button
              tertiary
              lg
              onPress={() => handleContinue(passwordValue)}
              disabled={!canContinue}
              isLoading={isLoading}
            >
              {continueButtonText ?? t("lockScreen.unlockButtonText")}
            </Button>
          </View>
        </View>
        <View>
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

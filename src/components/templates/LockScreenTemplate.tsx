import { WelcomeHeader } from "components/WelcomeHeader";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { LoginType } from "config/constants";
import { isValidPasswordLength } from "helpers/passwordValidation";
import useAppTranslation from "hooks/useAppTranslation";
import useTheme from "hooks/useTheme";
import React, { useCallback, useState } from "react";
import { TouchableOpacity, View } from "react-native";

const ICON_SIZE = 20;
// Grows the 20px icons beside the password to a 44px touch target
const ICON_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/** The ways biometrics can unlock the wallet, which pick the button's icon. */
export type BiometricLoginType = LoginType.FACE | LoginType.FINGERPRINT;

interface LockScreenTemplateProps {
  /** Shown under the password field, e.g. for a wrong password. */
  error: string | null;
  /** Whether an unlock is in flight, by password or by biometrics. */
  isUnlocking: boolean;
  /** Whether to focus the password field on mount. */
  autoFocus: boolean;
  /**
   * How biometrics unlock this wallet. Null when they can't, in which case the
   * password field offers to show the password instead.
   */
  biometricLoginType: BiometricLoginType | null;
  onUnlock: (password: string) => void | Promise<unknown>;
  onBiometricUnlock: () => void;
  onForgotPassword: () => void;
}

/**
 * The lock screen's layout: the Varial mark, the greeting and a password
 * field above the unlock actions, all centered on the screen as one block.
 * BaseLayout's keyboard avoidance, the one the other form screens use,
 * re-centers the block in the space left above the keyboard.
 *
 * Design: https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=2554-154967
 * (biometrics) and ?node-id=2554-155239 (password only).
 */
const LockScreenTemplate: React.FC<LockScreenTemplateProps> = ({
  error,
  isUnlocking,
  autoFocus,
  biometricLoginType,
  onUnlock,
  onBiometricUnlock,
  onForgotPassword,
}) => {
  const { t } = useAppTranslation();
  const theme = useTheme();
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const canUnlock = isValidPasswordLength(password);
  const iconColor = theme.colors.foreground.primary;

  // Shared by the button and the keyboard's return key, which stays live
  // whatever the password, so the check can't rest on the disabled button.
  const handleUnlock = useCallback(() => {
    if (canUnlock) {
      onUnlock(password);
    }
  }, [canUnlock, onUnlock, password]);

  const togglePasswordVisibility = useCallback(() => {
    setIsPasswordVisible((isVisible) => !isVisible);
  }, []);

  const passwordAccessory = biometricLoginType ? (
    <TouchableOpacity
      testID="biometrics-button"
      onPress={onBiometricUnlock}
      disabled={isUnlocking}
      hitSlop={ICON_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={t("lockScreen.unlockWithBiometrics")}
    >
      {biometricLoginType === LoginType.FACE ? (
        <Icon.FaceId size={ICON_SIZE} color={iconColor} />
      ) : (
        <Icon.Fingerprint01 size={ICON_SIZE} color={iconColor} />
      )}
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      testID="password-visibility-button"
      onPress={togglePasswordVisibility}
      hitSlop={ICON_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={
        isPasswordVisible
          ? t("lockScreen.hidePassword")
          : t("lockScreen.showPassword")
      }
    >
      {isPasswordVisible ? (
        <Icon.EyeOff size={ICON_SIZE} color={iconColor} />
      ) : (
        <Icon.Eye size={ICON_SIZE} color={iconColor} />
      )}
    </TouchableOpacity>
  );

  return (
    <BaseLayout useSafeArea useKeyboardAvoidingView testID="lock-screen">
      <View className="flex-1 justify-center">
        <View className="items-center gap-[40px]">
          <WelcomeHeader title={t("lockScreen.title")} />
          <View className="self-stretch">
            <Input
              testID="password-input"
              fieldSize="xl"
              isPassword
              secureTextEntry={!isPasswordVisible}
              placeholder={t("lockScreen.passwordInputPlaceholder")}
              placeholderTextColor={theme.colors.foreground.primary}
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              error={error}
              autoFocus={autoFocus}
              returnKeyType="go"
              // Keeps the keyboard up, so a wrong password can be retyped
              // straight away
              submitBehavior="submit"
              onSubmitEditing={handleUnlock}
              rightElement={passwordAccessory}
            />
          </View>
        </View>
        <View className="mt-[24px] gap-[8px]">
          <Button
            secondary
            xl
            onPress={handleUnlock}
            disabled={!canUnlock}
            isLoading={isUnlocking}
            testID="unlock-button"
          >
            {t("lockScreen.unlockButtonText")}
          </Button>
          <Button
            minimal
            xl
            onPress={onForgotPassword}
            testID="forgot-password-button"
          >
            {t("lockScreen.forgotPasswordButtonText")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default LockScreenTemplate;

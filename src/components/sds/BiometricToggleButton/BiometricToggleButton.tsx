import { Button } from "components/sds/Button";
import { LoginType } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import React, { useCallback, useMemo } from "react";
import { BIOMETRY_TYPE } from "react-native-keychain";

/**
 * Props for the BiometricToggleButton component
 */
interface BiometricToggleButtonProps {
  /** Size variant of the button (sm, md, lg) */
  size?: "sm" | "md" | "lg";
}

/**
 * BiometricToggleButton Component
 *
 * A toggle button that allows users to switch between password and biometric authentication methods.
 * The button automatically adapts its text and behavior based on the current authentication method
 * and available biometric types (Face ID, Touch ID, or fingerprint).
 *
 * The button only renders when biometrics are available and enabled. When using password authentication,
 * it shows the biometric option. When using biometrics, it shows the password option.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <BiometricToggleButton size="md" />
 * ```
 *
 * @example
 * With custom size:
 * ```tsx
 * <BiometricToggleButton size="lg" />
 * ```
 *
 * @param props - Component props
 * @param props.size - Size variant of the button (defaults to "sm")
 * @returns React component for toggling between authentication methods, or null if biometrics unavailable
 */
export const BiometricToggleButton: React.FC<BiometricToggleButtonProps> = ({
  size = "sm",
}) => {
  const { t } = useAppTranslation();
  const { signInMethod, setSignInMethod } = useAuthenticationStore();
  const { isBiometricsEnrolled, isBiometricsEnabled, biometryType } =
    useBiometrics();

  const fallbackButtonText: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("lockScreen.useFaceIdInstead"),
      [BIOMETRY_TYPE.FINGERPRINT]: t("lockScreen.useFingerprintInstead"),
      [BIOMETRY_TYPE.FACE]: t("lockScreen.useFaceRecognitionInstead"),
      [BIOMETRY_TYPE.TOUCH_ID]: t("lockScreen.useTouchIdInstead"),
      [BIOMETRY_TYPE.OPTIC_ID]: t("lockScreen.useOpticIdInstead"),
      [BIOMETRY_TYPE.IRIS]: t("lockScreen.useIrisInstead"),
    }),
    [t],
  );

  const handleToggle = useCallback(() => {
    if (signInMethod === LoginType.PASSWORD) {
      if (!isBiometricsEnrolled || !isBiometricsEnabled) {
        return;
      }

      // Switch to biometrics if available and enabled
      if ([BIOMETRY_TYPE.FACE_ID, BIOMETRY_TYPE.FACE].includes(biometryType!)) {
        setSignInMethod(LoginType.FACE);
      } else if (
        [BIOMETRY_TYPE.TOUCH_ID, BIOMETRY_TYPE.FINGERPRINT].includes(
          biometryType!,
        )
      ) {
        setSignInMethod(LoginType.FINGERPRINT);
      }
    } else {
      // Switch back to password
      setSignInMethod(LoginType.PASSWORD);
    }
  }, [
    signInMethod,
    setSignInMethod,
    isBiometricsEnrolled,
    isBiometricsEnabled,
    biometryType,
  ]);

  // Don't render if biometrics is not available or not enabled
  if (!isBiometricsEnrolled || !isBiometricsEnabled) {
    return null;
  }

  // If currently using password, show the biometric option
  if (signInMethod === LoginType.PASSWORD) {
    return (
      <Button minimal size={size} onPress={handleToggle}>
        {biometryType && fallbackButtonText[biometryType]
          ? fallbackButtonText[biometryType]
          : t("lockScreen.enterPasswordInstead")}
      </Button>
    );
  }

  // If currently using biometrics, show the password option
  return (
    <Button minimal size={size} onPress={handleToggle}>
      {t("lockScreen.enterPasswordInstead")}
    </Button>
  );
};

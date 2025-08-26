import { Button } from "components/sds/Button";
import { LoginType } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import React, { useCallback, useMemo } from "react";
import { BIOMETRY_TYPE } from "react-native-keychain";

interface BiometricToggleButtonProps {
  size?: "sm" | "md" | "lg";
}

export const BiometricToggleButton: React.FC<BiometricToggleButtonProps> = ({
  size = "sm",
}) => {
  const { t } = useAppTranslation();
  const { signInMethod, setSignInMethod } = useAuthenticationStore();
  const { isBiometricsAvailable, isBiometricsEnabled, biometryType } =
    useBiometrics();

  const fallbackButtonText: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("lockScreen.useFaceIdInstead"),
      [BIOMETRY_TYPE.FINGERPRINT]: t("lockScreen.useFingerprintInstead"),
      [BIOMETRY_TYPE.FACE]: t("lockScreen.useFaceRecognitionInstead"),
      [BIOMETRY_TYPE.TOUCH_ID]: t("lockScreen.useTouchIdInstead"),
    }),
    [t],
  );

  const handleToggle = useCallback(() => {
    if (signInMethod === LoginType.PASSWORD) {
      if (!isBiometricsAvailable || !isBiometricsEnabled) {
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
    isBiometricsAvailable,
    isBiometricsEnabled,
    biometryType,
  ]);

  // Don't render if biometrics is not available or not enabled
  if (!isBiometricsAvailable || !isBiometricsEnabled) {
    return null;
  }

  // If currently using password, show the biometric option
  if (signInMethod === LoginType.PASSWORD) {
    return (
      <Button minimal size={size} onPress={handleToggle}>
        {biometryType && fallbackButtonText[biometryType]
          ? fallbackButtonText[biometryType]
          : t("lockScreen.enterPassword")}
      </Button>
    );
  }

  // If currently using biometrics, show the password option
  return (
    <Button minimal size={size} onPress={handleToggle}>
      {t("lockScreen.enterPassword")}
    </Button>
  );
};

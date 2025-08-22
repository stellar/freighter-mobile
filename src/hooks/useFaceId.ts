import { usePreferencesStore } from "ducks/preferences";
import useAppTranslation from "hooks/useAppTranslation";
import { useCallback, useEffect, useState } from "react";
import ReactNativeBiometrics from "react-native-biometrics";

const rnBiometrics = new ReactNativeBiometrics();

export const useFaceId = () => {
  const [isFaceIdAvailable, setIsFaceIdAvailable] = useState(false);
  const { isFaceIdEnabled, setIsFaceIdEnabled } = usePreferencesStore();
  const { t } = useAppTranslation();

  const checkFaceIdAvailability = useCallback(async (): Promise<boolean> => {
    const result = await rnBiometrics.isSensorAvailable();
    const { available, biometryType } = result;
    const canUseFaceId = available && biometryType === "FaceID";
    setIsFaceIdAvailable(canUseFaceId);
    return canUseFaceId;
  }, []);

  const verifyFaceId = useCallback(async (): Promise<
    ReturnType<typeof rnBiometrics.simplePrompt>
  > => {
    if (!isFaceIdAvailable) {
      return { success: false, error: "Face ID is not available" };
    }

    const result = await rnBiometrics.simplePrompt({
      promptMessage: t("securityScreen.faceId.alert.disable.message"),
    });

    return result;
  }, [t, isFaceIdAvailable]);

  const enableFaceId = useCallback(async (): Promise<boolean> => {
    const isAvailable = await checkFaceIdAvailability();
    if (!isAvailable) return false;

    setIsFaceIdEnabled(true);
    return true;
  }, [setIsFaceIdEnabled, checkFaceIdAvailability]);

  const disableFaceId = useCallback(async (): Promise<boolean> => {
    const result = await verifyFaceId();
    if (!result.success) return false;

    setIsFaceIdEnabled(false);
    return true;
  }, [setIsFaceIdEnabled, verifyFaceId]);

  useEffect(() => {
    checkFaceIdAvailability();
  }, [checkFaceIdAvailability]);

  return {
    isFaceIdAvailable,
    isFaceIdEnabled,
    isFaceIdActive: isFaceIdAvailable && isFaceIdEnabled,
    setIsFaceIdEnabled,
    verifyFaceId,
    enableFaceId,
    disableFaceId,
  };
};

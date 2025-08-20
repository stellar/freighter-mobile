import { usePreferencesStore } from "ducks/preferences";
import useAppTranslation from "hooks/useAppTranslation";
import { useCallback, useEffect, useState } from "react";
import ReactNativeBiometrics from "react-native-biometrics";

const rnBiometrics = new ReactNativeBiometrics();

export const useFaceId = () => {
  const [isFaceIdAvailable, setIsFaceIdAvailable] = useState(false);
  const { isFaceIdEnabled, setIsFaceIdEnabled } = usePreferencesStore();
  const { t } = useAppTranslation();
  const checkFaceIdAvailability = useCallback(async (): Promise<void> => {
    const result = await rnBiometrics.isSensorAvailable();
    const { available, biometryType } = result;
    setIsFaceIdAvailable(available && biometryType === "FaceID");
  }, []);

  const verifyFaceId = useCallback(async (): Promise<
    ReturnType<typeof rnBiometrics.simplePrompt>
  > => {
    const result = await rnBiometrics.simplePrompt({
      promptMessage: t("securityScreen.faceId.alert.disable.message"),
    });

    return result;
  }, [t]);

  useEffect(() => {
    checkFaceIdAvailability();
  }, [checkFaceIdAvailability]);

  return {
    isFaceIdAvailable,
    isFaceIdEnabled,
    isFaceIdActive: isFaceIdAvailable && isFaceIdEnabled,
    setIsFaceIdEnabled,
    verifyFaceId,
  };
};

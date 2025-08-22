import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import { useCallback, useEffect, useState } from "react";
import * as Keychain from "react-native-keychain";

export const useFaceId = () => {
  const [isFaceIdAvailable, setIsFaceIdAvailable] = useState(false);
  const { isFaceIdEnabled, setIsFaceIdEnabled } = usePreferencesStore();
  const { disableFaceId } = useAuthenticationStore();

  const checkFaceIdAvailability = useCallback(async (): Promise<boolean> => {
    const biometryType = await Keychain.getSupportedBiometryType();
    setIsFaceIdAvailable(biometryType === Keychain.BIOMETRY_TYPE.FACE_ID);
    return biometryType === Keychain.BIOMETRY_TYPE.FACE_ID;
  }, []);

  const handleEnableFaceId = useCallback(async (): Promise<boolean> => {
    const biometryType = await Keychain.getSupportedBiometryType();
    if (biometryType !== Keychain.BIOMETRY_TYPE.FACE_ID) return false;

    setIsFaceIdEnabled(true);
    return true;
  }, [setIsFaceIdEnabled]);

  const handleDisableFaceId = useCallback(async (): Promise<boolean> => {
    const success = await disableFaceId();
    if (!success) return false;

    setIsFaceIdEnabled(false);
    return true;
  }, [disableFaceId, setIsFaceIdEnabled]);

  useEffect(() => {
    checkFaceIdAvailability();
  }, [checkFaceIdAvailability]);

  return {
    isFaceIdAvailable,
    isFaceIdEnabled,
    isFaceIdActive: isFaceIdAvailable && isFaceIdEnabled,
    setIsFaceIdEnabled,
    enableFaceId: handleEnableFaceId,
    disableFaceId: handleDisableFaceId,
  };
};

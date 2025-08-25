import { BIOMETRIC_STORAGE_KEYS } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import { useCallback, useEffect, useState } from "react";
import * as Keychain from "react-native-keychain";
import { biometricDataStorage } from "services/storage/storageFactory";

export const FACE_ID_BIOMETRY_TYPES = [
  Keychain.BIOMETRY_TYPE.FACE_ID,
  Keychain.BIOMETRY_TYPE.FACE,
];

export const FINGERPRINT_BIOMETRY_TYPES = [
  Keychain.BIOMETRY_TYPE.FINGERPRINT,
  Keychain.BIOMETRY_TYPE.TOUCH_ID,
];

export const useBiometrics = () => {
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  const [biometryType, setBiometryType] =
    useState<Keychain.BIOMETRY_TYPE | null>(null);
  const { isBiometricsEnabled, setIsBiometricsEnabled } = usePreferencesStore();
  const { disableBiometrics } = useAuthenticationStore();

  const checkBiometricsAvailability =
    useCallback(async (): Promise<boolean> => {
      const type = await Keychain.getSupportedBiometryType();
      if (!type) {
        return false;
      }

      setBiometryType(type);
      setIsBiometricsAvailable(true);
      return true;
    }, []);

  const handleEnableBiometrics = useCallback(async (): Promise<boolean> => {
    const isAvailable = await checkBiometricsAvailability();
    if (!isAvailable) {
      return false;
    }

    setIsBiometricsEnabled(true);
    return true;
  }, [setIsBiometricsEnabled, checkBiometricsAvailability]);

  const handleDisableBiometrics = useCallback(async (): Promise<boolean> => {
    const success = await disableBiometrics();
    setIsBiometricsEnabled(false);
    return success;
  }, [disableBiometrics, setIsBiometricsEnabled]);

  useEffect(() => {
    const checkIfBiometricsIsEnabled = async () => {
      const isAvailable = await checkBiometricsAvailability();
      const hasPaswordSaved = await biometricDataStorage.checkIfExists(
        BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
      );
      if (!isAvailable || !isBiometricsEnabled || !hasPaswordSaved) {
        setIsBiometricsEnabled(false);
        return;
      }

      setIsBiometricsEnabled(
        hasPaswordSaved && isBiometricsEnabled && isAvailable,
      );
    };
    checkIfBiometricsIsEnabled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkBiometricsAvailability, setIsBiometricsEnabled]);

  return {
    isBiometricsActive: !!(isBiometricsAvailable && isBiometricsEnabled),
    isBiometricsAvailable,
    biometryType,
    setIsBiometricsEnabled,
    isBiometricsEnabled,
    enableBiometrics: handleEnableBiometrics,
    disableBiometrics: handleDisableBiometrics,
  };
};

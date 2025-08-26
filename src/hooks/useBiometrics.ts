import { BIOMETRIC_STORAGE_KEYS } from "config/constants";
import { getLoginType, useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import { useCallback, useEffect, useState } from "react";
import * as Keychain from "react-native-keychain";
import { biometricDataStorage } from "services/storage/storageFactory";

export const useBiometrics = () => {
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  const [biometryType, setBiometryType] =
    useState<Keychain.BIOMETRY_TYPE | null>(null);
  const { isBiometricsEnabled, setIsBiometricsEnabled } = usePreferencesStore();
  const { verifyBiometrics, getTemporaryStore, setSignInMethod } =
    useAuthenticationStore();

  const checkBiometricsType =
    useCallback(async (): Promise<Keychain.BIOMETRY_TYPE | null> => {
      const type = await Keychain.getSupportedBiometryType();
      if (!type) {
        return null;
      }

      setBiometryType(type);
      setIsBiometricsAvailable(true);
      return type;
    }, []);

  const handleEnableBiometrics = useCallback(async (): Promise<boolean> => {
    const type = await checkBiometricsType();
    if (!type) {
      return false;
    }

    const isBiometricPasswordStored = await biometricDataStorage.checkIfExists(
      BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
    );

    if (isBiometricPasswordStored) {
      setIsBiometricsEnabled(true);
      return true;
    }

    const temporaryStore = await getTemporaryStore();
    if (!temporaryStore) {
      return false;
    }
    const { password } = temporaryStore;
    if (!password) {
      return false;
    }
    await biometricDataStorage.setItem(
      BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
      password,
    );

    setIsBiometricsEnabled(true);
    setSignInMethod(getLoginType(biometryType));
    return true;
  }, [
    setIsBiometricsEnabled,
    checkBiometricsType,
    getTemporaryStore,
    biometryType,
    setSignInMethod,
  ]);

  const handleDisableBiometrics = useCallback(async (): Promise<boolean> => {
    const success = await verifyBiometrics();
    if (success) {
      setIsBiometricsEnabled(false);
    }
    return success;
  }, [verifyBiometrics, setIsBiometricsEnabled]);

  useEffect(() => {
    const checkIfBiometricsIsEnabled = async () => {
      const type = await checkBiometricsType();
      const hasPaswordSaved = await biometricDataStorage.checkIfExists(
        BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
      );
      if (!type || !isBiometricsEnabled || !hasPaswordSaved) {
        setIsBiometricsEnabled(false);
        return;
      }

      setIsBiometricsEnabled(hasPaswordSaved && isBiometricsEnabled && !!type);
      setSignInMethod(getLoginType(type));
    };
    checkIfBiometricsIsEnabled();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- we don't want to re-run this effect when the biometrics are enabled or disabled
  }, [checkBiometricsType, setIsBiometricsEnabled]);

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

import Icon from "components/sds/Icon";
import { BIOMETRIC_STORAGE_KEYS, LoginType } from "config/constants";
import { getLoginType, useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import useColors from "hooks/useColors";
import React, { useCallback, useEffect, useState } from "react";
import * as Keychain from "react-native-keychain";
import { biometricDataStorage } from "services/storage/storageFactory";

/**
 * useBiometrics Hook
 *
 * A custom React hook that manages biometric authentication state and operations.
 * Provides functionality to check biometric availability, enable/disable biometrics,
 * and manage biometric authentication flow.
 *
 * This hook integrates with the device's biometric capabilities (Face ID, Touch ID, fingerprint)
 * and manages the storage of biometric-protected passwords.
 *
 * @example
 * Basic usage:
 * ```tsx
 * const {
 *   isBiometricsEnabled,
 *   biometryType,
 *   enableBiometrics,
 *   disableBiometrics
 * } = useBiometrics();
 *
 * // Enable biometrics
 * await enableBiometrics();
 *

 *
 * @returns Object containing biometric state and functions
 * @returns {Keychain.BIOMETRY_TYPE | null} returns.biometryType - The type of biometric authentication available
 * @returns {Function} returns.setIsBiometricsEnabled - Function to set biometrics enabled state
 * @returns {boolean} returns.isBiometricsEnabled - Whether biometrics are currently enabled
 * @returns {Function} returns.enableBiometrics - Function to enable biometrics
 * @returns {Function} returns.disableBiometrics - Function to disable biometrics
 */
export const useBiometrics = () => {
  const [biometryType, setBiometryType] =
    useState<Keychain.BIOMETRY_TYPE | null>(null);
  const { isBiometricsEnabled, setIsBiometricsEnabled } = usePreferencesStore();
  const { verifyBiometrics, getTemporaryStore, setSignInMethod } =
    useAuthenticationStore();
  const { signInMethod } = useAuthenticationStore();
  const { themeColors } = useColors();

  /**
   * Checks and sets the supported biometry type on the device
   *
   * This function queries the device's biometric capabilities and updates the local state
   * with the available biometry type (Face ID, Touch ID, or fingerprint).
   *
   * @returns Promise resolving to the supported biometry type, or null if none available
   */
  const checkBiometrics =
    useCallback(async (): Promise<Keychain.BIOMETRY_TYPE | null> => {
      const type = await Keychain.getSupportedBiometryType();
      setBiometryType(type);

      return type;
    }, [setBiometryType]);

  /**
   * Enables biometric authentication
   *
   * This function performs the following steps:
   * 1. Checks if biometrics are supported on the device
   * 2. Verifies if a biometric password is already stored
   * 3. If no password stored, retrieves the temporary password and stores it securely
   * 4. Updates the biometrics enabled state
   * 5. Sets the appropriate sign-in method based on biometry type
   *
   * @returns Promise resolving to true if biometrics were successfully enabled, false otherwise
   * @throws {Error} When biometrics are not supported or password storage fails
   */
  const handleEnableBiometrics = useCallback(async (): Promise<boolean> => {
    const type = await checkBiometrics();
    if (!type) {
      return false;
    }

    const isBiometricPasswordStored = await biometricDataStorage.checkIfExists(
      BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
    );

    if (isBiometricPasswordStored) {
      setIsBiometricsEnabled(true);
      setSignInMethod(getLoginType(biometryType));
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
    checkBiometrics,
    getTemporaryStore,
    biometryType,
    setSignInMethod,
  ]);

  /**
   * Disables biometric authentication
   *
   * This function requires biometric verification before disabling to ensure
   * the user has permission to make this change. It only disables biometrics
   * if the verification is successful.
   *
   * @returns Promise resolving to true if biometrics were successfully disabled, false otherwise
   * @throws {Error} When biometric verification fails
   */
  const handleDisableBiometrics = useCallback(async (): Promise<boolean> => {
    const success = await verifyBiometrics();
    if (success) {
      setIsBiometricsEnabled(false);
      setSignInMethod(LoginType.PASSWORD);
    }
    return success;
  }, [verifyBiometrics, setIsBiometricsEnabled, setSignInMethod]);

  const getButtonIcon = useCallback(
    (color?: string) => {
      if (signInMethod === LoginType.PASSWORD) {
        return undefined;
      }
      if (signInMethod === LoginType.FACE) {
        return (
          <Icon.FaceId color={color ?? themeColors.foreground.secondary} />
        );
      }
      return (
        <Icon.Fingerprint01 color={color ?? themeColors.foreground.secondary} />
      );
    },
    [signInMethod, themeColors],
  );

  useEffect(() => {
    const checkBiometricsAvailable = async () => {
      const type = await checkBiometrics();
      if (!isBiometricsEnabled || !type) {
        setSignInMethod(LoginType.PASSWORD);
        return;
      }

      setSignInMethod(getLoginType(type));
    };
    checkBiometricsAvailable();
  }, [checkBiometrics, setSignInMethod, isBiometricsEnabled]);

  return {
    biometryType,
    setIsBiometricsEnabled,
    isBiometricsEnabled,
    checkBiometrics,
    enableBiometrics: handleEnableBiometrics,
    disableBiometrics: handleDisableBiometrics,
    getBiometricButtonIcon: (color?: string) => getButtonIcon(color),
  };
};

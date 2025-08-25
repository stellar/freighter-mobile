import { NativeStackScreenProps } from "@react-navigation/native-stack";
import InputPasswordTemplate from "components/templates/InputPasswordTemplate";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { AUTH_STATUS } from "config/types";
import { getActiveAccountPublicKey, useAuthenticationStore } from "ducks/auth";
import {
  FACE_ID_BIOMETRY_TYPES,
  FINGERPRINT_BIOMETRY_TYPES,
  useBiometrics,
} from "hooks/useBiometrics";
import React, { useCallback, useEffect, useState } from "react";
import { BIOMETRY_TYPE } from "react-native-keychain";

type LockScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN
>;

enum BiometricsLoginType {
  FACE_ID = "faceId",
  FINGERPRINT = "fingerprint",
  PASSWORD = "password",
}

const getBiometricsLoginType = (biometryType: BIOMETRY_TYPE | null) => {
  if (!biometryType) {
    return BiometricsLoginType.PASSWORD;
  }

  if (FACE_ID_BIOMETRY_TYPES.includes(biometryType)) {
    return BiometricsLoginType.FACE_ID;
  }
  if (FINGERPRINT_BIOMETRY_TYPES.includes(biometryType)) {
    return BiometricsLoginType.FINGERPRINT;
  }
  return BiometricsLoginType.PASSWORD;
};

export const LockScreen: React.FC<LockScreenProps> = ({ navigation }) => {
  const {
    signIn,
    isLoading: isSigningIn,
    error,
    authStatus,
    logout,
    clearError,
    signInWithBiometrics,
  } = useAuthenticationStore();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const { biometryType } = useBiometrics();
  const [signInMethod, setSignInMethod] = useState<BiometricsLoginType>(
    getBiometricsLoginType(biometryType),
  );

  useEffect(() => {
    setSignInMethod(getBiometricsLoginType(biometryType));
  }, [biometryType]);

  // Monitor auth status changes to navigate when unlocked
  useEffect(() => {
    if (authStatus === AUTH_STATUS.AUTHENTICATED) {
      // Add a small delay to ensure state is settled before navigation
      const navigationTimeout = setTimeout(() => {
        navigation.replace(ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK);
      }, 100);

      return () => {
        clearTimeout(navigationTimeout);
      };
    }
    return undefined;
  }, [authStatus, navigation]);

  useEffect(() => {
    const fetchActiveAccountPublicKey = async () => {
      const retrievedPublicKey = await getActiveAccountPublicKey();
      setPublicKey(retrievedPublicKey);
    };

    fetchActiveAccountPublicKey();
  }, []);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleUnlock = useCallback(
    (password: string) => {
      // Disable other navigation attempts while signing in
      if (isSigningIn) return;

      // Try to sign in - error handling is in the auth store
      signIn({ password });
      // Navigation will happen automatically through the authStatus effect
    },
    [signIn, isSigningIn],
  );

  const handleUnlockWithBiometrics = useCallback(async () => {
    await signInWithBiometrics();
  }, [signInWithBiometrics]);

  return (
    <InputPasswordTemplate
      publicKey={publicKey}
      error={error}
      isLoading={isSigningIn}
      handleContinue={
        signInMethod === BiometricsLoginType.PASSWORD
          ? handleUnlock
          : handleUnlockWithBiometrics
      }
      handleLogout={() => logout(true)}
      signInMethod={signInMethod}
      setSignInMethod={setSignInMethod}
    />
  );
};

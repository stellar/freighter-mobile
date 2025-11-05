import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBiometrics } from "hooks/useBiometrics";
import { useEffect } from "react";

export const useAppOpenBiometricsLogin = (initializing: boolean) => {
  const {
    authStatus,
    verifyActionWithBiometrics,
    signIn,
    hasTriggeredAppOpenBiometricsLogin,
    setHasTriggeredAppOpenBiometricsLogin,
  } = useAuthenticationStore();
  const { isBiometricsEnabled } = useBiometrics();

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (authStatus === AUTH_STATUS.AUTHENTICATED || !isBiometricsEnabled) {
      setHasTriggeredAppOpenBiometricsLogin(true);
      return;
    }

    if (
      authStatus === AUTH_STATUS.HASH_KEY_EXPIRED &&
      !hasTriggeredAppOpenBiometricsLogin
    ) {
      setHasTriggeredAppOpenBiometricsLogin(true);

      verifyActionWithBiometrics(async (biometricPassword?: string) => {
        if (biometricPassword) {
          await signIn({ password: biometricPassword });
        }
      });
    }
  }, [
    authStatus,
    isBiometricsEnabled,
    initializing,
    hasTriggeredAppOpenBiometricsLogin,
    setHasTriggeredAppOpenBiometricsLogin,
    verifyActionWithBiometrics,
    signIn,
  ]);
};

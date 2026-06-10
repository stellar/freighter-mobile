import { ERROR_TOAST_DURATION } from "config/constants";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { AUTH_ERROR_TOAST_ID } from "hooks/useAuthErrorToast";
import { useBiometrics } from "hooks/useBiometrics";
import { useToast } from "providers/ToastProvider";
import { useEffect } from "react";

export const useAppOpenBiometricsLogin = (initializing: boolean) => {
  const {
    authStatus,
    verifyActionWithBiometrics,
    signIn,
    clearError,
    hasTriggeredAppOpenBiometricsLogin,
    setHasTriggeredAppOpenBiometricsLogin,
  } = useAuthenticationStore();
  const { isBiometricsEnabled } = useBiometrics();
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (authStatus === AUTH_STATUS.AUTHENTICATED || !isBiometricsEnabled) {
      setHasTriggeredAppOpenBiometricsLogin(true);
      return;
    }

    if (
      (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
        authStatus === AUTH_STATUS.LOCKED) &&
      !hasTriggeredAppOpenBiometricsLogin
    ) {
      setHasTriggeredAppOpenBiometricsLogin(true);

      verifyActionWithBiometrics(async (biometricPassword?: string) => {
        if (biometricPassword) {
          await signIn({ password: biometricPassword });
        }
      }).catch(() => {
        // Clear any store error set by the underlying signIn so the global
        // AuthErrorToastListener doesn't race this toast on the shared id (and
        // a biometric-derived invalidPassword doesn't bleed into LockScreen's
        // inline field). This biometric toast is the single authoritative one.
        clearError();
        showToast({
          toastId: AUTH_ERROR_TOAST_ID,
          variant: "error",
          title: t("lockScreen.errorUnlockingWalletTitle"),
          message: t("lockScreen.errorUnlockingWalletMessage"),
          duration: ERROR_TOAST_DURATION,
        });
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
    clearError,
    showToast,
    t,
  ]);
};

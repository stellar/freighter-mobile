import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import { useToast } from "providers/ToastProvider";
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
        showToast({
          toastId: "unlock-wallet-error",
          variant: "error",
          title: t("lockScreen.errorUnlockingWalletTitle"),
          message: t("lockScreen.errorUnlockingWalletMessage"),
          duration: 6000,
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
    showToast,
    t,
  ]);
};

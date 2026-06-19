import { ERROR_TOAST_DURATION } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { AUTH_ERROR_TOAST_ID } from "hooks/useAuthErrorToast";
import { useToast } from "providers/ToastProvider";
import { useCallback } from "react";

/**
 * Returns a callback that surfaces a wallet-setup failure to the user.
 *
 * Onboarding/import defer the actual `signUp` / `importWallet` to a later step
 * (Enable Face ID, or the recovery-phrase / skip flows), and those actions
 * return `false` (rather than throwing) on failure. Each caller invokes this on
 * `!success` so the user sees a clear, context-appropriate message instead of
 * the generic store error (which is suppressed by `useAuthErrorToast`).
 */
export const useSetupFailedToast = (): (() => void) => {
  const { clearError } = useAuthenticationStore();
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  return useCallback(() => {
    clearError();
    showToast({
      toastId: AUTH_ERROR_TOAST_ID,
      variant: "error",
      title: t("authStore.error.setupFailedTitle"),
      message: t("authStore.error.setupFailedMessage"),
      duration: ERROR_TOAST_DURATION,
    });
  }, [clearError, showToast, t]);
};

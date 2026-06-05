import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useEffect } from "react";

/** Shared id so auth-error toasts replace (rather than stack on) each other. */
export const AUTH_ERROR_TOAST_ID = "auth-error";

/**
 * Surfaces auth-store failures to the user via a toast so they are never
 * silent. Reacts to the store's `error` / `accountError` (already user-safe
 * i18n strings), then clears them.
 *
 * Field-validation messages that their own input screens render inline
 * (invalid password / invalid recovery phrase) are skipped here to avoid
 * duplicating the inline message.
 *
 * Mounted once, app-wide, via `AuthErrorToastListener`.
 */
export const useAuthErrorToast = (): void => {
  const { error, accountError, authStatus, clearError, clearAccountError } =
    useAuthenticationStore();
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  useEffect(() => {
    if (!error) {
      return;
    }
    // Messages owned by their originating screen — that screen shows them
    // inline or via its own context-specific toast, so don't surface them
    // again generically (e.g. "Failed to sign up" on the Enable Face ID screen).
    const handledByScreen = [
      t("authStore.error.invalidPassword"), // inline on lock / verify-password
      t("authStore.error.invalidMnemonicPhrase"), // inline on import-wallet
      t("authStore.error.failedToSignUp"), // BiometricsEnableScreen toast
      t("authStore.error.failedToImportWallet"), // import-wallet inline / biometrics toast
    ];
    if (handledByScreen.includes(error)) {
      return;
    }

    const isLoadAccount = error === t("authStore.error.failedToLoadAccount");
    showToast({
      toastId: AUTH_ERROR_TOAST_ID,
      variant: "error",
      title: isLoadAccount
        ? t("lockScreen.failedToLoadAccountTitle")
        : t("authStore.error.notificationTitle"),
      message: isLoadAccount
        ? t("lockScreen.failedToLoadAccountMessage")
        : error,
      duration: 6000,
    });
    clearError();
  }, [error, t, showToast, clearError]);

  useEffect(() => {
    if (!accountError) {
      return;
    }
    // Only meaningful when the user has a wallet and is (or should be) signed
    // in — i.e. authenticated, hash-key expired, or locked. During onboarding
    // (NOT_AUTHENTICATED, no account yet) a failed account load is expected and
    // must not surface "Account not loaded". Clear it silently in that case.
    if (authStatus !== AUTH_STATUS.NOT_AUTHENTICATED) {
      showToast({
        toastId: AUTH_ERROR_TOAST_ID,
        variant: "error",
        title: t("lockScreen.failedToLoadAccountTitle"),
        message: accountError,
        duration: 6000,
      });
    }
    clearAccountError();
  }, [accountError, authStatus, t, showToast, clearAccountError]);
};

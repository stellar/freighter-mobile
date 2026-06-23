import { ERROR_TOAST_DURATION } from "config/constants";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useEffect } from "react";

/** Shared id so auth-error toasts replace (rather than stack on) each other. */
export const AUTH_ERROR_TOAST_ID = "auth-error";

type TranslateFn = ReturnType<typeof useAppTranslation>["t"];

/**
 * Maps a user-facing auth error message to its toast title/message. Shared by
 * the `error` and `accountError` channels so a given failure (e.g. session
 * expired, account load failure) renders the same copy regardless of which
 * store field carried it. Unknown messages fall back to a generic title with
 * the (already user-safe) message as the body.
 */
const getAuthErrorToastContent = (
  errorMessage: string,
  t: TranslateFn,
): { title: string; message: string } => {
  const errorToast: Record<string, { title: string; message: string }> = {
    [t("authStore.error.failedToSignIn")]: {
      title: t("authStore.error.signInFailedTitle"),
      message: t("authStore.error.signInFailedMessage"),
    },
    [t("authStore.error.failedToLogout")]: {
      title: t("authStore.error.logoutFailedTitle"),
      message: t("authStore.error.logoutFailedMessage"),
    },
    [t("authStore.error.failedToCreateAccount")]: {
      title: t("authStore.error.createAccountFailedTitle"),
      message: t("authStore.error.createAccountFailedMessage"),
    },
    [t("authStore.error.failedToSelectAccount")]: {
      title: t("authStore.error.selectAccountFailedTitle"),
      message: t("authStore.error.selectAccountFailedMessage"),
    },
    [t("authStore.error.failedToRenameAccount")]: {
      title: t("authStore.error.renameAccountFailedTitle"),
      message: t("authStore.error.renameAccountFailedMessage"),
    },
    [t("authStore.error.failedToImportSecretKey")]: {
      title: t("authStore.error.importSecretKeyFailedTitle"),
      message: t("authStore.error.importSecretKeyFailedMessage"),
    },
    [t("authStore.error.failedToLoadAccount")]: {
      title: t("lockScreen.failedToLoadAccountTitle"),
      message: t("lockScreen.failedToLoadAccountMessage"),
    },
    [t("authStore.error.authenticationExpired")]: {
      title: t("authStore.error.sessionExpiredTitle"),
      message: t("authStore.error.sessionExpiredMessage"),
    },
  };

  return (
    errorToast[errorMessage] ?? {
      title: t("authStore.error.notificationTitle"),
      message: errorMessage,
    }
  );
};

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
    // Left in the store (not cleared) so the owning screen can render them.
    const handledByScreen = [
      t("authStore.error.invalidPassword"), // inline on lock / verify-password
      t("authStore.error.invalidMnemonicPhrase"), // inline on import-wallet
      t("authStore.error.failedToSignUp"), // BiometricsEnableScreen toast
      t("authStore.error.failedToImportWallet"), // import-wallet inline / biometrics toast
    ];
    if (handledByScreen.includes(error)) {
      return;
    }

    // Background failures that are expected / already logged — clear without
    // interrupting the user (e.g. a background account-list refresh on every
    // Home mount; surfaced contextually in ManageAccounts instead).
    const silentlyCleared = [t("authStore.error.failedToGetAllAccounts")];
    if (silentlyCleared.includes(error)) {
      clearError();
      return;
    }

    showToast({
      toastId: AUTH_ERROR_TOAST_ID,
      variant: "error",
      ...getAuthErrorToastContent(error, t),
      duration: ERROR_TOAST_DURATION,
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
      // Same mapping as the `error` channel so e.g. an expired session loaded
      // via accountError still shows the session-expired copy (not the raw msg).
      showToast({
        toastId: AUTH_ERROR_TOAST_ID,
        variant: "error",
        ...getAuthErrorToastContent(accountError, t),
        duration: ERROR_TOAST_DURATION,
      });
    }
    clearAccountError();
  }, [accountError, authStatus, t, showToast, clearAccountError]);
};

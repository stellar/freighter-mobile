import { NativeStackScreenProps } from "@react-navigation/native-stack";
import InputPasswordTemplate from "components/templates/InputPasswordTemplate";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore, getActiveAccountPublicKey } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useEffect, useRef, useState } from "react";

type LockScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN
>;

type TFunction = ReturnType<typeof useAppTranslation>["t"];

function getErrorToastContent(
  error: string,
  t: TFunction,
): { title: string; message: string } {
  switch (error) {
    case t("authStore.error.failedToLoadAccount"):
      return {
        title: t("lockScreen.failedToLoadAccountTitle"),
        message: t("lockScreen.failedToLoadAccountMessage"),
      };
    default:
      return {
        title: t("lockScreen.errorUnlockingWalletTitle"),
        message: t("lockScreen.errorUnlockingWalletMessage"),
      };
  }
}

export const LockScreen: React.FC<LockScreenProps> = ({ navigation }) => {
  const {
    signIn,
    isLoading: isSigningIn,
    error,
    authStatus,
    logout,
    clearError,
  } = useAuthenticationStore();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  // Capture whether an error was set before this screen mounted (e.g. a failed
  // account load after sign-in). The clearError-on-mount effect must not wipe
  // it before the toast effect has a chance to display it.
  const hasInitialError = useRef(Boolean(error));

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

  // Clear any stale error on mount, but skip if there was already an error
  // present when this screen was first rendered (e.g. a failed account load
  // after sign-in) — the toast effect below needs to display it first.
  useEffect(() => {
    if (!hasInitialError.current) {
      clearError();
    }
  }, [clearError]);

  useEffect(() => {
    if (error && error !== t("authStore.error.invalidPassword")) {
      const { title, message } = getErrorToastContent(error, t);
      showToast({
        toastId: "unlock-wallet-error",
        variant: "error",
        title,
        message,
        duration: 6000,
      });
      clearError();
    }
  }, [error, t, showToast, clearError]);

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

  return (
    <InputPasswordTemplate
      publicKey={publicKey}
      error={error}
      isLoading={isSigningIn}
      handleContinue={handleUnlock}
      handleLogout={() => logout(true)}
    />
  );
};

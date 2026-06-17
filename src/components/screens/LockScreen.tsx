import { NativeStackScreenProps } from "@react-navigation/native-stack";
import ForgotPasswordWarningModal from "components/screens/ForgotPasswordWarningModal";
import InputPasswordTemplate from "components/templates/InputPasswordTemplate";
import { LoginType, UNLOCK_ERROR_TOAST_ID } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore, getActiveAccountPublicKey } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

type LockScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN
>;

type TFunction = ReturnType<typeof useAppTranslation>["t"];

// Small delay to ensure state is settled before navigating after unlock
const UNLOCK_NAVIGATION_DELAY_MS = 100;

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

interface LockScreenContentProps {
  /**
   * Called once the wallet is unlocked. The lock screen route uses this to
   * replace itself with the main tab stack; the soft-lock overlay omits it
   * because it simply unmounts when the unlock flips the auth status.
   */
  onUnlocked?: () => void;
}

/**
 * Lock UI shared by the LockScreen route (hard lock / cold start) and the
 * soft-lock overlay (in-process auto-lock with the navigation tree preserved
 * underneath). Handles password unlock, the biometric auto-prompt, and the
 * forgot-password flow.
 */
export const LockScreenContent: React.FC<LockScreenContentProps> = ({
  onUnlocked,
}) => {
  const {
    signIn,
    isLoading: isSigningIn,
    error,
    authStatus,
    logout,
    clearError,
    signInMethod,
    verifyActionWithBiometrics,
  } = useAuthenticationStore();
  const { isBiometricsEnabled } = usePreferencesStore();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isForgotPasswordModalVisible, setIsForgotPasswordModalVisible] =
    useState(false);
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  // Capture whether an error was set before this screen mounted (e.g. a failed
  // account load after sign-in). The clearError-on-mount effect must not wipe
  // it before the toast effect has a chance to display it.
  const hasInitialError = useRef(Boolean(error));

  // Auto-prompt biometrics at most once per arrival on this screen; reset when
  // the app returns from the background so the user is prompted again.
  const hasAutoPromptedRef = useRef(false);
  // Whether the app went to the real background while this screen was mounted
  // (or was mounted while backgrounded, e.g. an "Immediately" auto-lock).
  // "inactive" is intentionally ignored: on iOS the biometric overlay itself
  // triggers inactive→active transitions, which would re-prompt on cancel.
  const wasBackgroundedRef = useRef(AppState.currentState !== "active");

  // Monitor auth status changes to navigate when unlocked
  useEffect(() => {
    if (authStatus === AUTH_STATUS.AUTHENTICATED && onUnlocked) {
      // Add a small delay to ensure state is settled before navigation
      const navigationTimeout = setTimeout(() => {
        onUnlocked();
      }, UNLOCK_NAVIGATION_DELAY_MS);

      return () => {
        clearTimeout(navigationTimeout);
      };
    }
    return undefined;
  }, [authStatus, onUnlocked]);

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
        toastId: UNLOCK_ERROR_TOAST_ID,
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

  /**
   * Prompts for biometrics and unlocks the wallet with the stored password,
   * so users with biometrics enabled don't need to tap the unlock button.
   */
  const attemptBiometricUnlock = useCallback(() => {
    if (isSigningIn || isForgotPasswordModalVisible) return;
    // The guards below must run before the auto-prompt flag is set: the
    // sign-in method resolves asynchronously after mount (PASSWORD until
    // biometrics availability is checked), and we still want to prompt then.
    if (!isBiometricsEnabled || signInMethod === LoginType.PASSWORD) return;
    if (hasAutoPromptedRef.current) return;

    hasAutoPromptedRef.current = true;
    verifyActionWithBiometrics((password?: string) => {
      if (password) {
        handleUnlock(password);
      }
      return Promise.resolve();
    }).catch(() => {
      // The user dismissed the biometric prompt — they can still unlock
      // manually; we prompt again on the next return from the background.
    });
  }, [
    isSigningIn,
    isForgotPasswordModalVisible,
    isBiometricsEnabled,
    signInMethod,
    verifyActionWithBiometrics,
    handleUnlock,
  ]);

  // Auto-prompt biometrics when landing on this screen with the app active
  // (cold start or a lock that happened while backgrounded). Skipped for a
  // foreground-idle lock: the user stayed in the app and idled out, so popping
  // an unprompted Face ID would be jarring — they can tap to unlock, and the
  // return-from-background effect below re-prompts on the next foreground.
  useEffect(() => {
    if (
      AppState.currentState === "active" &&
      !useAuthenticationStore.getState().isForegroundIdleLock
    ) {
      attemptBiometricUnlock();
    }
  }, [attemptBiometricUnlock]);

  // Re-prompt biometrics when the app returns from the background while this
  // screen is showing — like banking apps do
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background") {
        wasBackgroundedRef.current = true;
        return;
      }

      if (nextAppState === "active" && wasBackgroundedRef.current) {
        // Re-prompting on EVERY return from the background is intentional
        // (banking-app behavior): the user landing on a locked wallet wants
        // to get in, and a cancelled prompt stays cancelled until they leave.
        wasBackgroundedRef.current = false;
        hasAutoPromptedRef.current = false;
        attemptBiometricUnlock();
      }
    });

    return () => subscription.remove();
  }, [attemptBiometricUnlock]);

  const handleForgotPassword = useCallback(() => {
    setIsForgotPasswordModalVisible(true);
  }, []);

  const cancelForgotPassword = useCallback(() => {
    setIsForgotPasswordModalVisible(false);
  }, []);

  const confirmForgotPassword = useCallback(() => {
    setIsForgotPasswordModalVisible(false);
    logout(true);
  }, [logout]);

  return (
    <>
      <InputPasswordTemplate
        publicKey={publicKey}
        error={error}
        isLoading={isSigningIn}
        handleContinue={handleUnlock}
        handleLogout={handleForgotPassword}
        testID="lock-screen"
        continueButtonTestID="unlock-button"
        forgotPasswordButtonTestID="forgot-password-button"
      />
      <ForgotPasswordWarningModal
        visible={isForgotPasswordModalVisible}
        onCancel={cancelForgotPassword}
        onConfirm={confirmForgotPassword}
      />
    </>
  );
};

export const LockScreen: React.FC<LockScreenProps> = ({ navigation }) => {
  const handleUnlocked = useCallback(() => {
    navigation.replace(ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK);
  }, [navigation]);

  return <LockScreenContent onUnlocked={handleUnlocked} />;
};

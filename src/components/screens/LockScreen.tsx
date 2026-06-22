import { NativeStackScreenProps } from "@react-navigation/native-stack";
import ForgotPasswordWarningModal from "components/screens/ForgotPasswordWarningModal";
import InputPasswordTemplate from "components/templates/InputPasswordTemplate";
import { ERROR_TOAST_DURATION, LoginType } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore, getActiveAccountPublicKey } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import {
  isPrivacyShieldVisible,
  onPrivacyShieldHidden,
} from "helpers/privacyShield";
import useAppTranslation from "hooks/useAppTranslation";
import { AUTH_ERROR_TOAST_ID } from "hooks/useAuthErrorToast";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

type LockScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN
>;

// Small delay to ensure state is settled before navigating after unlock
const UNLOCK_NAVIGATION_DELAY_MS = 100;

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
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isForgotPasswordModalVisible, setIsForgotPasswordModalVisible] =
    useState(false);

  // Only the invalid-password message belongs inline under the password field.
  // Every other store error is surfaced app-wide by AuthErrorToastListener, so
  // passing it inline too would double-display it.
  const inlineError =
    error === t("authStore.error.invalidPassword") ? error : null;

  // Capture whether an error was already present when this screen mounted so
  // the clear-on-mount effect doesn't wipe it before it can be surfaced (inline
  // for invalid-password, or app-wide by AuthErrorToastListener).
  const hasInitialError = useRef(Boolean(error));

  // Auto-prompt biometrics at most once per arrival on this screen; reset when
  // the app returns from the background so the user is prompted again.
  const hasAutoPromptedRef = useRef(false);
  // Whether the app went to the real background while this screen was mounted
  // (or was mounted while backgrounded, e.g. an "Immediately" auto-lock).
  // "inactive" is intentionally ignored: on iOS the biometric overlay itself
  // triggers inactive→active transitions, which would re-prompt on cancel.
  const wasBackgroundedRef = useRef(AppState.currentState !== "active");
  // True when a prompt was requested while the privacy shield was still up; it
  // fires once the shield drops so the lock screen is visible behind Face ID.
  const pendingPromptRef = useRef(false);

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
  // after sign-in) so AuthErrorToastListener can surface it first.
  useEffect(() => {
    if (!hasInitialError.current) {
      clearError();
    }
  }, [clearError]);

  const handleUnlock = useCallback(
    (password: string): Promise<void> | undefined => {
      // Disable other navigation attempts while signing in
      if (isSigningIn) return undefined;

      // Try to sign in - error handling is in the auth store. The promise is
      // returned so the biometric auto-unlock can await/catch a rejection
      // (e.g. a stale stored password) instead of leaving it unhandled.
      // Navigation happens automatically through the authStatus effect.
      return signIn({ password });
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
    let didAttemptUnlock = false;
    verifyActionWithBiometrics((password?: string) => {
      if (password) {
        didAttemptUnlock = true;
        // Return the sign-in promise so a rejection is handled by the
        // .catch() below rather than surfacing as an unhandled rejection.
        return handleUnlock(password) ?? Promise.resolve();
      }
      return Promise.resolve();
    }).catch(() => {
      if (!didAttemptUnlock) {
        // Biometric prompt cancelled/failed before any unlock attempt — the
        // user can still unlock manually; we re-prompt on the next foreground.
        return;
      }
      // Unlock failed after a successful biometric scan (e.g. a stale stored
      // password). Clear the store error so a biometric-derived invalidPassword
      // doesn't bleed into the inline password field, and surface the single
      // authoritative unlock-error toast (matches PR #890's biometric flow).
      clearError();
      showToast({
        toastId: AUTH_ERROR_TOAST_ID,
        variant: "error",
        title: t("lockScreen.errorUnlockingWalletTitle"),
        message: t("lockScreen.errorUnlockingWalletMessage"),
        duration: ERROR_TOAST_DURATION,
      });
    });
  }, [
    isSigningIn,
    isForgotPasswordModalVisible,
    isBiometricsEnabled,
    signInMethod,
    verifyActionWithBiometrics,
    handleUnlock,
    clearError,
    showToast,
    t,
  ]);

  /**
   * Requests the biometric prompt, but holds it while the native privacy
   * shield is still covering the app (return from background) so Face ID
   * appears over the visible lock screen rather than the shield. When the
   * shield is down it prompts immediately.
   */
  const requestBiometricPrompt = useCallback(() => {
    if (isPrivacyShieldVisible()) {
      pendingPromptRef.current = true;
      return;
    }
    attemptBiometricUnlock();
  }, [attemptBiometricUnlock]);

  // Fire a held prompt once the privacy shield drops.
  useEffect(() => {
    const unsubscribe = onPrivacyShieldHidden(() => {
      if (pendingPromptRef.current) {
        pendingPromptRef.current = false;
        attemptBiometricUnlock();
      }
    });

    return unsubscribe;
  }, [attemptBiometricUnlock]);

  // Auto-prompt biometrics when landing on this screen with the app active
  // (cold start or a lock that happened while backgrounded). Skipped when the
  // user was actively present — a foreground-idle timeout or a manual
  // lock/logout — since popping an unprompted Face ID is jarring there; they
  // can tap to unlock, and the return-from-background effect below re-prompts
  // on the next foreground.
  useEffect(() => {
    if (
      AppState.currentState === "active" &&
      !useAuthenticationStore.getState().suppressBiometricAutoPrompt
    ) {
      requestBiometricPrompt();
    }
  }, [requestBiometricPrompt]);

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
        // Held until the privacy shield drops so the lock screen is visible.
        wasBackgroundedRef.current = false;
        hasAutoPromptedRef.current = false;
        requestBiometricPrompt();
      }
    });

    return () => subscription.remove();
  }, [requestBiometricPrompt]);

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
        error={inlineError}
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

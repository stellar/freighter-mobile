import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import ForgotPasswordBottomSheet from "components/screens/ForgotPasswordBottomSheet";
import LockScreenTemplate from "components/templates/LockScreenTemplate";
import {
  ERROR_TOAST_DURATION,
  LoginType,
  UNLOCK_ERROR_TOAST_ID,
} from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import { waitForKeyboardDismiss } from "helpers/keyboard";
import {
  isPrivacyShieldVisible,
  onPrivacyShieldHidden,
} from "helpers/privacyShield";
import useAppTranslation from "hooks/useAppTranslation";
import useBackHandler from "hooks/useBackHandler";
import { useBiometrics } from "hooks/useBiometrics";
import { useToast } from "providers/ToastProvider";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  /**
   * Whether to focus the password field on mount. Defaults to true, and is
   * ignored when biometrics are enabled: they unlock first, so a keyboard
   * would only rise under the prompt.
   */
  autoFocus?: boolean;
}

/**
 * Lock UI shared by the LockScreen route (hard lock / cold start) and the
 * soft-lock overlay (in-process auto-lock with the navigation tree preserved
 * underneath). Handles password unlock, the biometric prompt (automatic, and
 * again from the button beside the password field), and the forgot-password
 * flow.
 */
export const LockScreenContent: React.FC<LockScreenContentProps> = ({
  onUnlocked,
  autoFocus,
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
  // Settles the sign-in method from the device's biometry on mount, as the
  // biometric unlock button did before it. Without it, "Use password instead"
  // chosen on another screen would leave this one without biometrics.
  useBiometrics();
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const forgotPasswordSheetRef = useRef<BottomSheetModal>(null);
  const [isForgotPasswordSheetOpen, setIsForgotPasswordSheetOpen] =
    useState(false);

  // signInMethod stays PASSWORD until the device's biometry has been checked
  const biometricLoginType =
    isBiometricsEnabled && signInMethod !== LoginType.PASSWORD
      ? signInMethod
      : null;

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
   * Prompts for biometrics and unlocks the wallet with the stored password.
   * The biometrics button calls this directly, so it prompts however many
   * times the user has already been asked.
   */
  const promptBiometricUnlock = useCallback(() => {
    if (isSigningIn || isForgotPasswordSheetOpen) return;
    // The guards above must run before the auto-prompt flag is set: the
    // sign-in method resolves asynchronously after mount (PASSWORD until
    // biometrics availability is checked), and we still want to prompt then.
    if (!biometricLoginType) return;

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
      // doesn't bleed into the inline password field, and surface the unlock-
      // error toast. Uses UNLOCK_ERROR_TOAST_ID because it's the only id
      // SOFT_LOCK_ALLOWED_TOAST_IDS lets through while the soft-lock overlay is
      // up — otherwise the failure would be silently suppressed.
      clearError();
      showToast({
        toastId: UNLOCK_ERROR_TOAST_ID,
        variant: "error",
        title: t("lockScreen.errorUnlockingWalletTitle"),
        message: t("lockScreen.errorUnlockingWalletMessage"),
        duration: ERROR_TOAST_DURATION,
      });
    });
  }, [
    isSigningIn,
    isForgotPasswordSheetOpen,
    biometricLoginType,
    verifyActionWithBiometrics,
    handleUnlock,
    clearError,
    showToast,
    t,
  ]);

  /**
   * The automatic prompt, so users with biometrics enabled don't need to tap
   * anything. It asks at most once per arrival on this screen.
   */
  const attemptBiometricUnlock = useCallback(() => {
    if (hasAutoPromptedRef.current) return;

    promptBiometricUnlock();
  }, [promptBiometricUnlock]);

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
    setIsForgotPasswordSheetOpen(true);
    // Wait for the keyboard's hide animation before presenting the sheet so
    // it opens at its final height instead of jumping down.
    waitForKeyboardDismiss().then(() => {
      forgotPasswordSheetRef.current?.present();
    });
  }, []);

  const closeForgotPassword = useCallback(() => {
    forgotPasswordSheetRef.current?.dismiss();
  }, []);

  const confirmForgotPassword = useCallback(() => {
    forgotPasswordSheetRef.current?.dismiss();
    logout(true);
  }, [logout]);

  // Follows the sheet however it closes (its button, a swipe or the backdrop),
  // so no biometric prompt pops up over the reset warning while it is open.
  // onDismiss covers a close that cuts the opening animation short (e.g. a
  // double-tap landing on the backdrop): gorhom never reports that one through
  // onChange, and biometrics would stay blocked.
  const forgotPasswordSheetModalProps = useMemo(
    () => ({
      onChange: (index: number) => setIsForgotPasswordSheetOpen(index >= 0),
      onDismiss: () => setIsForgotPasswordSheetOpen(false),
    }),
    [],
  );

  // The bottom sheet doesn't close on Android's Back the way the modal it
  // replaced did. Left to the navigator, Back from the lock screen route would
  // send the app to the background with the warning still open. Registered
  // after the soft-lock overlay's own Back handler, so it runs first there.
  useBackHandler(() => {
    forgotPasswordSheetRef.current?.dismiss();

    return true;
  }, isForgotPasswordSheetOpen);

  return (
    <>
      <LockScreenTemplate
        error={inlineError}
        isUnlocking={isSigningIn}
        autoFocus={isBiometricsEnabled ? false : (autoFocus ?? true)}
        biometricLoginType={biometricLoginType}
        onUnlock={handleUnlock}
        onBiometricUnlock={promptBiometricUnlock}
        onForgotPassword={handleForgotPassword}
      />
      <BottomSheet
        modalRef={forgotPasswordSheetRef}
        bottomSheetModalProps={forgotPasswordSheetModalProps}
        customContent={
          <ForgotPasswordBottomSheet
            onClose={closeForgotPassword}
            onConfirm={confirmForgotPassword}
          />
        }
      />
    </>
  );
};

export const LockScreen: React.FC<LockScreenProps> = ({
  navigation,
  route,
}) => {
  const handleUnlocked = useCallback(() => {
    navigation.replace(ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK);
  }, [navigation]);

  // Every navigation to this screen asks for the field to be focused. The one
  // arrival that doesn't is the app launching into it, as the navigator's
  // initial route: it mounts under the launch splash, where focusing the field
  // would bring the keyboard up on the thread drawing the animation.
  return (
    <LockScreenContent
      onUnlocked={handleUnlocked}
      autoFocus={route.params?.autoFocus ?? false}
    />
  );
};

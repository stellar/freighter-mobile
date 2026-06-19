import { NativeStackScreenProps } from "@react-navigation/native-stack";
import ForgotPasswordWarningModal from "components/screens/ForgotPasswordWarningModal";
import InputPasswordTemplate from "components/templates/InputPasswordTemplate";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore, getActiveAccountPublicKey } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback, useEffect, useRef, useState } from "react";

type LockScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN
>;

export const LockScreen: React.FC<LockScreenProps> = ({ navigation }) => {
  const {
    signIn,
    isLoading: isSigningIn,
    error,
    authStatus,
    logout,
    clearError,
  } = useAuthenticationStore();
  const { t } = useAppTranslation();
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
  // after sign-in) so AuthErrorToastListener can surface it first.
  useEffect(() => {
    if (!hasInitialError.current) {
      clearError();
    }
  }, [clearError]);

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

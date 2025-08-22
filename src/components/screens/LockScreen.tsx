import { NativeStackScreenProps } from "@react-navigation/native-stack";
import InputPasswordTemplate from "components/templates/InputPasswordTemplate";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { AUTH_STATUS } from "config/types";
import { getActiveAccountPublicKey, useAuthenticationStore } from "ducks/auth";
import { useFaceId } from "hooks/useFaceId";
import React, { useCallback, useEffect, useState } from "react";

type LockScreenProps = NativeStackScreenProps<
  RootStackParamList,
  | typeof ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN
  | typeof ROOT_NAVIGATOR_ROUTES.FACE_ID_ONBOARDING_SCREEN
>;

export const LockScreen: React.FC<LockScreenProps> = ({ navigation }) => {
  const {
    signIn,
    isLoading: isSigningIn,
    error,
    authStatus,
    logout,
    clearError,
    signInWithFaceId,
  } = useAuthenticationStore();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const { isFaceIdActive } = useFaceId();
  const [signInMethod, setSignInMethod] = useState<"password" | "faceId">(
    isFaceIdActive ? "faceId" : "password",
  );

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

  useEffect(() => {
    clearError();
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

  const handleUnlockWithFaceId = useCallback(async () => {
    await signInWithFaceId();
  }, [signInWithFaceId]);

  return (
    <InputPasswordTemplate
      publicKey={publicKey}
      error={error}
      isLoading={isSigningIn}
      handleContinue={
        signInMethod === "password" ? handleUnlock : handleUnlockWithFaceId
      }
      handleLogout={() => logout(true)}
      signInMethod={signInMethod}
      setSignInMethod={setSignInMethod}
    />
  );
};

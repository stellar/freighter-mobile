import { useAuthenticationStore } from "ducks/auth";
import useAuthCheck from "hooks/useAuthCheck";
import React, { ReactNode, useEffect } from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";

interface AuthCheckProviderProps {
  children: ReactNode;
}

/**
 * Provider component that monitors authentication status and user interaction
 * to ensure the app redirects to lock screen when hash key expires
 */
export const AuthCheckProvider: React.FC<AuthCheckProviderProps> = ({
  children,
}) => {
  const { panHandlers } = useAuthCheck();
  const { account } = useAuthenticationStore();

  useEffect(() => {
    // Checking for public key to make sure the account is loaded
    if (account?.publicKey) {
      analytics.identifyUser();
    }
  }, [account?.publicKey]);

  // The View with panHandlers will detect user interaction across the entire app
  return (
    <View style={{ flex: 1 }} {...panHandlers}>
      {children}
    </View>
  );
};

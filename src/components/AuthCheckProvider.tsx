import useAuthCheck from "hooks/useAuthCheck";
import React, { ReactNode } from "react";
import { View } from "react-native";

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

  // The View with panHandlers will detect user interaction across the entire app
  return (
    <View style={{ flex: 1 }} {...panHandlers}>
      {children}
    </View>
  );
};

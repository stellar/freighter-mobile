import { navigationRef } from "components/App";
import { useAuthenticationStore } from "ducks/auth";
import { useCallback, useEffect } from "react";

/**
 * Hook that provides access to the active account with loading state
 * Uses the auth store to manage the active account state
 */
const useGetActiveAccount = () => {
  const {
    account,
    isLoadingAccount: isLoading,
    accountError: error,
    fetchActiveAccount,
    refreshActiveAccount,
    setNavigationRef,
  } = useAuthenticationStore();

  // Set navigation ref when app loads
  useEffect(() => {
    if (navigationRef.isReady()) {
      setNavigationRef(navigationRef);
    }
  }, [setNavigationRef]);

  // Fetch account on component mount
  useEffect(() => {
    fetchActiveAccount();
  }, [fetchActiveAccount]);

  // Exposed for manual refresh when needed
  const refreshAccount = useCallback(
    () => refreshActiveAccount(),
    [refreshActiveAccount],
  );

  return {
    account,
    isLoading,
    error,
    refreshAccount,
  };
};

export default useGetActiveAccount;

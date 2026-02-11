import { FeeBumpTransaction, Keypair, Transaction } from "@stellar/stellar-sdk";
import { navigationRef } from "components/App";
import { useAuthenticationStore } from "ducks/auth";
import { signMessage as signMessageHelper } from "helpers/stellar";
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

  const signTransaction = useCallback(
    (transaction: Transaction | FeeBumpTransaction): string | null => {
      if (!account) return null;

      const keyPair = Keypair.fromSecret(account.privateKey);

      transaction.sign(keyPair);

      return transaction.toXDR();
    },
    [account],
  );

  const signMessage = useCallback(
    (message: string): string | null => {
      if (!account) return null;

      try {
        return signMessageHelper(message, account.privateKey);
      } catch (error) {
        return null;
      }
    },
    [account],
  );

  return {
    account,
    isLoading,
    error,
    refreshAccount,
    signTransaction,
    signMessage,
  };
};

export default useGetActiveAccount;

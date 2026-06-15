import { FeeBumpTransaction, Keypair, Transaction } from "@stellar/stellar-sdk";
import { navigationRef } from "components/App";
import { logger } from "config/logger";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import {
  signMessage as signMessageHelper,
  signAuthEntry as signAuthEntryHelper,
} from "helpers/stellar";
import { useCallback, useEffect } from "react";
import { analytics } from "services/analytics";

/**
 * Defense-in-depth: signing must only ever happen while the wallet is fully
 * unlocked. The soft-lock overlay blocks the UI, but the navigation tree
 * (and these signing callbacks) stay mounted underneath, so guard the key
 * material directly — never rely on the overlay alone. Read live from the
 * store so a lock that engaged after the callback was created is respected.
 */
const isWalletUnlocked = (): boolean => {
  const { authStatus, isSoftLocked } = useAuthenticationStore.getState();
  return authStatus === AUTH_STATUS.AUTHENTICATED && !isSoftLocked;
};

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
      if (!account || !isWalletUnlocked()) return null;

      const keyPair = Keypair.fromSecret(account.privateKey);

      transaction.sign(keyPair);

      return transaction.toXDR();
    },
    [account],
  );

  const signMessage = useCallback(
    (message: string): string | null => {
      if (!account || !isWalletUnlocked()) return null;

      try {
        return signMessageHelper(message, account.privateKey);
      } catch (err) {
        logger.error("useGetActiveAccount", "signMessage failed", err);
        analytics.trackSignedMessageError({ error: String(err).slice(0, 200) });
        return null;
      }
    },
    [account],
  );

  const signAuthEntry = useCallback(
    (
      preimageXdr: string,
    ): { signedAuthEntry: string; signerAddress: string } | null => {
      if (!account || !isWalletUnlocked()) return null;

      try {
        return signAuthEntryHelper(preimageXdr, account.privateKey);
      } catch (err) {
        logger.error("useGetActiveAccount", "signAuthEntry failed", err);
        analytics.trackSignedAuthEntryError({
          error: String(err).slice(0, 200),
        });
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
    signAuthEntry,
  };
};

export default useGetActiveAccount;

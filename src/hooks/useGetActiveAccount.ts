/* eslint-disable @typescript-eslint/ban-ts-comment */
import { navigationRef } from "components/App";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { Account, HashKey } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { t } from "i18next";
import { useCallback, useEffect } from "react";
import { dataStorage } from "services/storage/storageFactory";

/**
 * Checks if a hash key is expired
 */
export const isHashKeyExpired = (hashKey: HashKey): boolean =>
  Date.now() > hashKey.expiresAt;

/**
 * Gets the public key of the active account. Used on lock screen.
 */
export const getActiveAccountPublicKey = async (): Promise<string | null> => {
  try {
    const activeAccountId = await dataStorage.getItem(
      STORAGE_KEYS.ACTIVE_ACCOUNT_ID,
    );

    if (!activeAccountId) {
      return null;
    }

    const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);
    if (!accountListRaw) {
      throw new Error(t("authStore.error.accountListNotFound"));
    }

    const accountList = JSON.parse(accountListRaw) as Account[];
    const account = accountList.find((a) => a.id === activeAccountId);

    if (!account) {
      throw new Error(t("authStore.error.accountNotFound"));
    }

    return account.publicKey;
  } catch (error) {
    logger.error(
      "getActiveAccountPublicKey",
      "Failed to get public key",
      error,
    );
    return null;
  }
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

  return {
    account,
    isLoading,
    error,
    refreshAccount,
  };
};

export default useGetActiveAccount;

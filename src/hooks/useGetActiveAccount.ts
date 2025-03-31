/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useNavigation } from "@react-navigation/native";
import { SENSITIVE_STORAGE_KEYS, STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { Account, AUTH_STATUS, HashKey, TemporaryStore } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { decryptDataWithPassword } from "helpers/encryptPassword";
import { t } from "i18next";
import { useState, useCallback, useEffect } from "react";
import { clearTemporaryData, getHashKey } from "services/storage/helpers";
import {
  dataStorage,
  secureDataStorage,
} from "services/storage/storageFactory";

const decryptTemporaryStore = async (
  hashKey: HashKey,
  temporaryStore: string,
): Promise<TemporaryStore | null> => {
  const { hashKey: hashKeyString, salt } = hashKey;

  const decryptedData = await decryptDataWithPassword({
    data: temporaryStore,
    password: hashKeyString,
    salt,
  });

  if (!decryptedData) {
    return null;
  }

  return JSON.parse(decryptedData) as TemporaryStore;
};

/**
 * Retrieves data from the temporary store
 */
const getTemporaryStore = async (): Promise<TemporaryStore | null> => {
  try {
    const hashKey = await getHashKey();

    if (!hashKey) {
      return null;
    }

    // Get the encrypted temporary store
    const temporaryStore = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    );

    if (!temporaryStore) {
      return null;
    }

    try {
      const decryptedTemporaryStore = await decryptTemporaryStore(
        hashKey,
        temporaryStore,
      );

      if (!decryptedTemporaryStore) {
        return null;
      }

      return decryptedTemporaryStore;
    } catch (error) {
      logger.error(
        "getTemporaryStore",
        "Failed to decrypt temporary store",
        error,
      );

      // If decryption fails, the hash key or temporary store may be corrupted
      // We should clear them both and force a new login

      await clearTemporaryData();

      return null;
    }
  } catch (error) {
    logger.error("getTemporaryStore", "Failed to get temporary store", error);
    return null;
  }
};

export const isHashKeyExpired = (hashKey: HashKey): boolean =>
  Date.now() > hashKey.expiresAt;

/**
 * Gets the public key of the active account. Used on lock screen.
 */
export const getActiveAccountPublicKey = async (): Promise<string | null> => {
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
};

/**
 * Gets the active account data by combining temporary store sensitive data with account list information
 */
const getActiveAccount = async (): Promise<{
  publicKey: string;
  privateKey: string;
  accountName: string;
  id: string;
} | null> => {
  const activeAccountId = await dataStorage.getItem(
    STORAGE_KEYS.ACTIVE_ACCOUNT_ID,
  );

  if (!activeAccountId) {
    throw new Error(t("authStore.error.noActiveAccount"));
  }

  // Get account info from storage (non-sensitive data)
  const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);
  if (!accountListRaw) {
    throw new Error(t("authStore.error.accountListNotFound"));
  }

  const accountList = JSON.parse(accountListRaw) as Account[];
  const account = accountList.find((a) => a.id === activeAccountId);

  if (!account) {
    throw new Error(t("authStore.error.accountNotFound"));
  }

  const hashKey = await getHashKey();

  if (!hashKey) {
    throw new Error(t("authStore.error.hashKeyNotFound"));
  }

  const hashKeyExpired = isHashKeyExpired(hashKey);

  // Get sensitive data from temporary store if the hash key is valid
  if (!hashKeyExpired) {
    const temporaryStore = await getTemporaryStore();

    if (!temporaryStore) {
      throw new Error(t("authStore.error.temporaryStoreNotFound"));
    }

    // Get private key for the active account
    const privateKey = temporaryStore.privateKeys?.[activeAccountId];

    if (!privateKey) {
      throw new Error(t("authStore.error.privateKeyNotFound"));
    }

    return {
      publicKey: account.publicKey,
      privateKey,
      accountName: account.name,
      id: activeAccountId,
    };
  }

  throw new Error(t("authStore.error.authenticationExpired"));
};

/**
 * Hook that provides access to the active account with loading state
 */
const useGetActiveAccount = () => {
  const { getAuthStatus } = useAuthenticationStore();
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<{
    publicKey: string;
    privateKey: string;
    accountName: string;
  } | null>(null);

  const fetchActiveAccount = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check auth status first
      const authStatus = await getAuthStatus();

      if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
        // @ts-ignore
        navigation.navigate(ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN);
        setIsLoading(false);
        return null;
      }

      const activeAccount = await getActiveAccount();
      setAccount(activeAccount);
      return activeAccount;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      setError(errorMessage);

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthStatus, navigation]);

  useEffect(() => {
    fetchActiveAccount();
  }, [fetchActiveAccount]);

  const refreshAccount = useCallback(
    () => fetchActiveAccount(),
    [fetchActiveAccount],
  );

  return {
    account,
    isLoading,
    error,
    refreshAccount,
  };
};

export default useGetActiveAccount;

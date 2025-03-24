import { SENSITIVE_STORAGE_KEYS, STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { Account } from "config/types";
import { decryptDataWithPassword } from "helpers/encryptPassword";
import { t } from "i18next";
import { useState, useCallback } from "react";
import { clearTemporaryData, getHashKey } from "services/storage/helpers";
import {
  dataStorage,
  secureDataStorage,
} from "services/storage/storageFactory";

/**
 * Interface for temporary store data structure
 */
interface TemporaryStore {
  expiration: number;
  privateKeys: Record<string, string>;
  mnemonicPhrase: string;
}

/**
 * Retrieves data from the temporary store
 */
const getTemporaryStore = async (): Promise<TemporaryStore | null> => {
  try {
    const parsedHashKey = await getHashKey();

    if (!parsedHashKey) {
      return null;
    }

    const { hashKey, salt } = parsedHashKey;

    // Get the encrypted temporary store
    const temporaryStore = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    );

    if (!temporaryStore) {
      return null;
    }

    // Get the hash key timestamp
    const timestampStr = await dataStorage.getItem(
      STORAGE_KEYS.HASH_KEY_EXPIRE_AT,
    );

    if (!timestampStr) {
      return null;
    }

    try {
      const decryptedData = await decryptDataWithPassword({
        data: temporaryStore,
        password: hashKey,
        salt,
      });

      // Try to parse the decrypted data
      let parsed: unknown;
      try {
        parsed = JSON.parse(decryptedData);
      } catch (parseError) {
        return null;
      }

      // Validate parsed data structure
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      // Type guard function to verify TemporaryStore structure
      const isTemporaryStore = (obj: unknown): obj is TemporaryStore => {
        const temp = obj as Record<string, unknown>;
        return (
          typeof temp.expiration === "number" &&
          typeof temp.privateKeys === "object" &&
          temp.privateKeys !== null &&
          typeof temp.mnemonicPhrase === "string"
        );
      };

      if (!isTemporaryStore(parsed)) {
        logger.error(
          "getTemporaryStore",
          "Decrypted data does not match TemporaryStore structure",
          parsed,
        );
        return null;
      }

      return parsed;
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

/**
 * Checks if the hash key is still valid (not expired)
 */
export const isHashKeyValid = async (): Promise<boolean> => {
  try {
    const parsedHashKey = await getHashKey();

    if (!parsedHashKey) {
      return false;
    }

    // Check if temporary store exists
    const temporaryStore = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    );

    if (!temporaryStore) {
      return false;
    }

    // Check if hash key timestamp exists and is not expired
    const timestampStr = await dataStorage.getItem(
      STORAGE_KEYS.HASH_KEY_EXPIRE_AT,
    );

    if (!timestampStr) {
      return false;
    }

    const timestamp = parseInt(timestampStr, 10);
    const isValid = Date.now() < timestamp;

    return isValid;
  } catch (error) {
    logger.error("isHashKeyValid", "Failed to check hash key validity", error);
    return false;
  }
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

  // Get sensitive data from temporary store if the hash key is valid
  if (await isHashKeyValid()) {
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<{
    publicKey: string;
    privateKey: string;
    accountName: string;
    id: string;
  } | null>(null);

  /**
   * Fetches the active account data with loading state
   */
  const fetchActiveAccount = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
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
  }, []);

  return {
    account,
    isLoading,
    error,
    fetchActiveAccount,
  };
};

export default useGetActiveAccount;

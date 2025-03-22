import { SENSITIVE_STORAGE_KEYS, STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { Account } from "config/types";
import { decryptDataWithPassword } from "helpers/encryptPassword";
import { t } from "i18next";
import { useState, useCallback } from "react";
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
const getFromTemporaryStore = async (): Promise<TemporaryStore | null> => {
  try {
    // Get the hash key and salt from secure storage
    const [hashKey, hashKeySalt] = await Promise.all([
      secureDataStorage.getItem(SENSITIVE_STORAGE_KEYS.HASH_KEY),
      secureDataStorage.getItem(SENSITIVE_STORAGE_KEYS.HASH_KEY_SALT),
    ]);

    if (!hashKey) {
      logger.error("Hash key not found in secure storage");
      return null;
    }

    if (!hashKeySalt) {
      logger.error("Hash key salt not found in secure storage");
      return null;
    }

    // Get the encrypted temporary store
    const temporaryStore = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    );

    if (!temporaryStore) {
      logger.error("Temporary store not found in secure storage");
      return null;
    }

    // Get the hash key timestamp
    const timestampStr = await dataStorage.getItem(
      STORAGE_KEYS.HASH_KEY_TIMESTAMP,
    );

    if (!timestampStr) {
      logger.error("Hash key timestamp not found in storage");
      return null;
    }

    try {
      // Attempt to decrypt the temporary store
      logger.info("Attempting to decrypt temporary store");

      const decryptedData = await decryptDataWithPassword({
        data: temporaryStore,
        password: hashKey,
        salt: hashKeySalt,
      });

      // Try to parse the decrypted data
      let parsed: unknown;
      try {
        parsed = JSON.parse(decryptedData);
        logger.info("Successfully decrypted and parsed temporary store");
      } catch (parseError) {
        logger.error("Failed to parse decrypted data as JSON", parseError);
        return null;
      }

      // Validate parsed data structure
      if (!parsed || typeof parsed !== "object") {
        logger.error("Decrypted data is not a valid object");
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
          "Decrypted data does not match TemporaryStore structure",
          parsed,
        );
        return null;
      }

      return parsed;
    } catch (error) {
      logger.error("Failed to decrypt temporary store", error);

      // If decryption fails, the hash key or temporary store may be corrupted
      // We should clear them both and force a new login
      logger.info("Clearing corrupted temporary store and hash key");

      await Promise.all([
        secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.HASH_KEY),
        secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.HASH_KEY_SALT),
        secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE),
        dataStorage.remove(STORAGE_KEYS.HASH_KEY_TIMESTAMP),
      ]);

      return null;
    }
  } catch (error) {
    logger.error("Error accessing secure storage", error);
    return null;
  }
};

/**
 * Checks if the hash key is still valid (not expired)
 */
export const isHashKeyValid = async (): Promise<boolean> => {
  try {
    // Check if hash key exists
    const hashKey = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.HASH_KEY,
    );

    if (!hashKey) {
      logger.info("Hash key not found in secure storage");
      return false;
    }

    // Check if hash key salt exists
    const hashKeySalt = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.HASH_KEY_SALT,
    );

    if (!hashKeySalt) {
      logger.info("Hash key salt not found in secure storage");
      return false;
    }

    // Check if temporary store exists
    const temporaryStore = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    );

    if (!temporaryStore) {
      logger.info("Temporary store not found in secure storage");
      return false;
    }

    // Check if hash key timestamp exists and is not expired
    const timestampStr = await dataStorage.getItem(
      STORAGE_KEYS.HASH_KEY_TIMESTAMP,
    );

    if (!timestampStr) {
      logger.info("Hash key timestamp not found in storage");
      return false;
    }

    const timestamp = parseInt(timestampStr, 10);
    const isValid = Date.now() < timestamp;

    if (!isValid) {
      logger.info("Hash key has expired");
    } else {
      logger.info("Hash key is valid");
    }

    return isValid;
  } catch (error) {
    logger.error("Error checking hash key validity", error);
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
    const temporaryStore = await getFromTemporaryStore();

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

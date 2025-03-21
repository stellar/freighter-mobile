import { encode as base64Encode } from "@stablelib/base64";
import { Networks } from "@stellar/stellar-sdk";
import { KeyType, ScryptEncrypter } from "@stellar/typescript-wallet-sdk-km";
import {
  NETWORKS,
  SENSITIVE_STORAGE_KEYS,
  STORAGE_KEYS,
} from "config/constants";
import { logger } from "config/logger";
import { Account, KeyPair } from "config/types";
import {
  deriveKeyFromPassword,
  encryptDataWithPassword,
  generateSalt,
} from "helpers/encryptPassword";
import { createKeyManager } from "helpers/keyManager/keyManager";
import { isHashKeyValid } from "hooks/useGetActiveAccount";
import { t } from "i18next";
import {
  dataStorage,
  secureDataStorage,
} from "services/storage/storageFactory";
import { fromMnemonic } from "stellar-hd-wallet";
import { create } from "zustand";

// Parameters for signUp function
interface SignUpParams {
  mnemonicPhrase: string;
  password: string;
  imported?: boolean;
}

// Parameters for storeAccount function
interface StoreAccountParams {
  mnemonicPhrase: string;
  password: string;
  keyPair: KeyPair;
  imported?: boolean;
}

// State slice types
interface AuthState {
  network: NETWORKS | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  activeKeyPair: {
    publicKey: string;
    privateKey: string;
    accountName: string;
    id: string;
  } | null;
}

interface AuthActions {
  login: (password: string, recoveryPhrase: string) => void;
  logout: () => void;
  signUp: (params: SignUpParams) => void;
  getIsAuthenticated: () => void;
  clearError: () => void;
  resetAuthenticationState: () => void;
}

type AuthStore = AuthState & AuthActions;

// Initial state
const initialState: AuthState = {
  network: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  activeKeyPair: null,
};

// Constants
const HASH_KEY_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Key manager instance for handling cryptographic operations
 */
const keyManager = createKeyManager(Networks.TESTNET);

/**
 * Helper functions
 */
const appendAccount = async (account: Account) => {
  const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);
  const accountList = accountListRaw
    ? (JSON.parse(accountListRaw) as Account[])
    : [];

  await dataStorage.setItem(
    STORAGE_KEYS.ACCOUNT_LIST,
    JSON.stringify([...accountList, account]),
  );
};

/**
 * Generates a unique hash key derived from the password
 * This key will be used to encrypt/decrypt the temporary store
 */
const generateHashKey = async (
  password: string,
): Promise<{
  hashKey: string;
  salt: string;
}> => {
  try {
    // Generate a random salt for the hash key
    const salt = generateSalt();

    // Derive a key from the password using the salt
    const hashKeyBytes = await deriveKeyFromPassword({
      password,
      saltParam: salt,
    });

    // Convert to base64 for storage
    const hashKey = base64Encode(hashKeyBytes);

    // Calculate the expiration timestamp (24 hours from now)
    const expirationTime = Date.now() + HASH_KEY_EXPIRATION_MS;
    // Store the hash key, salt, and expiration timestamp
    await Promise.all([
      dataStorage.setItem(
        STORAGE_KEYS.HASH_KEY_TIMESTAMP,
        expirationTime.toString(),
      ),
      secureDataStorage.setItem(SENSITIVE_STORAGE_KEYS.HASH_KEY, hashKey),
      secureDataStorage.setItem(SENSITIVE_STORAGE_KEYS.HASH_KEY_SALT, salt),
    ]);

    return { hashKey, salt };
  } catch (error) {
    logger.error("Failed to generate hash key", error);
    throw new Error("Failed to generate hash key");
  }
};

/**
 * Creates and encrypts the temporary store using the hash key
 */
const createTemporaryStore = async (
  password: string,
  mnemonicPhrase: string,
  activeKeyPair: KeyPair & { accountName: string; id: string },
): Promise<void> => {
  try {
    // Generate a new hash key
    const { hashKey, salt } = await generateHashKey(password);

    // Create the temporary store object
    const temporaryStore = {
      expiration: Date.now() + HASH_KEY_EXPIRATION_MS,
      privateKeys: {
        [activeKeyPair.id]: activeKeyPair.privateKey,
      },
      mnemonicPhrase,
    };

    // Convert the store to a JSON string
    const temporaryStoreJson = JSON.stringify(temporaryStore);

    // Encrypt the temporary store with the hash key
    const { encryptedData } = await encryptDataWithPassword({
      data: temporaryStoreJson,
      password: hashKey,
      salt,
    });

    // Store the encrypted data
    await secureDataStorage.setItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
      encryptedData,
    );
  } catch (error) {
    logger.error("Failed to create temporary store", error);
    throw new Error("Failed to create temporary store");
  }
};

const storeAccount = async ({
  mnemonicPhrase,
  password,
  keyPair,
  imported = false,
}: StoreAccountParams): Promise<void> => {
  const { publicKey, privateKey } = keyPair;

  // Store the key using the key manager
  const keyMetadata = {
    key: {
      extra: { imported, mnemonicPhrase },
      type: KeyType.plaintextKey,
      publicKey,
      privateKey,
    },
    password,
    encrypterName: ScryptEncrypter.name,
  };

  // const [keyStore, accountListRaw] = await Promise.all([
  //   keyManager.storeKey(keyMetadata),
  //   dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST),
  // ]);
  const keyStore = await keyManager.storeKey(keyMetadata);
  const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);

  const accountList = accountListRaw
    ? (JSON.parse(accountListRaw) as Account[])
    : [];
  const accountName = t("authStore.account", {
    number: accountList.length + 1,
  });

  // Store account info
  await Promise.all([
    dataStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID, keyStore.id),
    appendAccount({
      id: keyStore.id,
      name: accountName,
      publicKey,
      imported,
    }),
    createTemporaryStore(password, mnemonicPhrase, {
      publicKey,
      privateKey,
      accountName,
      id: keyStore.id,
    }),
  ]);
};

/**
 * Logs out the user and clears sensitive data
 */
const logout = async (): Promise<void> => {
  try {
    await Promise.all([
      await secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.HASH_KEY),
      await secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.HASH_KEY_SALT),
      await secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE),
      await secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.MNEMONIC_PHRASE),
      await dataStorage.remove(STORAGE_KEYS.HASH_KEY_TIMESTAMP),
      await dataStorage.remove(STORAGE_KEYS.ACCOUNT_LIST),
      await dataStorage.remove(STORAGE_KEYS.ACTIVE_ACCOUNT_ID),
    ]);
  } catch (error) {
    logger.error("Failed to logout", error);
    throw error;
  }
};

/**
 * Signs up a new user with the provided credentials
 */
const signUp = async ({
  mnemonicPhrase,
  password,
  imported = false,
}: SignUpParams): Promise<void> => {
  try {
    // Generate a key pair from the mnemonic
    const wallet = fromMnemonic(mnemonicPhrase);
    const keyDerivationNumber = 0;

    const keyPair = {
      publicKey: wallet.getPublicKey(keyDerivationNumber),
      privateKey: wallet.getSecret(keyDerivationNumber),
    };

    // Store the account in the key manager and create the temporary store
    await storeAccount({
      mnemonicPhrase,
      password,
      keyPair,
      imported,
    });
  } catch (error) {
    logger.error("Failed to sign up", error);

    // Clean up any partial data on error
    await logout();

    throw error;
  }
};

/**
 * Authenticates a user with their password
 */
const login = async (password: string): Promise<void> => {
  try {
    // Check if an active account exists
    const activeAccount = await dataStorage.getItem(
      STORAGE_KEYS.ACTIVE_ACCOUNT_ID,
    );

    if (!activeAccount) {
      logger.error("No active account found during login");
      throw new Error(t("authStore.error.noActiveAccount"));
    }

    try {
      // Check if the key exists in the store and load it with password
      const loadedKey = await keyManager.loadKey(activeAccount, password);

      if (!loadedKey) {
        logger.error("No key pair found in key manager");
        throw new Error(t("authStore.error.noKeyPairFound"));
      }

      if (!loadedKey.extra) {
        logger.error("Key exists but has no extra data");
        throw new Error(t("authStore.error.noKeyPairFound"));
      }

      // Extract the mnemonic phrase from the key's extra data
      const { mnemonicPhrase } = loadedKey.extra as { mnemonicPhrase?: string };

      if (!mnemonicPhrase) {
        logger.error("Mnemonic phrase not found in key's extra data");
        throw new Error(t("authStore.error.mnemonicPhraseNotFound"));
      }

      // Get account name from stored accounts
      const accountListRaw = await dataStorage.getItem(
        STORAGE_KEYS.ACCOUNT_LIST,
      );

      if (!accountListRaw) {
        logger.error("Account list not found in storage");
        throw new Error(t("authStore.error.accountListNotFound"));
      }

      const accountList = JSON.parse(accountListRaw) as Account[];
      const account = accountList.find((a) => a.id === activeAccount);

      if (!account) {
        logger.error(
          `Account with ID ${activeAccount} not found in account list`,
        );
        throw new Error(t("authStore.error.accountNotFound"));
      }

      // Create the temporary store with the hash key
      await createTemporaryStore(password, mnemonicPhrase, {
        publicKey: account.publicKey,
        privateKey: loadedKey.privateKey,
        accountName: account.name,
        id: account.id,
      });
    } catch (error) {
      logger.error("Failed to login", error);
      throw new Error(t("authStore.error.invalidPassword"));
    }
  } catch (error) {
    logger.error("Login process failed", error);
    throw error;
  }
};

/**
 * Reset the authentication state for debugging purposes
 * This function should be used when there's a decryption error to start fresh
 */
const resetAuthenticationState = async (): Promise<void> => {
  try {
    // Clear all authentication related data
    await Promise.all([
      secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.HASH_KEY),
      secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.HASH_KEY_SALT),
      secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE),
      dataStorage.remove(STORAGE_KEYS.HASH_KEY_TIMESTAMP),
    ]);

    // Don't remove the account list or active account ID
    // This allows the user to still see their accounts after reset
  } catch (error) {
    logger.error("Failed to reset authentication state", error);
    throw error;
  }
};

/**
 * Authentication Store
 */
export const useAuthenticationStore = create<AuthStore>()((set) => ({
  ...initialState,

  clearError: () => set({ error: null }),

  login: (password, recoveryPhrase) => {
    set((state) => ({ ...state, isLoading: true }));

    // If a recovery phrase is provided, we're doing recovery login
    if (recoveryPhrase) {
      signUp({ mnemonicPhrase: recoveryPhrase, password, imported: true })
        .then(() => {
          set((state) => ({
            ...state,
            network: NETWORKS.TESTNET,
            isAuthenticated: true,
          }));
        })
        .catch((error) => {
          set((state) => ({
            ...state,
            error:
              error instanceof Error
                ? error.message
                : "Failed to recover account",
          }));
        })
        .finally(() => {
          set((state) => ({ ...state, isLoading: false }));
        });
      return;
    }

    // Regular password login
    login(password)
      .then(() => {
        set((state) => ({
          ...state,
          network: NETWORKS.TESTNET,
          isAuthenticated: true,
        }));
      })
      .catch((error) => {
        set((state) => ({
          ...state,
          error: error instanceof Error ? error.message : "Failed to login",
        }));
      })
      .finally(() => {
        set((state) => ({ ...state, isLoading: false }));
      });
  },

  logout: () => {
    set((state) => ({ ...state, isLoading: true, error: null }));

    logout()
      .then(() => {
        set({ ...initialState });
      })
      .catch((error) => {
        set({
          error:
            error instanceof Error
              ? error.message
              : t("authStore.error.failedToLogout"),
        });
      })
      .finally(() => {
        set({ isLoading: false });
      });
  },

  signUp: (params) => {
    // Set loading state
    set((state) => ({ ...state, isLoading: true, error: null }));

    // Use a setTimeout to allow UI updates to propagate
    setTimeout(() => {
      signUp(params)
        .then(() => {
          set({
            network: NETWORKS.TESTNET,
            isAuthenticated: true,
            isLoading: false,
          });
          logger.info("Sign up completed successfully");
        })
        .catch((error) => {
          logger.error("Sign up failed", error);
          set({
            error:
              error instanceof Error
                ? error.message
                : t("authStore.error.failedToSignUp"),
            isLoading: false,
          });
          logout();
        });
    }, 0);
  },

  getIsAuthenticated: () => {
    set((state) => ({ ...state, isLoading: true, error: null }));

    isHashKeyValid()
      .then((hashKeyValid) => {
        set({ isAuthenticated: hashKeyValid });
      })
      .catch((error) => {
        set({
          error:
            error instanceof Error
              ? error.message
              : t("authStore.error.failedToCheckAuthenticationStatus"),
        });
        set({ isAuthenticated: false });
      })
      .finally(() => {
        set({ isLoading: false });
      });
  },

  resetAuthenticationState: () => {
    set({ isLoading: true, error: null });

    resetAuthenticationState()
      .then(() => {
        set({
          isAuthenticated: false,
        });
      })
      .catch((error) => {
        set({
          error:
            error instanceof Error
              ? error.message
              : "Failed to reset authentication state",
        });
      })
      .finally(() => {
        set({ isLoading: false });
      });
  },
}));

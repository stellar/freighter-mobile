import { encode as base64Encode } from "@stablelib/base64";
import { Networks } from "@stellar/stellar-sdk";
import { KeyType, ScryptEncrypter } from "@stellar/typescript-wallet-sdk-km";
import {
  NETWORKS,
  SENSITIVE_STORAGE_KEYS,
  STORAGE_KEYS,
} from "config/constants";
import { logger } from "config/logger";
import { Account, HashKey, KeyPair, TemporaryStore } from "config/types";
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

// Parameters for login function
interface SignInParams {
  password: string;
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
  activeKeyPair: (KeyPair & { accountName: string; id: string }) | null;
}

/**
 * Actions for the Auth store
 *
 * logout: Logs out the user and clears sensitive data
 * signUp: Signs up a new user with the provided seed phrase and password. This function stores the account in the key manager and creates the temporary store.
 * signIn: Logs in the user with the provided password. This function is called when the existing hashKey is expired. It creates a new hashKey and temporary store.
 * importWallet: Imports a wallet with the provided seed phrase and password. This function stores the account in the key manager and creates the temporary store.
 * addAccount: Adds a new account to the account list. This derives a new key pair from the mnemonic phrase and stores it in the key manager.
 * getIsAuthenticated: Checks if the user is authenticated
 * clearError: Clears the error message
 */
interface AuthActions {
  logout: () => void;
  signUp: (params: SignUpParams) => void;
  signIn: (params: SignInParams) => void;
  getIsAuthenticated: () => void;
  clearError: () => void;
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
 * We're using testnet as the default, but the same key manager can be used for mainnet as well
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

  if (
    accountList.find(
      (a) => a.id === account.id && a.network === account.network,
    )
  ) {
    return;
  }

  await dataStorage.setItem(
    STORAGE_KEYS.ACCOUNT_LIST,
    JSON.stringify([...accountList, account]),
  );
};

/**
 * Generates a unique hash key derived from the password
 * This key will be used to encrypt/decrypt the temporary store
 */
const generateHashKey = async (password: string): Promise<HashKey> => {
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
    const hashKeyObj = {
      hashKey,
      salt,
    };
    await Promise.all([
      dataStorage.setItem(
        STORAGE_KEYS.HASH_KEY_EXPIRE_AT,
        expirationTime.toString(),
      ),
      secureDataStorage.setItem(
        SENSITIVE_STORAGE_KEYS.HASH_KEY,
        JSON.stringify(hashKeyObj),
      ),
    ]);

    return { hashKey, salt };
  } catch (error) {
    logger.error("generateHashKey", "Failed to generate hash key", error);
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
    } as TemporaryStore;

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
    logger.error(
      "createTemporaryStore",
      "Failed to create temporary store",
      error,
    );
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

  const [keyStore, accountListRaw] = await Promise.all([
    keyManager.storeKey(keyMetadata),
    dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST),
  ]);

  const accountList = accountListRaw
    ? (JSON.parse(accountListRaw) as Account[])
    : [];
  const accountName = t("authStore.account", {
    number: accountList.length + 1,
  });

  await Promise.all([
    dataStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID, keyStore.id),
    appendAccount({
      id: keyStore.id,
      name: accountName,
      publicKey,
      imported,
      network: NETWORKS.TESTNET,
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
      secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.HASH_KEY),
      secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE),
      dataStorage.remove(STORAGE_KEYS.HASH_KEY_EXPIRE_AT),
      dataStorage.remove(STORAGE_KEYS.ACCOUNT_LIST),
      dataStorage.remove(STORAGE_KEYS.ACTIVE_ACCOUNT_ID),
    ]);
  } catch (error) {
    logger.error("storeAccount", "Failed to logout", error);
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
    logger.error("signUp", "Failed to sign up", error);

    // Clean up any partial data on error
    await logout();

    throw error;
  }
};

/**
 * Logs in the user with the provided password
 */
const signIn = async ({ password }: SignInParams): Promise<void> => {
  try {
    let activeAccount = await dataStorage.getItem(
      STORAGE_KEYS.ACTIVE_ACCOUNT_ID,
    );

    // Check if an active account exists.
    // If not, use the first key found in the key manager
    if (!activeAccount) {
      logger.info("signIn", "No active account found during login");

      const allKeys = await keyManager.loadAllKeyIds();

      if (allKeys.length === 0) {
        logger.error("signIn", "No keys found in key manager");
        throw new Error(t("authStore.error.noKeyPairFound"));
      }

      [activeAccount] = allKeys;
    }

    // Load the key with the password
    // TOOD: implement error handling logic -- maybe add a limit to the number of attempts
    const loadedKey = await keyManager.loadKey(activeAccount, password);
    const keyExtraData = loadedKey.extra as
      | undefined
      | {
          mnemonicPhrase: string | null;
        };

    if (!keyExtraData || !keyExtraData?.mnemonicPhrase) {
      logger.error("signIn", "Key exists but has no extra data");
      // Clear the all the data and throw an error
      await logout();
      throw new Error(t("authStore.error.noKeyPairFound"));
    }

    const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);
    const accountList = JSON.parse(accountListRaw ?? "[]") as Account[];
    let account = accountList.find((a) => a.id === activeAccount);

    if (!account) {
      logger.error("signIn", "Account not found in account list");
      // Clear the all the data and throw an error
      account = {
        id: activeAccount,
        name: t("authStore.account", { number: accountList.length + 1 }),
        publicKey: loadedKey.publicKey,
        imported: false,
        network: NETWORKS.TESTNET,
      };

      await appendAccount(account);
    }

    await createTemporaryStore(password, keyExtraData.mnemonicPhrase, {
      publicKey: loadedKey.publicKey,
      privateKey: loadedKey.privateKey,
      accountName: account.name,
      id: activeAccount,
    });
  } catch (error) {
    logger.error("signIn", "Failed to sign in", error);
    throw error;
  }
};

/**
 * Authentication Store
 */
export const useAuthenticationStore = create<AuthStore>()((set) => ({
  ...initialState,

  clearError: () => set({ error: null }),

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
        })
        .catch((error) => {
          logger.error(
            "useAuthenticationStore.signUp",
            "Sign up failed",
            error,
          );
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

  signIn: (params) => {
    // Set loading state
    set((state) => ({ ...state, isLoading: true, error: null }));

    // Use a setTimeout to allow UI updates to propagate
    setTimeout(() => {
      signIn(params)
        .then(() => {
          set({
            isAuthenticated: true,
            isLoading: false,
          });
        })
        .catch((error) => {
          logger.error(
            "useAuthenticationStore.signIn",
            "Sign in failed",
            error,
          );
          set({
            error:
              error instanceof Error
                ? error.message
                : t("authStore.error.failedToSignIn"),
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
}));

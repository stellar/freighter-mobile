import { encode as base64Encode } from "@stablelib/base64";
import { Networks } from "@stellar/stellar-sdk";
import { KeyType, ScryptEncrypter } from "@stellar/typescript-wallet-sdk-km";
import {
  HASH_KEY_EXPIRATION_MS,
  NETWORKS,
  SENSITIVE_STORAGE_KEYS,
  STORAGE_KEYS,
} from "config/constants";
import { logger } from "config/logger";
import {
  Account,
  AUTH_STATUS,
  AuthStatus,
  HashKey,
  KeyPair,
  TemporaryStore,
} from "config/types";
import {
  deriveKeyFromPassword,
  encryptDataWithPassword,
  generateSalt,
} from "helpers/encryptPassword";
import { createKeyManager } from "helpers/keyManager/keyManager";
import { isHashKeyExpired } from "hooks/useGetActiveAccount";
import { t } from "i18next";
import { clearTemporaryData, getHashKey } from "services/storage/helpers";
import {
  dataStorage,
  secureDataStorage,
} from "services/storage/storageFactory";
import StellarHDWallet from "stellar-hd-wallet";
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

// Parameters for importWallet function
interface ImportWalletParams {
  mnemonicPhrase: string;
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
  isLoading: boolean;
  error: string | null;
  authStatus: AuthStatus;
}

/**
 * Actions for the Auth store
 *
 * logout: Logs out the user and clears stored data (both sensitive and non-sensitive)
 * signUp: Signs up a new user with the password. This function stores the account in the key manager and creates the temporary store.
 * signIn: Logs in the user with the provided password. This function is called when the existing hashKey is expired. It creates a new hashKey and temporary store.
 * importWallet: Imports a wallet with the provided seed phrase and password. This function stores the account in the key manager and creates the temporary store.
 */
interface AuthActions {
  logout: () => void;
  signUp: (params: SignUpParams) => void;
  signIn: (params: SignInParams) => Promise<void>;
  importWallet: (params: ImportWalletParams) => void;
  getAuthStatus: () => Promise<AuthStatus>;
}

type AuthStore = AuthState & AuthActions;

// Initial state
const initialState: AuthState = {
  network: NETWORKS.TESTNET,
  isLoading: false,
  error: null,
  authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
};

/**
 * Key manager instance for handling cryptographic operations
 * We're using testnet as the default, but the same key manager can be used for mainnet as well
 */
const keyManager = createKeyManager(Networks.TESTNET);

/**
 * Validates the authentication status of the user
 */
const getAuthStatus = async (): Promise<AuthStatus> => {
  try {
    const [hashKey, temporaryStore] = await Promise.all([
      getHashKey(),
      secureDataStorage.getItem(SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE),
    ]);

    if (!hashKey || !temporaryStore) {
      // No hash key or temporary store found. User is not authenticated.
      return AUTH_STATUS.NOT_AUTHENTICATED;
    }

    const hashKeyExpired = isHashKeyExpired(hashKey);

    if (hashKeyExpired) {
      return AUTH_STATUS.HASH_KEY_EXPIRED;
    }

    return AUTH_STATUS.AUTHENTICATED;
  } catch (error) {
    logger.error("validateAuth", "Failed to validate auth", error);
    return AUTH_STATUS.NOT_AUTHENTICATED;
  }
};

/**
 * Adds a new account to the account list
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
 * Generate and store a unique hash key derived from the password
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

    // Calculate the expiration timestamp
    const expirationTime = Date.now() + HASH_KEY_EXPIRATION_MS;

    // Store the hash key, salt, and expiration timestamp
    const hashKeyObj = {
      hashKey,
      salt,
      expiresAt: expirationTime,
    };
    await Promise.all([
      secureDataStorage.setItem(
        SENSITIVE_STORAGE_KEYS.HASH_KEY,
        JSON.stringify(hashKeyObj),
      ),
    ]);

    return hashKeyObj;
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
      clearTemporaryData(),
      dataStorage.remove(STORAGE_KEYS.ACTIVE_ACCOUNT_ID),
      dataStorage.remove(STORAGE_KEYS.ACCOUNT_LIST),
    ]);
  } catch (error) {
    logger.error("logout", "Failed to logout", error);
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
    const wallet = StellarHDWallet.fromMnemonic(mnemonicPhrase);
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
    const loadedKey = await keyManager
      .loadKey(activeAccount, password)
      .catch(() => {
        // TODO: implement error handling logic -- maybe add a limit to the number of attempts
        throw new Error(t("authStore.error.invalidPassword"));
      });

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
 * Imports a wallet with the provided credentials
 */
const importWallet = async ({
  mnemonicPhrase,
  password,
}: ImportWalletParams): Promise<void> => {
  try {
    // Generate a key pair from the mnemonic
    const wallet = StellarHDWallet.fromMnemonic(mnemonicPhrase);
    const keyDerivationNumber = 0;

    const keyPair = {
      publicKey: wallet.getPublicKey(keyDerivationNumber),
      privateKey: wallet.getSecret(keyDerivationNumber),
    };

    // Delete any existing accounts
    const allKeys = await keyManager.loadAllKeyIds();
    if (allKeys.length > 0) {
      const promises = [
        ...allKeys.map((key) => keyManager.removeKey(key)),
        dataStorage.remove(STORAGE_KEYS.ACTIVE_ACCOUNT_ID),
        dataStorage.remove(STORAGE_KEYS.ACCOUNT_LIST),
      ];

      await Promise.all(promises);
    }

    // Store the account in the key manager and create the temporary store
    await storeAccount({
      mnemonicPhrase,
      password,
      keyPair,
    });
  } catch (error) {
    logger.error("importWallet", "Failed to import wallet", error);
    throw error;
  }
};

/**
 * Authentication Store
 */
export const useAuthenticationStore = create<AuthStore>()((set) => ({
  ...initialState,

  logout: () => {
    set((state) => ({ ...state, isLoading: true, error: null }));

    logout()
      .then(() => {
        set({
          ...initialState,
          authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
          isLoading: false,
        });
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
    set((state) => ({ ...state, isLoading: true, error: null }));

    // Use a setTimeout to allow UI updates to propagate
    setTimeout(() => {
      signUp(params)
        .then(() => {
          set({
            ...initialState,
            authStatus: AUTH_STATUS.AUTHENTICATED,
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
        });
    }, 0);
  },

  signIn: async (params) => {
    set({ isLoading: true, error: null });

    try {
      await signIn(params);
      set({
        ...initialState,
        authStatus: AUTH_STATUS.AUTHENTICATED,
        isLoading: false,
      });
    } catch (error) {
      logger.error("useAuthenticationStore.signIn", "Sign in failed", error);
      set({
        error:
          error instanceof Error
            ? error.message
            : t("authStore.error.failedToSignIn"),
        isLoading: false,
      });
      throw error; // Rethrow to handle in the UI
    }
  },

  importWallet: (params) => {
    set((state) => ({ ...state, isLoading: true, error: null }));

    setTimeout(() => {
      importWallet(params)
        .then(() => {
          set({
            ...initialState,
            authStatus: AUTH_STATUS.AUTHENTICATED,
            isLoading: false,
          });
        })
        .catch((error) => {
          logger.error(
            "useAuthenticationStore.importWallet",
            "Import wallet failed",
            error,
          );
          set({
            error:
              error instanceof Error
                ? error.message
                : t("authStore.error.failedToImportWallet"),
            isLoading: false,
          });
        });
    }, 0);
  },

  getAuthStatus: async () => {
    const authStatus = await getAuthStatus();
    set({ authStatus });
    return authStatus;
  },
}));

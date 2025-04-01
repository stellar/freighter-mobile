import { NavigationContainerRef } from "@react-navigation/native";
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
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
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
  decryptDataWithPassword,
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

// Active account type
interface ActiveAccount {
  publicKey: string;
  privateKey: string;
  accountName: string;
  id: string;
}

// State slice types
interface AuthState {
  network: NETWORKS | null;
  isLoading: boolean;
  error: string | null;
  authStatus: AuthStatus;

  // Active account state
  account: ActiveAccount | null;
  isLoadingAccount: boolean;
  accountError: string | null;
  navigationRef: NavigationContainerRef<RootStackParamList> | null;
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

  // Active account actions
  fetchActiveAccount: () => Promise<ActiveAccount | null>;
  refreshActiveAccount: () => Promise<ActiveAccount | null>;
  setNavigationRef: (ref: NavigationContainerRef<RootStackParamList>) => void;
  navigateToLockScreen: () => void;

  wipeAllDataForDebug: () => Promise<boolean>;
}

type AuthStore = AuthState & AuthActions;

// Initial state
const initialState: AuthState = {
  network: NETWORKS.TESTNET,
  isLoading: false,
  error: null,
  authStatus: AUTH_STATUS.NOT_AUTHENTICATED,

  // Active account initial state
  account: null,
  isLoadingAccount: false,
  accountError: null,
  navigationRef: null,
};

/**
 * Key manager instance for handling cryptographic operations
 * We're using testnet as the default, but the same key manager can be used for mainnet as well
 */
const keyManager = createKeyManager(Networks.TESTNET);

/**
 * Checks if there's an existing account (even if logged out)
 */
const hasExistingAccount = async (): Promise<boolean> => {
  try {
    // Get the account list regardless of active account
    const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);
    if (!accountListRaw) {
      return false;
    }

    const accountList = JSON.parse(accountListRaw) as Account[];

    // Return true if there's at least one account in the list
    return accountList.length > 0;
  } catch (error) {
    logger.error(
      "hasExistingAccount",
      "Failed to check for existing accounts",
      error,
    );
    return false;
  }
};

/**
 * Validates the authentication status of the user
 */
const getAuthStatus = async (): Promise<AuthStatus> => {
  try {
    // Check if any accounts exist at all
    const hasAccount = await hasExistingAccount();

    const [hashKey, temporaryStore] = await Promise.all([
      getHashKey(),
      secureDataStorage.getItem(SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE),
    ]);

    // If there are no accounts at all, always return NOT_AUTHENTICATED
    if (!hasAccount) {
      return AUTH_STATUS.NOT_AUTHENTICATED;
    }

    // If we have accounts but no hash key or temp store, return HASH_KEY_EXPIRED
    // This happens after logout but with accounts still in the system
    if (hasAccount && (!hashKey || !temporaryStore)) {
      return AUTH_STATUS.HASH_KEY_EXPIRED;
    }

    // Check if hash key is expired
    if (hashKey && isHashKeyExpired(hashKey)) {
      return AUTH_STATUS.HASH_KEY_EXPIRED;
    }

    // All conditions for authentication are met
    return AUTH_STATUS.AUTHENTICATED;
  } catch (error) {
    logger.error("validateAuth", "Failed to validate auth", error);
    return AUTH_STATUS.NOT_AUTHENTICATED;
  }
};

/**
 * Decrypts and returns the temporary store data
 */
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
      logger.error("getTemporaryStore", "Hash key not found");
      return null;
    }

    // Get the encrypted temporary store
    const temporaryStore = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    );

    if (!temporaryStore) {
      logger.error("getTemporaryStore", "Temporary store data not found");
      return null;
    }

    try {
      const decryptedTemporaryStore = await decryptTemporaryStore(
        hashKey,
        temporaryStore,
      );

      if (!decryptedTemporaryStore) {
        logger.error("getTemporaryStore", "Failed to decrypt temporary store");
        return null;
      }

      // Validate the structure of the temporary store
      if (
        !decryptedTemporaryStore.privateKeys ||
        !decryptedTemporaryStore.mnemonicPhrase
      ) {
        logger.error(
          "getTemporaryStore",
          "Temporary store has invalid structure",
        );
        await clearTemporaryData();
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
 * Logs out the user and clears sensitive data (internal implementation)
 */
const logoutInternal = async (): Promise<void> => {
  try {
    await Promise.all([
      clearTemporaryData(),
      dataStorage.remove(STORAGE_KEYS.ACTIVE_ACCOUNT_ID),
      dataStorage.remove(STORAGE_KEYS.ACCOUNT_LIST),
    ]);
  } catch (error) {
    logger.error("logoutInternal", "Failed to logout", error);
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
    await logoutInternal();

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
      await logoutInternal();
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
 * Gets the active account data by combining temporary store sensitive data with account list information
 */
const getActiveAccount = async (): Promise<ActiveAccount | null> => {
  try {
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
  } catch (error) {
    logger.error("getActiveAccount", "Failed to get active account", error);
    throw error;
  }
};

/**
 * Authentication Store
 */
export const useAuthenticationStore = create<AuthStore>()((set, get) => ({
  ...initialState,

  logout: () => {
    set((state) => ({ ...state, isLoading: true, error: null }));

    // We'll use setTimeout to handle the async operations
    // This avoids the issue with void return expectations from zustand
    setTimeout(() => {
      // Use a self-executing async function
      (async () => {
        try {
          // Check if there's an existing account before logout
          const hasAccount = await hasExistingAccount();

          // Clear all sensitive data regardless
          await clearTemporaryData();

          // If there's an existing account, don't remove account list - just navigate to lock screen
          if (hasAccount) {
            set({
              account: null,
              isLoadingAccount: false,
              accountError: null,
              authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
              isLoading: false,
            });

            // Navigate to lock screen
            const { navigationRef } = get();
            if (navigationRef && navigationRef.isReady()) {
              navigationRef.resetRoot({
                index: 0,
                routes: [{ name: ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN }],
              });
            }
          } else {
            // No existing account, perform full logout
            await dataStorage.remove(STORAGE_KEYS.ACTIVE_ACCOUNT_ID);
            await dataStorage.remove(STORAGE_KEYS.ACCOUNT_LIST);

            set({
              ...initialState,
              authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
              isLoading: false,
            });
          }
        } catch (error) {
          logger.error("logout", "Failed to logout", error);
          set({
            error:
              error instanceof Error
                ? error.message
                : t("authStore.error.failedToLogout"),
            isLoading: false,
          });
        }
      })();
    }, 0);
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

          // Fetch active account after successful signup
          get().fetchActiveAccount();
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
      // First perform the sign in operation without changing auth state
      await signIn(params);

      // Now verify we can access the active account before changing auth state
      try {
        // This will throw if the temporary store is missing or invalid
        const activeAccount = await getActiveAccount();

        if (!activeAccount) {
          throw new Error(t("authStore.error.failedToLoadAccount"));
        }

        // Only if we can successfully load the account, set the authenticated state
        set({
          ...initialState,
          authStatus: AUTH_STATUS.AUTHENTICATED,
          isLoading: false,
          account: activeAccount,
          isLoadingAccount: false,
        });
      } catch (accountError) {
        // If we can't access the account after sign-in, handle it as an expired key
        logger.error(
          "useAuthenticationStore.signIn",
          "Failed to access account",
          accountError,
        );

        // Set auth status to expired and show error
        set({
          authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
          error:
            accountError instanceof Error
              ? accountError.message
              : String(accountError),
          isLoading: false,
        });

        // Navigate to lock screen
        get().navigateToLockScreen();
      }
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

          // Fetch active account after successful wallet import
          get().fetchActiveAccount();
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

    // If the hash key is expired, navigate to lock screen
    if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
      get().navigateToLockScreen();
    }

    return authStatus;
  },

  navigateToLockScreen: () => {
    const { navigationRef } = get();
    if (navigationRef && navigationRef.isReady()) {
      // Check if we're already on the lock screen to prevent navigation loops
      const currentRoute = navigationRef.getCurrentRoute();
      if (currentRoute?.name === ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN) {
        // Already on lock screen, don't navigate again
        return;
      }

      // Use resetRoot instead of navigate to avoid warnings with conditional navigators
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN }],
      });
    }
  },

  fetchActiveAccount: async () => {
    set({ isLoadingAccount: true, accountError: null });

    try {
      // Check auth status first
      const authStatus = await getAuthStatus();

      if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
        set({ authStatus: AUTH_STATUS.HASH_KEY_EXPIRED });

        // Navigate to lock screen
        get().navigateToLockScreen();

        set({ isLoadingAccount: false });
        return null;
      }

      const activeAccount = await getActiveAccount();
      set({ account: activeAccount, isLoadingAccount: false });
      return activeAccount;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      set({ accountError: errorMessage, isLoadingAccount: false });
      return null;
    }
  },

  refreshActiveAccount: () => get().fetchActiveAccount(),

  setNavigationRef: (ref) => {
    set({ navigationRef: ref });
  },

  wipeAllDataForDebug: async () => {
    try {
      set({ isLoading: true, error: null });

      // Try to get all IDs from the key manager
      const allKeys = await keyManager.loadAllKeyIds();

      // Delete all keys from key manager
      await Promise.all(allKeys.map((key) => keyManager.removeKey(key)));

      // Clear all sensitive data
      await clearTemporaryData();

      // Clear all stored data
      await Promise.all([
        dataStorage.remove(STORAGE_KEYS.ACTIVE_ACCOUNT_ID),
        dataStorage.remove(STORAGE_KEYS.ACCOUNT_LIST),
      ]);

      // Reset store state to initial
      set({
        ...initialState,
        authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
        isLoading: false,
      });

      // Navigate to welcome screen
      const { navigationRef } = get();
      if (navigationRef && navigationRef.isReady()) {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: ROOT_NAVIGATOR_ROUTES.AUTH_STACK }],
        });
      }

      return true;
    } catch (error) {
      logger.error("wipeAllDataForDebug", "Failed to wipe all data", error);
      set({
        error: error instanceof Error ? error.message : "Failed to wipe data",
        isLoading: false,
      });
      return false;
    }
  },
}));

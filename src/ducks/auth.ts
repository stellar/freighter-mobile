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
import { t } from "i18next";
import { clearTemporaryData, getHashKey } from "services/storage/helpers";
import {
  dataStorage,
  secureDataStorage,
} from "services/storage/storageFactory";
import StellarHDWallet from "stellar-hd-wallet";
import { create } from "zustand";

/**
 * Parameters for signUp function
 *
 * @interface SignUpParams
 * @property {string} mnemonicPhrase - The mnemonic phrase for the wallet
 * @property {string} password - User's password for encrypting the wallet
 */
interface SignUpParams {
  mnemonicPhrase: string;
  password: string;
}

/**
 * Parameters for login function
 *
 * @interface SignInParams
 * @property {string} password - User's password for authentication
 */
interface SignInParams {
  password: string;
}

/**
 * Parameters for importWallet function
 *
 * @interface ImportWalletParams
 * @property {string} mnemonicPhrase - The mnemonic phrase to import
 * @property {string} password - User's password for encrypting the imported wallet
 */
interface ImportWalletParams {
  mnemonicPhrase: string;
  password: string;
}

/**
 * Parameters for storeAccount function
 *
 * @interface StoreAccountParams
 * @property {string} mnemonicPhrase - The mnemonic phrase for the wallet
 * @property {string} password - User's password for encrypting the wallet
 * @property {KeyPair} keyPair - The public and private key pair
 * @property {boolean} [imported] - Whether the wallet was imported (optional)
 */
interface StoreAccountParams {
  mnemonicPhrase: string;
  password: string;
  keyPair: KeyPair;
  imported?: boolean;
}

/**
 * Active account information
 *
 * Contains the active account's public and private keys, name, and ID
 *
 * @interface ActiveAccount
 * @property {string} publicKey - The account's public key
 * @property {string} privateKey - The account's private key
 * @property {string} accountName - The account's display name
 * @property {string} id - The account's unique identifier
 */
interface ActiveAccount {
  publicKey: string;
  privateKey: string;
  accountName: string;
  id: string;
}

/**
 * Authentication State Interface
 *
 * Defines the structure of the authentication state store using Zustand.
 * This store manages user authentication status, active account information,
 * and navigation state.
 *
 * @interface AuthState
 * @property {NETWORKS | null} network - The current blockchain network
 * @property {boolean} isLoading - Indicates if auth-related operations are in progress
 * @property {string | null} error - Error message if auth operation failed, null otherwise
 * @property {AuthStatus} authStatus - Current authentication status (NOT_AUTHENTICATED, HASH_KEY_EXPIRED, AUTHENTICATED)
 * @property {ActiveAccount | null} account - Currently active account information
 * @property {boolean} isLoadingAccount - Indicates if account data is being loaded
 * @property {string | null} accountError - Error message if account operations failed, null otherwise
 * @property {NavigationContainerRef<RootStackParamList> | null} navigationRef - Reference to the navigation container
 */
interface AuthState {
  network: NETWORKS;
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
 * Authentication Actions Interface
 *
 * Defines the actions available in the authentication store.
 * These actions allow users to sign up, sign in, log out, import wallets,
 * and manage their active account.
 *
 * @interface AuthActions
 * @property {Function} logout - Logs out the user and clears stored data (both sensitive and non-sensitive)
 * @property {Function} signUp - Signs up a new user with the provided credentials
 * @property {Function} signIn - Signs in a user with the provided password
 * @property {Function} importWallet - Imports a wallet with the provided seed phrase and password
 * @property {Function} getAuthStatus - Gets the current authentication status
 * @property {Function} fetchActiveAccount - Fetches the currently active account
 * @property {Function} refreshActiveAccount - Refreshes the active account data
 * @property {Function} setNavigationRef - Sets the navigation reference for navigation actions
 * @property {Function} navigateToLockScreen - Navigates to the lock screen
 * @property {Function} wipeAllDataForDebug - Wipes all user data (for debugging purposes)
 */
interface AuthActions {
  logout: (isForgotPassword?: boolean) => void;
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

/**
 * Authentication Store Type
 *
 * Combines the authentication state and actions into a single type
 * for the Zustand store.
 *
 * @type {AuthState & AuthActions}
 */
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
 *
 * @returns {Promise<boolean>} True if at least one account exists, false otherwise
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
 * Checks if a hash key is expired
 */
const isHashKeyExpired = (hashKey: HashKey): boolean =>
  Date.now() > hashKey.expiresAt;

/**
 * Validates the authentication status of the user
 *
 * Checks if accounts exist, if hash key is valid, and if temporary store exists
 * to determine the current authentication status.
 *
 * @returns {Promise<AuthStatus>} The current authentication status
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
 *
 * @param {HashKey} hashKey - The hash key object containing the key and salt
 * @param {string} temporaryStore - The encrypted temporary store data
 * @returns {Promise<TemporaryStore | null>} The decrypted temporary store or null if decryption failed
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
 *
 * Gets the hash key, retrieves the encrypted temporary store,
 * and decrypts it to access sensitive data.
 *
 * @returns {Promise<TemporaryStore | null>} The decrypted temporary store or null if retrieval failed
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
 * Gets the public key of the active account
 *
 * Used on lock screen to display the public key without requiring authentication.
 *
 * @returns {Promise<string | null>} The active account's public key or null if not found
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
 *
 * @param {Account} account - The account to add to the list
 * @returns {Promise<void>}
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
 *
 * Creates a hash key from the password using a random salt, sets an expiration
 * timestamp, and stores it securely. This key is used to encrypt/decrypt
 * the temporary store.
 *
 * @param {string} password - The user's password to derive the hash key from
 * @returns {Promise<HashKey>} The generated hash key object with salt and expiration
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
 *
 * Generates a new hash key, creates a temporary store with sensitive data,
 * encrypts it, and stores it securely.
 *
 * @param {string} password - The user's password for encryption
 * @param {string} mnemonicPhrase - The mnemonic phrase to store
 * @param {Object} activeKeyPair - The active key pair with account info
 * @returns {Promise<void>}
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

/**
 * Stores a new account in key manager and creates a temporary store
 *
 * @param {StoreAccountParams} params - The account parameters to store
 * @returns {Promise<void>}
 */
const storeAccount = async ({
  mnemonicPhrase,
  password,
  keyPair,
}: StoreAccountParams): Promise<void> => {
  const { publicKey, privateKey } = keyPair;

  // Store the key using the key manager
  const keyMetadata = {
    key: {
      extra: { mnemonicPhrase },
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
 *
 * @returns {Promise<void>}
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
 * Derives a key pair from a mnemonic phrase
 *
 * @param {string} mnemonicPhrase - The mnemonic phrase to derive the key pair from
 * @returns {Promise<KeyPair>} The derived key pair
 */
const deriveKeyPair = (mnemonicPhrase: string) => {
  const wallet = StellarHDWallet.fromMnemonic(mnemonicPhrase);
  const keyDerivationNumber = 0;

  return {
    publicKey: wallet.getPublicKey(keyDerivationNumber),
    privateKey: wallet.getSecret(keyDerivationNumber),
  };
};

/**
 * Signs up a new user with the provided credentials
 *
 * Creates a new wallet from the mnemonic phrase, generates a key pair,
 * and stores the account in the key manager and temporary store.
 *
 * @param {SignUpParams} params - The signup parameters
 * @returns {Promise<void>}
 */
const signUp = async ({
  mnemonicPhrase,
  password,
}: SignUpParams): Promise<void> => {
  try {
    const keyPair = deriveKeyPair(mnemonicPhrase);

    // Store the account in the key manager and create the temporary store
    await storeAccount({
      mnemonicPhrase,
      password,
      keyPair,
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
 *
 * Validates the password against the stored key, loads the account data,
 * and creates a new temporary store with the sensitive information.
 *
 * @param {SignInParams} params - The signin parameters
 * @returns {Promise<void>}
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
 *
 * Generates a key pair from the mnemonic, removes any existing accounts,
 * and stores the new account.
 *
 * @param {ImportWalletParams} params - The wallet import parameters
 * @returns {Promise<void>}
 */
const importWallet = async ({
  mnemonicPhrase,
  password,
}: ImportWalletParams): Promise<void> => {
  try {
    const keyPair = deriveKeyPair(mnemonicPhrase);

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
 *
 * Retrieves the active account ID, loads account information from storage,
 * and gets the private key from the temporary store.
 *
 * @returns {Promise<ActiveAccount | null>} The active account data or null if not found
 * @throws {Error} If the active account cannot be retrieved
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
 *
 * A Zustand store that manages user authentication state and operations.
 * This store provides actions for user signup, signin, logout, wallet importing,
 * and active account management.
 *
 * It maintains the authentication status and securely handles sensitive data
 * like private keys and mnemonic phrases through a temporary encrypted store.
 */
export const useAuthenticationStore = create<AuthStore>()((set, get) => ({
  ...initialState,

  /**
   * Logs out the user by clearing sensitive data
   *
   * For accounts with existing accounts, it preserves account data but clears sensitive info,
   * setting the auth status to HASH_KEY_EXPIRED and navigating to the lock screen.
   * For new users with no accounts, it performs a full logout.
   */
  logout: (isForgotPassword = false) => {
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
          // If it's a forgot password logout, remove the account list and active account id.
          // This will redirect to the welcome screen where the user can create a new account or restore from seed phrase
          if (hasAccount && !isForgotPassword) {
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

  /**
   * Signs up a new user with the provided credentials
   *
   * @param {SignUpParams} params - The signup parameters
   */
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

  /**
   * Signs in a user with the provided password
   *
   * @param {SignInParams} params - The signin parameters
   * @returns {Promise<void>}
   */
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

  /**
   * Imports a wallet with the provided credentials
   *
   * @param {ImportWalletParams} params - The wallet import parameters
   */
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

  /**
   * Gets the current authentication status
   *
   * @returns {Promise<AuthStatus>} The current authentication status
   */
  getAuthStatus: async () => {
    const authStatus = await getAuthStatus();
    set({ authStatus });

    // If the hash key is expired, navigate to lock screen
    if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
      get().navigateToLockScreen();
    }

    return authStatus;
  },

  /**
   * Navigates to the lock screen
   *
   * Used when authentication expires or user needs to re-authenticate
   */
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

  /**
   * Fetches the active account data
   *
   * Checks auth status first and redirects to lock screen if hash key is expired
   *
   * @returns {Promise<ActiveAccount | null>} The active account or null if not found
   */
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

  /**
   * Refreshes the active account data
   *
   * @returns {Promise<ActiveAccount | null>} The active account or null if not found
   */
  refreshActiveAccount: () => get().fetchActiveAccount(),

  /**
   * Sets the navigation reference for navigation actions
   *
   * @param {NavigationContainerRef<RootStackParamList>} ref - The navigation reference
   */
  setNavigationRef: (ref) => {
    set({ navigationRef: ref });
  },

  /**
   * Wipes all user data for debugging purposes
   *
   * Removes all keys from key manager, clears all stored data,
   * and resets the store state to initial. This is debug only.
   *
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  wipeAllDataForDebug: async () => {
    if (!__DEV__) {
      return false;
    }

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

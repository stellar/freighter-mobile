import { NavigationContainerRef } from "@react-navigation/native";
import { encode as base64Encode } from "@stablelib/base64";
import { Keypair, Networks } from "@stellar/stellar-sdk";
import {
  Key,
  KeyType,
  ScryptEncrypter,
} from "@stellar/typescript-wallet-sdk-km";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  ACCOUNTS_TO_VERIFY_ON_EXISTING_MNEMONIC_PHRASE,
  BIOMETRIC_STORAGE_KEYS,
  FACE_ID_BIOMETRY_TYPES,
  FINGERPRINT_BIOMETRY_TYPES,
  getHashKeyExpirationMs,
  LoginType,
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
import { useBalancesStore } from "ducks/balances";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { useCollectiblesStore } from "ducks/collectibles";
import { useHistoryStore } from "ducks/history";
import { usePreferencesStore } from "ducks/preferences";
import { usePricesStore } from "ducks/prices";
import { useWalletKitStore } from "ducks/walletKit";
import { clearAllWebViewData } from "helpers/browser";
import {
  deriveKeyFromPassword,
  encryptDataWithPassword,
  generateSalt,
  decryptDataWithPassword,
} from "helpers/encryptPassword";
import { createKeyManager } from "helpers/keyManager/keyManager";
import { clearWalletKitStorage } from "helpers/walletKitUtil";
import { t } from "i18next";
import ReactNativeBiometrics from "react-native-biometrics";
import * as Keychain from "react-native-keychain";
import { analytics } from "services/analytics";
import { getAccount } from "services/stellar";
import {
  clearNonSensitiveData,
  clearTemporaryData,
  getHashKey,
} from "services/storage/helpers";
import {
  biometricDataStorage,
  dataStorage,
  secureDataStorage,
} from "services/storage/storageFactory";
import StellarHDWallet from "stellar-hd-wallet";
import { create } from "zustand";

/**
 * Helper function to determine the biometric login type based on biometry type
 *
 * This function maps the device's supported biometry type to the corresponding
 * LoginType enum value. It handles Face ID, Touch ID, fingerprint, and other
 * biometric authentication methods supported by the device.
 *
 * @param {Keychain.BIOMETRY_TYPE | null} biometryType - The biometry type supported by the device
 * @returns {LoginType} The corresponding login type (FACE, FINGERPRINT, or PASSWORD)
 *
 * @example
 * const loginType = getLoginType(Keychain.BIOMETRY_TYPE.FACE_ID);
 * // Returns LoginType.FACE
 *
 * @example
 * const loginType = getLoginType(Keychain.BIOMETRY_TYPE.FINGERPRINT);
 * // Returns LoginType.FINGERPRINT
 *
 * @example
 * const loginType = getLoginType(null);
 * // Returns LoginType.PASSWORD
 */
export const getLoginType = (
  biometryType: Keychain.BIOMETRY_TYPE | null,
): LoginType => {
  if (!biometryType) {
    return LoginType.PASSWORD;
  }
  if (FACE_ID_BIOMETRY_TYPES.includes(biometryType)) {
    return LoginType.FACE;
  }
  if (FINGERPRINT_BIOMETRY_TYPES.includes(biometryType)) {
    return LoginType.FINGERPRINT;
  }
  return LoginType.PASSWORD;
};

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
 * @property {boolean} [importedFromSecretKey] - Whether the account was imported from an external secret key (optional)
 * @property {boolean} [shouldRefreshHashKey] - Whether to refresh the hash key (optional)
 * @property {boolean} [shouldSetActiveAccount] - Whether to set this account as active (optional)
 * @property {number} [accountNumber] - The account number for derivation (optional)
 */
interface StoreAccountParams {
  mnemonicPhrase: string;
  password: string;
  keyPair: KeyPair;
  importedFromSecretKey?: boolean;
  shouldRefreshHashKey?: boolean;
  shouldSetActiveAccount?: boolean;
  accountNumber?: number;
}

/**
 * Active account information
 *
 * Contains the active account's public and private keys, name, ID, and subentry count
 *
 * @interface ActiveAccount
 * @property {string} publicKey - The account's public key
 * @property {string} privateKey - The account's private key
 * @property {string} accountName - The account's display name
 * @property {string} id - The account's unique identifier
 * @property {number} subentryCount - The number of subentries (trustlines, offers, data entries)
 */
export interface ActiveAccount {
  publicKey: string;
  privateKey: string;
  accountName: string;
  id: string;
  subentryCount: number;
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
  isCreatingAccount: boolean;
  isRenamingAccount: boolean;
  isLoadingAllAccounts: boolean;
  isSwitchingAccount: boolean;
  error: string | null;
  authStatus: AuthStatus;
  allAccounts: Account[];

  // Active account state
  account: ActiveAccount | null;
  isLoadingAccount: boolean;
  accountError: string | null;
  navigationRef: NavigationContainerRef<RootStackParamList> | null;

  // Biometric authentication state
  signInMethod: LoginType;
  hasTriggeredAppOpenBiometricsLogin: boolean;
}

/**
 * Parameters for renameAccount function
 *
 * @interface RenameAccountParams
 * @property {string} accountName - The new name for the account
 * @property {string} publicKey - The public key of the account to rename
 */
interface RenameAccountParams {
  accountName: string;
  publicKey: string;
}

/**
 * Parameters for deriveKeypair function
 *
 * @interface DeriveKeypairParams
 * @property {string} mnemonicPhrase - The mnemonic phrase for the wallet
 * @property {number} [index] - The index of the keypair to derive
 */
interface DeriveKeypairParams {
  mnemonicPhrase: string;
  index?: number;
}

/**
 * Parameters for importSecretKey function
 *
 * @interface ImportSecretKeyParams
 * @property {string} secretKey - The secret key to import
 * @property {string} password - User's password for encrypting the imported secret key
 */
interface ImportSecretKeyParams {
  secretKey: string;
  password: string;
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
 * @property {Function} importSecretKey - Imports a secret key and adds it to the accounts list
 * @property {Function} getAuthStatus - Gets the current authentication status
 * @property {Function} fetchActiveAccount - Fetches the currently active account
 * @property {Function} refreshActiveAccount - Refreshes the active account data
 * @property {Function} setNavigationRef - Sets the navigation reference for navigation actions
 * @property {Function} navigateToLockScreen - Navigates to the lock screen
 * @property {Function} createAccount - Creates a new account
 * @property {Function} getKeyFromKeyManager - Gets the key from the key manager
 * @property {Function} devResetAppAuth - Resets the app auth state to the initial state
 */
interface AuthActions {
  logout: (shouldWipeAllData?: boolean) => void;
  signUp: (params: SignUpParams) => Promise<void>;
  signIn: (params: SignInParams) => Promise<void>;
  importWallet: (params: ImportWalletParams) => Promise<boolean>;
  verifyMnemonicPhrase: (mnemonicPhrase: string) => boolean;
  importSecretKey: (params: ImportSecretKeyParams) => Promise<void>;
  getAuthStatus: () => Promise<AuthStatus>;
  renameAccount: (params: RenameAccountParams) => Promise<void>;
  getAllAccounts: () => Promise<void>;
  createAccount: (password: string) => Promise<void>;
  selectAccount: (publicKey: string) => Promise<void>;
  selectNetwork: (network: NETWORKS) => Promise<void>;

  enableBiometrics: <T>(
    callback: (biometricPassword?: string) => Promise<T>,
  ) => Promise<T>;
  verifyActionWithBiometrics: <T, P extends unknown[]>(
    callback: (password?: string, ...args: P) => Promise<T>,
    ...args: P
  ) => Promise<T>;
  // Active account actions
  fetchActiveAccount: () => Promise<ActiveAccount | null>;
  refreshActiveAccount: () => Promise<ActiveAccount | null>;
  setNavigationRef: (ref: NavigationContainerRef<RootStackParamList>) => void;
  navigateToLockScreen: () => void;
  verifyBiometrics: () => Promise<boolean>;
  storeBiometricPassword: (password: string) => Promise<void>;
  initBiometricPassword: () => Promise<boolean>;
  getKeyFromKeyManager: (
    password: string,
    activeAccountId?: string | null,
  ) => Promise<Key>;

  clearError: () => void;
  devResetAppAuth: () => void;
  setAuthStatus: (authStatus: AuthStatus) => void;

  // Biometric authentication actions
  setSignInMethod: (method: LoginType) => void;
  setHasTriggeredAppOpenBiometricsLogin: (hasTriggered: boolean) => void;
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

// Initial state. We omit the network because we don't want to override its state
// whenever the ...initialState is used.
const initialState: Omit<AuthState, "network"> = {
  isLoading: false,
  isCreatingAccount: false,
  isRenamingAccount: false,
  isLoadingAllAccounts: false,
  isSwitchingAccount: false,
  error: null,
  authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
  allAccounts: [],
  // Active account initial state
  account: null,
  isLoadingAccount: false,
  accountError: null,
  navigationRef: null,
  // Biometric authentication initial state
  signInMethod: LoginType.PASSWORD,
  hasTriggeredAppOpenBiometricsLogin: false,
};

/**
 * Initialize the store by loading the active network from storage
 */
const initializeStore = async (
  setState: (state: Partial<AuthState>) => void,
) => {
  try {
    const activeNetwork = await dataStorage.getItem(
      STORAGE_KEYS.ACTIVE_NETWORK,
    );

    if (activeNetwork) {
      setState({ network: activeNetwork as NETWORKS });
    }
  } catch (error) {
    logger.error("initializeStore", "Failed to initialize store", error);
  }
};

/**
 * Key manager instance for handling cryptographic operations
 * We're using mainnet as the default, but the same key manager can be used for testnet as well
 */
const keyManager = createKeyManager(Networks.PUBLIC);

/**
 * Checks if a hash key is expired
 */
const isHashKeyExpired = (hashKey: HashKey): boolean =>
  Date.now() > hashKey.expiresAt;

/**
 * Gets all accounts from the account list
 *
 * @returns {Promise<Account[]>} The list of accounts
 */
const getAllAccounts = async (): Promise<Account[]> => {
  const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);
  if (!accountListRaw) {
    return [];
  }

  return JSON.parse(accountListRaw) as Account[];
};

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
    const hasAccount = (await getAllAccounts()).length > 0;

    const [hashKey, temporaryStore] = await Promise.all([
      getHashKey(),
      secureDataStorage.getItem(SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE),
    ]);

    // If there are no accounts at all, always return NOT_AUTHENTICATED
    if (!hasAccount) {
      return AUTH_STATUS.NOT_AUTHENTICATED;
    }

    // If we have accounts but no hash key AND no temp store, return HASH_KEY_EXPIRED
    // This happens after logout but with accounts still in the system
    if (hasAccount && !hashKey && !temporaryStore) {
      return AUTH_STATUS.HASH_KEY_EXPIRED;
    }

    // Check if hash key is expired
    if (hashKey && isHashKeyExpired(hashKey)) {
      return AUTH_STATUS.HASH_KEY_EXPIRED;
    }

    // Read from SECURE storage (encrypted) to prevent tampering
    // Security validation: Only honor LOCKED status if BOTH:
    // 1. Temporary store exists (contains encrypted data)
    // 2. Hash key exists and hasn't expired
    // This prevents an attacker from setting persisted auth status to LOCKED
    // to bypass security checks
    const persistedAuthStatus = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
    );
    if (persistedAuthStatus === AUTH_STATUS.LOCKED) {
      // Validate that both temporary store and valid hash key exist
      if (temporaryStore && hashKey && !isHashKeyExpired(hashKey)) {
        return AUTH_STATUS.LOCKED;
      }

      // Clear invalid persisted LOCKED status
      await secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.AUTH_STATUS);
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

// Track repeated failures for monitoring
let getTemporaryStoreFailureCount = 0;
let lastFailureTimestamp = 0;
const FAILURE_RESET_WINDOW_MS = 60000; // 1 minute window
const SUSPICIOUS_FAILURE_THRESHOLD = 3; // Log warning after 3 failures

/**
 * Retrieves data from the temporary store
 *
 * Gets the hash key, retrieves the encrypted temporary store,
 * and decrypts it to access the data.
 *
 * @param {AuthStatus} authStatus - Current auth status to validate before decryption
 * @returns {Promise<TemporaryStore | null>} The decrypted temporary store or null if retrieval failed
 */
const getTemporaryStore = async (
  authStatus: AuthStatus,
): Promise<TemporaryStore | null> => {
  try {
    // Security check: Only allow decryption if user can actually access the data
    // Allow access if:
    // 1. Authenticated (normal case)
    // 2. LOCKED (preserved session that can be unlocked)
    // Deny access if:
    // 1. HASH_KEY_EXPIRED (session expired, needs re-auth)
    // 2. NOT_AUTHENTICATED (no accounts)
    if (
      authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
      authStatus === AUTH_STATUS.NOT_AUTHENTICATED
    ) {
      logger.warn(
        "[getTemporaryStore]",
        "Security violation attempt",
        `Attempted to access temporary store in ${authStatus} state`,
      );
      return null;
    }

    const hashKey = await getHashKey();

    if (!hashKey) {
      logger.error(
        "[getTemporaryStore]",
        "Hash key not found - user must sign in",
        undefined,
      );

      return null;
    }

    if (isHashKeyExpired(hashKey)) {
      logger.error(
        "[getTemporaryStore]",
        "Hash key has expired, access denied",
        undefined,
      );

      return null;
    }
    const temporaryStore = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    );
    if (!temporaryStore) {
      logger.error(
        "[getTemporaryStore]",
        "Temporary store data not found",
        undefined,
      );

      return null;
    }

    let decryptedTemporaryStore: TemporaryStore | null = null;

    try {
      decryptedTemporaryStore = await decryptTemporaryStore(
        hashKey,
        temporaryStore,
      );
    } catch (error) {
      // Error will be handled in the failure tracking below
    }

    if (
      decryptedTemporaryStore &&
      decryptedTemporaryStore.privateKeys &&
      decryptedTemporaryStore.mnemonicPhrase
    ) {
      getTemporaryStoreFailureCount = 0;
      return decryptedTemporaryStore;
    }

    const now = Date.now();
    if (now - lastFailureTimestamp > FAILURE_RESET_WINDOW_MS) {
      getTemporaryStoreFailureCount = 0;
    }
    getTemporaryStoreFailureCount++;
    lastFailureTimestamp = now;

    if (getTemporaryStoreFailureCount >= SUSPICIOUS_FAILURE_THRESHOLD) {
      logger.error(
        "[getTemporaryStore]",
        "Repeated failures detected",
        `Multiple unauthorized access attempts (${getTemporaryStoreFailureCount}) within ${FAILURE_RESET_WINDOW_MS}ms`,
      );
    }
    await clearTemporaryData();

    return null;
  } catch (error) {
    logger.error("[getTemporaryStore]", "Failed to get temporary store", error);
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

  if (accountList.find((a) => a.id === account.id)) {
    return;
  }

  await dataStorage.setItem(
    STORAGE_KEYS.ACCOUNT_LIST,
    JSON.stringify([...accountList, account]),
  );
};

/**
 * Adds multiple accounts to the account list
 *
 * @param {Account[]} accounts - The accounts to add to the list
 * @returns {Promise<void>}
 */
export const appendAccounts = async (accounts: Account[]) => {
  if (accounts.length === 0) {
    return;
  }

  const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);
  const accountList = accountListRaw
    ? (JSON.parse(accountListRaw) as Account[])
    : [];

  const knownAccountIds = new Set(accountList.map((item) => item.id));
  const accountsToAdd: Account[] = [];

  accounts.forEach((account) => {
    if (knownAccountIds.has(account.id)) {
      return;
    }

    knownAccountIds.add(account.id);
    accountsToAdd.push(account);
  });

  if (accountsToAdd.length === 0) {
    return;
  }

  await dataStorage.setItem(
    STORAGE_KEYS.ACCOUNT_LIST,
    JSON.stringify([...accountList, ...accountsToAdd]),
  );
};

/**
 * Re-encrypts the temporary store with a new hash key
 *
 * Used when unlocking from LOCKED state to ensure the password is required
 * to decrypt the temporary store, not just the old hash key.
 *
 * @param {HashKey} newHashKey - The new hash key to encrypt with
 * @returns {Promise<void>}
 * @throws {Error} If re-encryption fails
 */
const reEncryptTemporaryStore = async (newHashKey: HashKey): Promise<void> => {
  try {
    // Get old hash key
    const oldHashKey = await getHashKey();
    if (!oldHashKey) {
      logger.warn(
        "[reEncryptTemporaryStore]",
        "No old hash key found, skipping re-encryption",
      );
      return;
    }

    // Get encrypted temporary store
    const encryptedTempStore = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    );

    if (!encryptedTempStore) {
      logger.warn(
        "[reEncryptTemporaryStore]",
        "No temporary store found, skipping re-encryption",
      );
      return;
    }

    // Decrypt with old hash key
    const decryptedData = await decryptDataWithPassword({
      data: encryptedTempStore,
      password: oldHashKey.hashKey,
      salt: oldHashKey.salt,
    });

    if (!decryptedData) {
      throw new Error(t("authStore.error.failedToDecryptData"));
    }

    // Re-encrypt with new hash key
    const { encryptedData } = await encryptDataWithPassword({
      data: decryptedData,
      password: newHashKey.hashKey,
      salt: newHashKey.salt,
    });

    // Store re-encrypted temporary store
    await secureDataStorage.setItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
      encryptedData,
    );

    logger.info(
      "[reEncryptTemporaryStore]",
      "Successfully re-encrypted temporary store with new hash key",
    );
  } catch (error) {
    logger.error(
      "[reEncryptTemporaryStore]",
      "Failed to re-encrypt temporary store",
      error,
    );
    // If re-encryption fails, clear temporary data and force full login
    await clearTemporaryData();
    throw new Error(t("authStore.error.failedToReEncryptData"));
  }
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
    const expirationTime = Date.now() + getHashKeyExpirationMs();

    // Return the hash key object (caller will store it)
    return {
      hashKey,
      salt,
      expiresAt: expirationTime,
    };
  } catch (error) {
    throw new Error(`Failed to generate hash key: ${String(error)}`);
  }
};

/**
 * Creates and encrypts the temporary store using the hash key
 *
 * Generates a new hash key, creates a temporary store with sensitive data,
 * encrypts it, and stores it securely.
 *
 * @param {Object} input - The input parameters
 * @param {string} input.password - The user's password for encryption
 * @param {string} input.mnemonicPhrase - The mnemonic phrase to store
 * @param {Object} input.activeKeyPair - The active key pair with account info
 * @param {boolean} input.shouldRefreshHashKey - Whether to refresh the hash key
 * @returns {Promise<void>}
 */
const createTemporaryStore = async (input: {
  password: string;
  mnemonicPhrase: string;
  activeKeyPair: KeyPair & { accountName: string; id: string };
  shouldRefreshHashKey?: boolean;
}): Promise<void> => {
  const {
    password,
    mnemonicPhrase,
    activeKeyPair,
    shouldRefreshHashKey = true,
  } = input;

  try {
    let hashKeyObj: HashKey;
    let temporaryStore: TemporaryStore | null = null;

    if (shouldRefreshHashKey) {
      hashKeyObj = await generateHashKey(password);
      // Persist the new hash key for future decryptions
      await secureDataStorage.setItem(
        SENSITIVE_STORAGE_KEYS.HASH_KEY,
        JSON.stringify(hashKeyObj),
      );
    } else {
      const retrievedHashKey = await getHashKey();

      if (!retrievedHashKey) {
        throw new Error("Failed to retrieve hash key");
      }

      temporaryStore = await getTemporaryStore(AUTH_STATUS.LOCKED);
      hashKeyObj = retrievedHashKey;
    }

    // Create the temporary store object
    const temporaryStoreObj = {
      ...temporaryStore,
      privateKeys: {
        ...temporaryStore?.privateKeys,
        [activeKeyPair.id]: activeKeyPair.privateKey,
      },
      mnemonicPhrase,
    } as TemporaryStore;

    // Convert the store to a JSON string
    const temporaryStoreJson = JSON.stringify(temporaryStoreObj);

    // Encrypt the temporary store with the hash key
    const { encryptedData } = await encryptDataWithPassword({
      data: temporaryStoreJson,
      password: hashKeyObj.hashKey,
      salt: hashKeyObj.salt,
    });

    // Store the encrypted data
    await secureDataStorage.setItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
      encryptedData,
    );
  } catch (error) {
    throw new Error(`Failed to create temporary store: ${String(error)}`);
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
  accountNumber,
  shouldRefreshHashKey = true,
  shouldSetActiveAccount = true,
  importedFromSecretKey = false,
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
    number: accountNumber ?? accountList.length + 1,
  });

  await Promise.all([
    shouldSetActiveAccount
      ? dataStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID, keyStore.id)
      : Promise.resolve(),
    appendAccount({
      id: keyStore.id,
      name: accountName,
      publicKey,
      importedFromSecretKey,
    }),
    createTemporaryStore({
      password,
      mnemonicPhrase,
      activeKeyPair: {
        publicKey,
        privateKey,
        accountName,
        id: keyStore.id,
      },
      shouldRefreshHashKey,
    }),
    biometricDataStorage.setItem(
      BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
      password,
    ),
  ]);
};

/**
 * Derives a key pair from a mnemonic phrase
 *
 * @param {string} mnemonicPhrase - The mnemonic phrase to derive the key pair from
 * @returns {Promise<KeyPair>} The derived key pair
 */
const deriveKeyPair = (params: DeriveKeypairParams) => {
  const { mnemonicPhrase, index = 0 } = params;
  const wallet = StellarHDWallet.fromMnemonic(mnemonicPhrase);

  return {
    publicKey: wallet.getPublicKey(index),
    privateKey: wallet.getSecret(index),
  };
};

/**
 * Clears all data from the key manager, temporary store (sensitive),
 * and non-sensitive data
 *
 * @returns {Promise<void>}
 */
const clearAllData = async (): Promise<void> => {
  const allKeys = await keyManager.loadAllKeyIds();

  await Promise.all([
    ...allKeys.map((key) => keyManager.removeKey(key)),
    clearTemporaryData(),
    clearNonSensitiveData(),
    dataStorage.remove(STORAGE_KEYS.COLLECTIBLES_LIST),
  ]);
};

const getKeyFromKeyManager = async (
  password: string,
  activeAccountId?: string | null,
): Promise<Key> => {
  let accountId = activeAccountId;

  if (!accountId) {
    const allKeys = await keyManager.loadAllKeyIds();
    [accountId] = allKeys;
  }

  if (!accountId) {
    throw new Error(t("authStore.error.noKeyPairFound"));
  }

  const result = await keyManager.loadKey(accountId, password).catch(() => {
    throw new Error(t("authStore.error.invalidPassword"));
  });

  return result;
};

/**
 * Derive keypairs from the mnemonic phrase and verify if they exist on the network.
 * If they do, create accounts for them.
 *
 * @param {string} mnemonicPhrase - The mnemonic phrase to verify
 * @param {string} password - The password for encryption
 * @returns {Promise<void>}
 */
const verifyAndCreateExistingAccountsOnNetwork = async (
  mnemonicPhrase: string,
  password: string,
  authStatus: AuthStatus,
): Promise<void> => {
  // Check what accounts we already have locally before hitting the network
  const temporaryStore = await getTemporaryStore(authStatus);
  const existingAccounts = await getAllAccounts();

  // Get public keys from temporary store
  const existingAccountsOnDataStorageSecretKeys = Object.values(
    temporaryStore?.privateKeys ?? {},
  );

  const existingAccountsOnTempStorePublicKeys =
    existingAccountsOnDataStorageSecretKeys.map((secretKey) =>
      Keypair.fromSecret(secretKey).publicKey(),
    );

  // Get public keys from account list
  const existingAccountsOnAccountListPublicKeys = existingAccounts.map(
    (account) => account.publicKey,
  );

  const uniqueExistingPublicKeys = new Set([
    ...existingAccountsOnTempStorePublicKeys,
    ...existingAccountsOnAccountListPublicKeys,
  ]);

  // Derive keypairs from mnemonic
  const wallet = StellarHDWallet.fromMnemonic(mnemonicPhrase);
  const keyPairs = Array.from(
    { length: ACCOUNTS_TO_VERIFY_ON_EXISTING_MNEMONIC_PHRASE },
    (_, i) => ({
      publicKey: wallet.getPublicKey(i),
      privateKey: wallet.getSecret(i),
    }),
  );

  // Only verify accounts we don't already have stored locally
  const accountsToVerify = keyPairs.filter(
    (keyPair) => !uniqueExistingPublicKeys.has(keyPair.publicKey),
  );

  // Early exit if all accounts are already loaded
  if (accountsToVerify.length === 0) {
    return;
  }

  // Only make network calls for accounts we don't have locally
  const promises = accountsToVerify.map((keyPair) =>
    getAccount(keyPair.publicKey, NETWORKS.PUBLIC),
  );

  const result = await Promise.all(promises);

  const existingAccountsOnNetwork = result.filter(
    (account) => account !== null,
  );

  const existingAccountsOnNetworkPublicKeys = existingAccountsOnNetwork.map(
    (account) => account.accountId(),
  );

  // Only create keypairs that exist on network but not locally
  const newKeyPairs = accountsToVerify.filter((keyPair) =>
    existingAccountsOnNetworkPublicKeys.includes(keyPair.publicKey),
  );

  if (newKeyPairs.length === 0) {
    // No new accounts to add
    return;
  }

  // First store all accounts in the account list
  const prepareKeyStorePromises = newKeyPairs.map((keyPair, index) => {
    const accountNumber = existingAccounts.length + index + 1;

    // Store the key using the key manager
    const keyMetadata = {
      key: {
        extra: { mnemonicPhrase },
        type: KeyType.plaintextKey,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
      },
      password,
      encrypterName: ScryptEncrypter.name,
    };

    return keyManager.storeKey(keyMetadata).then((keyStore) => {
      const accountName = t("authStore.account", { number: accountNumber });

      const newAccount = {
        id: keyStore.id,
        name: accountName,
        publicKey: keyPair.publicKey,
        importedFromSecretKey: false,
      };

      return {
        account: newAccount,
        privateKey: keyPair.privateKey,
        id: keyStore.id,
      };
    });
  });

  // Wait for all key stores to be created
  const newAccounts = await Promise.all(prepareKeyStorePromises);

  // Add all accounts to the account list
  await appendAccounts(newAccounts.map(({ account }) => account));

  // Now update the temporary store with all new private keys at once
  const hashKey = await getHashKey();

  if (!hashKey) {
    throw new Error("Failed to retrieve hash key");
  }

  // Get the latest temporary store
  const latestTemporaryStore = await getTemporaryStore(
    AUTH_STATUS.AUTHENTICATED,
  );

  if (!latestTemporaryStore) {
    throw new Error("Failed to retrieve temporary store");
  }

  // Update the temporary store with all new private keys
  const updatedPrivateKeys = { ...latestTemporaryStore.privateKeys };

  // Add all new private keys to the temporary store
  newAccounts.forEach(({ id, privateKey }) => {
    updatedPrivateKeys[id] = privateKey;
  });

  // Create the updated temporary store object
  const updatedTemporaryStore = {
    ...latestTemporaryStore,
    privateKeys: updatedPrivateKeys,
    mnemonicPhrase,
  };

  // Convert to JSON and encrypt
  const temporaryStoreJson = JSON.stringify(updatedTemporaryStore);
  const { encryptedData } = await encryptDataWithPassword({
    data: temporaryStoreJson,
    password: hashKey.hashKey,
    salt: hashKey.salt,
  });

  await secureDataStorage.setItem(
    SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    encryptedData,
  );
};

/**
 * Clears account-specific data when switching between accounts.
 *
 * This prevents showing stale data (balances, history, prices) from the previous
 * account while the new account data is being loaded.
 *
 * This function intentionally uses direct `setState` calls on the relevant stores
 * instead of going through individual store actions. The goal is to perform a
 * synchronous, centralized reset of all account-bound state so that:
 *
 * - No stale balances, history, or prices are rendered for the previously active
 *   account after an account switch is initiated.
 * - Loading and error flags are reset in a single place before triggering any
 *   new network requests for the newly selected account.
 *
 * Ordering and side effects:
 *
 * - This function should be called immediately after changing the active account
 *   (e.g., via {@link selectAccount}) and before starting any new data loads
 *   (balances, history, prices) for that account.
 * - Because it directly clears multiple stores at once, it avoids intermediate
 *   states where some stores have been reset and others have not, which could
 *   otherwise lead to inconsistent UI.
 * - It resets `isLoading`/`isFetching` flags to `false` and clears any previous
 *   `error` values, so callers must ensure that subsequent fetch logic correctly
 *   updates these flags for the newly active account.
 */
export function clearAccountData(): void {
  // Clear balances data
  useBalancesStore.setState({
    balances: {},
    pricedBalances: {},
    scanResults: {},
    isLoading: false,
    isFunded: false,
    subentryCount: 0,
    error: null,
  });

  // Clear history data
  useHistoryStore.setState({
    rawHistoryData: null,
    isLoading: false,
    error: null,
    hasRecentTransaction: false,
    isFetching: false,
  });

  // Clear prices data
  usePricesStore.setState({
    prices: {},
    isLoading: false,
    error: null,
    lastUpdated: null,
  });

  // Clear collectibles data
  useCollectiblesStore.setState({
    collections: [],
    isLoading: false,
    error: null,
  });
}

/**
 * Logs in the user with the provided password
 *
 * Validates the password against the stored key, loads the account data,
 * and creates a new temporary store with the sensitive information.
 *
 * @param {SignInParams} params - The signin parameters
 * @returns {Promise<void>}
 */
const signIn = async ({
  password,
  shouldCreateTempStore = true,
}: SignInParams & { shouldCreateTempStore?: boolean }): Promise<void> => {
  const activeAccount = await dataStorage.getItem(
    STORAGE_KEYS.ACTIVE_ACCOUNT_ID,
  );

  const loadedKey = await getKeyFromKeyManager(password, activeAccount);

  const keyExtraData = loadedKey.extra as
    | {
        mnemonicPhrase: string | null;
      }
    | undefined;

  if (!keyExtraData || !keyExtraData?.mnemonicPhrase) {
    // Clear the all the data and throw an error
    await clearAllData();
    throw new Error(t("authStore.error.noKeyPairFound"));
  }

  const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);
  const accountList = JSON.parse(accountListRaw ?? "[]") as Account[];
  let account = accountList.find((a) => a.id === activeAccount);

  if (!account) {
    logger.error("signIn", "Account not found in account list", null);

    account = {
      id: loadedKey.id,
      name: t("authStore.account", { number: accountList.length + 1 }),
      publicKey: loadedKey.publicKey,
    };

    await appendAccount(account);
  }

  // SECURITY: Always regenerate hash key from password
  // This ensures the password is REQUIRED to decrypt the temporary store,
  // not just to prove the user's identity. Without this, an attacker who
  // gains access to the device while LOCKED could extract the hash key
  // and decrypt the temporary store without knowing the password.

  // Handle temporary store based on whether it's a fresh login or unlock
  if (shouldCreateTempStore) {
    // Fresh login: Generate new hash key and create new temporary store
    // Let createTemporaryStore handle hash key generation to avoid duplication
    await createTemporaryStore({
      password,
      mnemonicPhrase: keyExtraData.mnemonicPhrase,
      activeKeyPair: {
        publicKey: loadedKey.publicKey,
        privateKey: loadedKey.privateKey,
        accountName: account.name,
        id: loadedKey.id,
      },
      shouldRefreshHashKey: true,
    });
  } else {
    // LOCKED state unlock: Generate new hash key and re-encrypt existing temporary store
    // IMPORTANT: Generate key first but don't store it yet - reEncryptTemporaryStore
    // needs the OLD hash key to decrypt before we can re-encrypt with the new one
    const newHashKey = await generateHashKey(password);
    await reEncryptTemporaryStore(newHashKey);

    // Now store the new hash key (reEncryptTemporaryStore used it for encryption
    // but retrieved the old key itself via getHashKey() for decryption)
    await secureDataStorage.setItem(
      SENSITIVE_STORAGE_KEYS.HASH_KEY,
      JSON.stringify(newHashKey),
    );
  }

  const existingBiometricPassword = await biometricDataStorage.checkIfExists(
    BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
  );

  if (!existingBiometricPassword) {
    await biometricDataStorage.setItem(
      BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
      password,
    );
  }
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
    const keyPair = deriveKeyPair({ mnemonicPhrase });

    clearAccountData();
    await clearAllData();

    // Store the account in the key manager and create the temporary store
    await storeAccount({
      mnemonicPhrase,
      password,
      keyPair,
    });
  } catch (error) {
    // Clean up any partial data on error
    clearAccountData();
    await clearAllData();

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
    const keyPair = deriveKeyPair({ mnemonicPhrase });

    clearAccountData();
    await clearAllData();

    // Store the account in the key manager and create the temporary store
    await storeAccount({
      mnemonicPhrase,
      password,
      keyPair,
    });

    await verifyAndCreateExistingAccountsOnNetwork(
      mnemonicPhrase,
      password,
      AUTH_STATUS.AUTHENTICATED,
    );

    analytics.track(AnalyticsEvent.ACCOUNT_SCREEN_IMPORT_ACCOUNT);
  } catch (error) {
    analytics.trackAccountScreenImportAccountFail(
      error instanceof Error ? error.message : String(error),
    );
    // Clean up any partial data on error
    clearAccountData();
    await clearAllData();

    throw error;
  }
};

/**
 * Updates the temporary store with a private key for a specific account
 *
 * @param {TemporaryStore} temporaryStore - The current temporary store
 * @param {string} accountId - The account ID to update
 * @param {string} privateKey - The private key to store
 * @param {HashKey} hashKey - The hash key for encryption
 * @returns {Promise<TemporaryStore>} The updated temporary store
 */
const updateTemporaryStoreWithPrivateKey = async (
  temporaryStore: TemporaryStore,
  accountId: string,
  privateKey: string,
  hashKey: HashKey,
): Promise<TemporaryStore> => {
  const updatedPrivateKeys = {
    ...temporaryStore.privateKeys,
    [accountId]: privateKey,
  };

  const updatedTempStore = {
    ...temporaryStore,
    privateKeys: updatedPrivateKeys,
  };

  const tempStoreJson = JSON.stringify(updatedTempStore);
  const { encryptedData } = await encryptDataWithPassword({
    data: tempStoreJson,
    password: hashKey.hashKey,
    salt: hashKey.salt,
  });

  await secureDataStorage.setItem(
    SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    encryptedData,
  );

  return updatedTempStore;
};

/**
 * Attempts to derive a private key from a mnemonic phrase for a given account
 *
 * @param {string} mnemonicPhrase - The mnemonic phrase
 * @param {string} publicKey - The public key to match
 * @returns {string | null} The derived private key or null if not found
 */
const derivePrivateKeyFromMnemonic = (
  mnemonicPhrase: string,
  publicKey: string,
): string | null => {
  const wallet = StellarHDWallet.fromMnemonic(mnemonicPhrase);
  const indicesToTry = Array.from({ length: 50 }, (_, i) => i);
  const matchingIndex = indicesToTry.find(
    (index) => wallet.getPublicKey(index) === publicKey,
  );

  if (matchingIndex !== undefined) {
    return wallet.getSecret(matchingIndex);
  }

  return null;
};

/**
 * Attempts to load a private key from the key manager using biometric authentication
 *
 * @param {string} accountId - The account ID
 * @returns {Promise<string | null>} The private key or null if not found/authenticated
 */
const loadPrivateKeyFromKeyManager = async (
  accountId: string,
): Promise<string | null> => {
  const biometricCredentials = await biometricDataStorage.getItem(
    BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
    {
      title: t("authStore.faceId.signInTitle"),
      cancel: t("common.cancel"),
    },
  );

  if (!biometricCredentials || !biometricCredentials.password) {
    return null;
  }

  const { password } = biometricCredentials;

  try {
    const key = await keyManager.loadKey(accountId, password);
    return key.privateKey || null;
  } catch (e) {
    logger.warn("getActiveAccount", "Failed to load key from key manager", e);
    return null;
  }
};

/**
 * Gets the active account data by combining temporary store sensitive data with account list information
 *
 * Retrieves the active account ID, loads account information from storage,
 * and decrypts the private key on-demand.
 *
 * @returns {Promise<ActiveAccount | null>} The active account data or null if not found
 * @throws {Error} If the active account cannot be retrieved
 */
const getActiveAccount = async (
  authStatus: AuthStatus,
): Promise<ActiveAccount | null> => {
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

  // Security: Explicitly block access in LOCKED state
  // LOCKED state requires password re-entry before accessing sensitive data
  // This provides defense-in-depth even if public methods are bypassed
  if (authStatus === AUTH_STATUS.LOCKED) {
    logger.warn(
      "[getActiveAccount]",
      "Security violation attempt",
      "Attempted to access active account in LOCKED state",
    );
    throw new Error(t("authStore.error.authenticationExpired"));
  }

  // Get sensitive data from temporary store if the hash key is valid
  if (!hashKeyExpired) {
    const temporaryStore = await getTemporaryStore(authStatus);

    if (!temporaryStore) {
      throw new Error(t("authStore.error.temporaryStoreNotFound"));
    }

    // Get private key for the active account
    let privateKey = temporaryStore.privateKeys?.[activeAccountId];

    // Load private key on-demand if it's not already in the temp store
    if (!privateKey) {
      try {
        // Try to derive from mnemonic phrase (which is in temp store)
        if (temporaryStore.mnemonicPhrase) {
          const derivedKey = derivePrivateKeyFromMnemonic(
            temporaryStore.mnemonicPhrase,
            account.publicKey,
          );

          if (derivedKey) {
            privateKey = derivedKey;
            await updateTemporaryStoreWithPrivateKey(
              temporaryStore,
              activeAccountId,
              privateKey,
              hashKey,
            );
          }
        }

        // If still not found and account was imported from secret key, try loading from key manager
        // (Accounts derived from mnemonic should have been found above)
        if (!privateKey && account.importedFromSecretKey) {
          const loadedKey = await loadPrivateKeyFromKeyManager(activeAccountId);

          if (loadedKey) {
            privateKey = loadedKey;
            await updateTemporaryStoreWithPrivateKey(
              temporaryStore,
              activeAccountId,
              privateKey,
              hashKey,
            );
          }
        }
      } catch (e) {
        logger.error(
          "getActiveAccount",
          "Error during lazy loading of private key",
          e,
        );
      }

      // If still no private key after lazy loading attempts, throw error
      if (!privateKey) {
        throw new Error(t("authStore.error.privateKeyNotFound"));
      }
    }

    // Get subentry count from balances store (should be available after initial fetch)
    const { subentryCount } = useBalancesStore.getState();

    return {
      publicKey: account.publicKey,
      privateKey,
      accountName: account.name,
      id: activeAccountId,
      subentryCount,
    };
  }

  throw new Error(t("authStore.error.authenticationExpired"));
};

/**
 * Renames an account
 *
 * @param {RenameAccountParams} params - The rename account parameters
 * @returns {Promise<void>}
 */
const renameAccount = async (params: RenameAccountParams): Promise<void> => {
  const { accountName, publicKey } = params;

  const accountList = await getAllAccounts();
  const account = accountList.find((a) => a.publicKey === publicKey);

  if (!account) {
    return;
  }

  account.name = accountName;

  await dataStorage.setItem(
    STORAGE_KEYS.ACCOUNT_LIST,
    JSON.stringify(accountList),
  );
};

/**
 * Small helper function to check if an account already exists in the account list
 *
 * @param {Account[]} accountList - The list of accounts
 * @param {KeyPair} keyPairValue - The key pair to check
 * @returns {boolean} True if the account exists, false otherwise
 */
const hasAccountInAccountList = (
  accountList: Account[],
  keyPairValue: KeyPair,
) =>
  accountList.some((account) => account.publicKey === keyPairValue.publicKey);

/**
 * Creates a new account by deriving a key pair from the mnemonic phrase,
 * storing the account in the key manager, and creating the temporary store.
 *
 * @param {CreateAccountParams} params - The create account parameters
 * @returns {Promise<void>}
 */
const createAccount = async (password: string): Promise<void> => {
  const loadedKey = await getKeyFromKeyManager(password);
  const { mnemonicPhrase } = loadedKey.extra as { mnemonicPhrase: string };

  const allAccounts = await getAllAccounts();

  const derivedAccountsOnly = allAccounts.filter(
    (account) => !account.importedFromSecretKey,
  );

  // To calculate the index of the next account to derive, we need to look at
  // length considering ONLY the DERIVED accounts otherwise it could skip an
  // index by mistake if there are accounts imported from secret key in the way
  let index = derivedAccountsOnly.length;
  let round: number = 0;
  let keyPair: KeyPair;
  let hasAccount: boolean;

  // The do {} block always executes at least once
  do {
    keyPair = deriveKeyPair({
      mnemonicPhrase,
      index,
    });

    hasAccount = hasAccountInAccountList(allAccounts, keyPair);

    index++;
    round++;
  } while (hasAccount && round < 50);

  await storeAccount({
    mnemonicPhrase,
    password,
    keyPair,
    shouldRefreshHashKey: false,
  });
};

/**
 * Imports a secret key and creates a new account
 *
 * @param {ImportSecretKeyParams} params - The import secret key parameters
 * @returns {Promise<void>}
 */
const importSecretKeyLocal = async (
  params: ImportSecretKeyParams,
  authStatus: AuthStatus,
): Promise<void> => {
  const { secretKey, password } = params;

  try {
    const keypair = Keypair.fromSecret(secretKey);
    const publicKey = keypair.publicKey();
    const privateKey = keypair.secret();

    const existingAccounts = await getAllAccounts();
    const accountExists = hasAccountInAccountList(existingAccounts, {
      publicKey,
      privateKey,
    });

    if (accountExists) {
      throw new Error(t("authStore.error.accountAlreadyExists"));
    }

    const temporaryStore = await getTemporaryStore(authStatus);
    if (!temporaryStore) {
      throw new Error(t("authStore.error.temporaryStoreNotFound"));
    }

    await storeAccount({
      mnemonicPhrase: temporaryStore.mnemonicPhrase,
      password,
      keyPair: {
        publicKey,
        privateKey,
      },
      accountNumber: existingAccounts.length + 1,
      shouldRefreshHashKey: false,
      shouldSetActiveAccount: true,
      importedFromSecretKey: true,
    });

    analytics.track(AnalyticsEvent.ACCOUNT_SCREEN_IMPORT_ACCOUNT);
  } catch (error) {
    analytics.trackAccountScreenImportAccountFail(
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
};

/**
 * Selects an account by setting the active account ID in storage
 *
 * @param {string} publicKey - The public key of the account to select
 * @returns {Promise<void>}
 */
const selectAccount = async (publicKey: string): Promise<void> => {
  const accountList = await getAllAccounts();

  const account = accountList.find((a) => a.publicKey === publicKey);

  if (!account) {
    throw new Error(t("authStore.error.accountNotFound"));
  }

  await dataStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID, account.id);
};

const clearBiometricsData = async (): Promise<void> => {
  usePreferencesStore.getState().setIsBiometricsEnabled(false);
  await Promise.all([
    dataStorage.remove(STORAGE_KEYS.HAS_SEEN_BIOMETRICS_ENABLE_SCREEN),
    biometricDataStorage.clear(),
  ]);
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
export const useAuthenticationStore = create<AuthStore>()((set, get) => {
  // Initialize the store when created
  setTimeout(() => {
    initializeStore(set);
  }, 0);

  return {
    ...initialState,
    isOnboardingFinished: false,
    // Default to PUBLIC network
    network: NETWORKS.PUBLIC,

    /**
     * Verifies if a mnemonic phrase is valid
     *
     * @param {string} mnemonicPhrase - The mnemonic phrase to verify
     * @returns {boolean} True if the mnemonic phrase is valid, false otherwise
     */
    verifyMnemonicPhrase: (mnemonicPhrase: string) => {
      set({ isLoading: true, error: null });
      try {
        StellarHDWallet.fromMnemonic(mnemonicPhrase);
        return true;
      } catch (error) {
        logger.error("verifyMnemonicPhrase", "Invalid mnemonic phrase", error);
        set({
          error: t("authStore.error.invalidMnemonicPhrase"),
        });
        return false;
      } finally {
        set({ isLoading: false });
      }
    },

    storeBiometricPassword: async (password: string) => {
      await biometricDataStorage.setItem(
        BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
        password,
      );
    },

    initBiometricPassword: async () => {
      try {
        // Let createTemporaryStore handle hash key generation to avoid duplication
        // The biometric password is already stored in biometric storage from previous login
        // We just need to verify it exists
        const biometricPasswordExists =
          await biometricDataStorage.checkIfExists(
            BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
          );

        if (biometricPasswordExists) {
          // Password already stored, nothing to do
          return true;
        }

        // If biometric password doesn't exist, try to get it from temp store
        // This only works when authenticated (not when hash key expired)
        const temporaryStore = await getTemporaryStore(get().authStatus);
        if (!temporaryStore) {
          logger.warn(
            "initBiometricPassword",
            "Cannot initialize biometric password - temp store not accessible",
          );
          return false;
        }

        const { password } = temporaryStore;
        if (!password) {
          logger.warn(
            "initBiometricPassword",
            "Cannot initialize biometric password - password not in temp store",
          );
          return false;
        }

        await biometricDataStorage.setItem(
          BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
          password,
        );
        return true;
      } catch (error) {
        logger.error(
          "initBiometricPassword",
          "Failed to initialize biometric password",
          error,
        );
        return false;
      }
    },

    /**
     * Logs out the user by clearing sensitive data
     *
     * For accounts with existing accounts, it preserves account data but clears sensitive info,
     * setting the auth status to HASH_KEY_EXPIRED and navigating to the lock screen.
     * For lock=true, it preserves private keys and hash key (LOCKED state).
     * For new users with no accounts, it performs a full logout.
     */
    logout: (shouldWipeAllData = false) => {
      set((state) => ({ ...state, isLoading: true, error: null }));

      // We'll use setTimeout to handle the async operations
      // This avoids the issue with void return expectations from zustand
      setTimeout(() => {
        (async () => {
          try {
            const accountList = await getAllAccounts();
            const hasAccountList = accountList.length > 0;

            // For logout, preserve private keys and hash key for LOCKED state
            if (hasAccountList && !shouldWipeAllData) {
              // Don't expire hash key - preserve temporary store accessibility
              // Security comes from app being locked, not key expiration

              set({
                account: null,
                isLoadingAccount: false,
                accountError: null,
                authStatus: AUTH_STATUS.LOCKED,
                isLoading: false,
              });

              // This prevents tampering via ADB or rooted devices
              await secureDataStorage.setItem(
                SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
                AUTH_STATUS.LOCKED,
              );

              // Navigate to lock screen
              const { navigationRef } = get();
              if (navigationRef && navigationRef.isReady()) {
                navigationRef.resetRoot({
                  index: 0,
                  routes: [{ name: ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN }],
                });
              }
            } else {
              // If it's a wipe all data logout, clear everything
              clearAccountData();

              // Make sure to disconnect all WalletConnect sessions first
              await useWalletKitStore.getState().disconnectAllSessions();

              // Clear all Wallet Connect storage
              await clearWalletKitStorage();

              // Clear all WebView data (cookies and screenshots)
              await clearAllWebViewData();
              useBrowserTabsStore.getState().closeAllTabs();

              await clearTemporaryData();
              await clearNonSensitiveData();
              await dataStorage.remove(STORAGE_KEYS.COLLECTIBLES_LIST);

              await clearBiometricsData();

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
     * @returns {Promise<void>}
     */
    signUp: async (params): Promise<void> => {
      set((state) => ({ ...state, isLoading: true, error: null }));
      try {
        await signUp(params);

        // Fetch active account BEFORE setting authenticated status
        // This prevents AUTHENTICATED + null account state
        const activeAccount = await get().fetchActiveAccount();

        if (!activeAccount) {
          throw new Error(t("authStore.error.failedToLoadAccount"));
        }

        // Only set AUTHENTICATED after we have a valid account
        set({
          ...initialState,
          isLoading: false,
          authStatus: AUTH_STATUS.AUTHENTICATED,
          account: activeAccount,
          isLoadingAccount: false,
        });
      } catch (error) {
        logger.error("useAuthenticationStore.signUp", "Sign up failed", error);
        set({
          error:
            error instanceof Error
              ? error.message
              : t("authStore.error.failedToSignUp"),
          isLoading: false,
        });
      }
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
        // Check auth status to determine if we need to create temporary store
        const currentAuthStatus = get().authStatus;
        const shouldCreateTempStore = currentAuthStatus !== AUTH_STATUS.LOCKED;

        await signIn({ ...params, shouldCreateTempStore });
        // Now verify we can access the active account before changing auth state
        try {
          // Verify we can load the active account before proceeding
          // This will throw if the temporary store is missing or invalid
          // Pass AUTHENTICATED status since signIn just completed successfully
          const activeAccount = await getActiveAccount(
            AUTH_STATUS.AUTHENTICATED,
          );

          if (!activeAccount) {
            throw new Error(t("authStore.error.failedToLoadAccount"));
          }

          // Only if we can successfully load the account, set the authenticated state
          analytics.trackReAuthSuccess();
          set({
            ...initialState,
            authStatus: AUTH_STATUS.AUTHENTICATED,
            isLoading: false,
            account: activeAccount,
            isLoadingAccount: false,
          });

          // SECURITY FIX: Clear persisted auth status from secure storage since we're now authenticated
          await secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.AUTH_STATUS);
        } catch (accountError) {
          // If we can't access the account after sign-in, handle it as an expired key
          analytics.trackReAuthFail();
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
        analytics.trackReAuthFail();

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
     * Verifies biometric authentication by prompting the user for biometric input
     *
     * This function prompts the user to authenticate using their device's biometric
     * capabilities (Face ID, Touch ID, fingerprint, etc.) and verifies that the
     * stored biometric password can be retrieved. It's used to confirm the user's
     * identity before performing sensitive operations.
     *
     * @returns {Promise<boolean>} Promise resolving to true if biometric authentication succeeds
     * @throws {Error} If no biometry type is found or biometric password retrieval fails
     *
     * @example
     * try {
     *   const isAuthenticated = await verifyBiometrics();
     *   if (isAuthenticated) {
     *     // Proceed with sensitive operation
     *     showRecoveryPhrase();
     *   }
     * } catch (error) {
     *   // Handle authentication failure
     *   console.error('Biometric verification failed:', error);
     * }
     */
    verifyBiometrics: async () => {
      const biometryType = await Keychain.getSupportedBiometryType();

      if (!biometryType) {
        throw new Error("No biometry type found");
      }

      const title: Record<Keychain.BIOMETRY_TYPE, string> = {
        [Keychain.BIOMETRY_TYPE.FACE_ID]: t("authStore.faceId.signInTitle"),
        [Keychain.BIOMETRY_TYPE.FINGERPRINT]: t(
          "authStore.fingerprint.signInTitle",
        ),
        [Keychain.BIOMETRY_TYPE.TOUCH_ID]: t("authStore.touchId.signInTitle"),
        [Keychain.BIOMETRY_TYPE.OPTIC_ID]: t("authStore.opticId.signInTitle"),
        [Keychain.BIOMETRY_TYPE.IRIS]: t("authStore.iris.signInTitle"),
        [Keychain.BIOMETRY_TYPE.FACE]: t(
          "authStore.faceBiometrics.signInTitle",
        ),
      };

      const item = await biometricDataStorage.getItem(
        BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
        {
          cancel: t("common.cancel"),
          title: title[biometryType],
        },
      );
      if (!item) {
        throw new Error("Biometric password not found");
      }

      return true;
    },

    /**
     * Generic function to verify biometrics and execute an action with the stored password
     *
     * This function intelligently handles biometric authentication based on user preferences
     * and device capabilities. If biometrics are enabled and available, it prompts the user
     * for biometric authentication, retrieves the stored password, and executes the callback
     * with that password. If biometrics are disabled or unavailable, it gracefully falls back
     * to calling the callback with an undefined password, allowing the action to proceed
     * without biometric verification.
     *
     * The function automatically detects:
     * - Whether biometrics are enabled in user preferences
     * - The user's preferred sign-in method (biometric vs password)
     * - Device sensor availability
     * - Supported biometry types
     *
     * This is useful for actions that require the user's password but can be authenticated
     * via biometrics, or actions that work with or without biometrics.
     *
     * @template T - The return type of the callback function
     * @template P - The type of additional parameters (defaults to empty array)
     * @param {(password?: string, ...args: P) => Promise<T>} callback - Function that takes the password and additional args, returns Promise<T>
     * @param {...P} args - Additional arguments to pass to the callback function
     * @returns {Promise<T>} The result of executing the callback function
     * @throws {Error} If biometric authentication fails or no stored password is found
     *
     * @example
     * // Example 1: Show recovery phrase with biometric authentication
     * await verifyActionWithBiometrics(async (password: string) => {
     *   if (password) {
     *     const key = await getKeyFromKeyManager(password);
     *     const keyExtra = key.extra as { mnemonicPhrase: string };
     *     if (keyExtra?.mnemonicPhrase) {
     *       navigation.navigate('RecoveryPhrase', { phrase: keyExtra.mnemonicPhrase });
     *     }
     *   } else {
     *     // Handle case where no password is available (user disabled biometrics)
     *     navigation.navigate('PasswordInput');
     *   }
     * });
     *
     * @example
     * // Example 2: Simple action with biometric authentication
     * await verifyActionWithBiometrics(async (password: string) => {
     *   if (password) {
     *     // Use biometric password
     *     await performSecureAction(password);
     *   } else {
     *     // Fallback to password input
     *     await promptForPassword();
     *   }
     * });
     *
     * @example
     * // Example 3: Action with password parameter but no return value
     * await verifyActionWithBiometrics(async (password: string) => {
     *   if (password) {
     *     handleContinue(password);
     *   } else {
     *     // Handle password input manually
     *     const manualPassword = await promptForPassword();
     *     handleContinue(manualPassword);
     *   }
     *   return Promise.resolve();
     * });
     *
     * @example
     * // Example 4: Action that returns a value
     * const result = await verifyActionWithBiometrics(async (password: string) => {
     *   const key = await getKeyFromKeyManager(password);
     *   return key.privateKey;
     * });
     *
     * @example
     * // Example 5: Action with additional parameters
     * await verifyActionWithBiometrics(
     *   async (password: string, transaction: Transaction, network: string) => {
     *     const key = await getKeyFromKeyManager(password);
     *     return await signTransaction(transaction, key.privateKey, network);
     *   },
     *   transaction,
     *   network
     * );
    },

    /**
     * Enables biometrics for the current session
     *
     * This function is specifically for enabling biometrics on screens without password.
     * It forces biometric authentication and executes the callback upon success.
     * Unlike verifyActionWithBiometrics, this function always requires biometric
     * authentication and does not fall back to password-based authentication nor access biometric password from storage or route params to verify it.
     *
     * @template T - The return type of the callback function
     * @param {(biometricPassword?: string) => Promise<T>} callback - The function to execute after successful biometric authentication
     * @returns {Promise<T>} The result of the callback function
     *
     * @example
     * // Enable biometrics during onboarding
     * await enableBiometrics(async (biometricPassword: string) => {
     *   setIsBiometricsEnabled(true);
     *   navigation.navigate('MainScreen');
     *   return Promise.resolve();
     * });
     */
    enableBiometrics: async <T>(
      callback: (biometricPassword?: string) => Promise<T>,
    ): Promise<T> => {
      try {
        const biometryType = await Keychain.getSupportedBiometryType();

        if (!biometryType) {
          throw new Error("No biometry type found");
        }

        const title: Record<Keychain.BIOMETRY_TYPE, string> = {
          [Keychain.BIOMETRY_TYPE.FACE_ID]: t("authStore.faceId.signInTitle"),
          [Keychain.BIOMETRY_TYPE.FINGERPRINT]: t(
            "authStore.fingerprint.signInTitle",
          ),
          [Keychain.BIOMETRY_TYPE.FACE]: t(
            "authStore.faceBiometrics.signInTitle",
          ),
          [Keychain.BIOMETRY_TYPE.TOUCH_ID]: t("authStore.touchId.signInTitle"),
          [Keychain.BIOMETRY_TYPE.OPTIC_ID]: t("authStore.opticId.signInTitle"),
          [Keychain.BIOMETRY_TYPE.IRIS]: t("authStore.iris.signInTitle"),
        };

        // Get the stored password from biometric storage
        const storedData = await biometricDataStorage.getItem(
          BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
          {
            title: title[biometryType],
            cancel: t("common.cancel"),
          },
        );
        if (!storedData || !storedData.password) {
          set({ isLoading: false });
          throw new Error(
            "No stored password found for biometric authentication",
          );
        }

        // Execute the callback function
        return await callback(storedData.password);
      } catch (error) {
        logger.error(
          "enableBiometrics",
          "Biometric authentication failed",
          error,
        );
        set({ isLoading: false });
        throw error;
      }
    },

    /**
     * Verifies an action with biometric authentication
     *
     * This function handles biometric authentication for sensitive actions.
     * It retrieves the stored password from biometric storage and passes it to the callback.
     * If biometrics are disabled or unavailable, it falls back to calling the callback
     * with an undefined password, allowing the action to proceed without biometric verification and letting the caller handle password management.
     *
     * @template T - The return type of the callback function
     * @template P - The parameter types for the callback function
     * @param {(password?: string, ...args: P) => Promise<T>} callback - The function to execute after successful biometric authentication
     * @param {...P} args - Additional arguments to pass to the callback function
     * @returns {Promise<T>} The result of the callback function
     *
     * @example
     * // Example 1: Simple action verification
     * await verifyActionWithBiometrics(async (password: string) => {
     *   const key = await getKeyFromKeyManager(password);
     *   return await performAction(key);
     * });
     *
     * // Example 2: Action with additional parameters
     * await verifyActionWithBiometrics(
     *   async (password: string, transaction: Transaction) => {
     *     const key = await getKeyFromKeyManager(password);
     *     return await signTransaction(transaction, key.privateKey);
     *   },
     *   transaction
     * );
     *
     * // Example 3: Action with multiple additional parameters
     * await verifyActionWithBiometrics(
     *   async (password: string, transaction: Transaction, network: string) => {
     *     const key = await getKeyFromKeyManager(password);
     *     return await signTransaction(transaction, key.privateKey, network);
     *   },
     *   transaction,
     *   network
     * );
     */
    verifyActionWithBiometrics: async <T, P extends unknown[]>(
      callback: (password?: string, ...args: P) => Promise<T>,
      ...args: P
    ): Promise<T> => {
      try {
        const rnBiometrics = new ReactNativeBiometrics({
          allowDeviceCredentials: true,
        });
        // Check if biometrics is enabled first
        const { isBiometricsEnabled } = usePreferencesStore.getState();
        const { signInMethod } = get();

        // If biometrics is not enabled or user opts to use password, call the callback directly with an empty password
        if (!isBiometricsEnabled || signInMethod === LoginType.PASSWORD) {
          return await callback(undefined, ...args);
        }

        // Only check sensor availability and biometry type if biometrics are enabled
        const isSensorAvailable = await rnBiometrics.isSensorAvailable();
        if (!isSensorAvailable) {
          return await callback(undefined, ...args);
        }

        const biometryType = await Keychain.getSupportedBiometryType();
        if (!biometryType) {
          return await callback(undefined, ...args);
        }

        const title: Record<Keychain.BIOMETRY_TYPE, string> = {
          [Keychain.BIOMETRY_TYPE.FACE_ID]: t("authStore.faceId.signInTitle"),
          [Keychain.BIOMETRY_TYPE.FINGERPRINT]: t(
            "authStore.fingerprint.signInTitle",
          ),
          [Keychain.BIOMETRY_TYPE.FACE]: t(
            "authStore.faceBiometrics.signInTitle",
          ),
          [Keychain.BIOMETRY_TYPE.TOUCH_ID]: t("authStore.touchId.signInTitle"),
          [Keychain.BIOMETRY_TYPE.OPTIC_ID]: t("authStore.opticId.signInTitle"),
          [Keychain.BIOMETRY_TYPE.IRIS]: t("authStore.iris.signInTitle"),
        };

        // Get the stored password from biometric storage
        const storedData = await biometricDataStorage.getItem(
          BIOMETRIC_STORAGE_KEYS.BIOMETRIC_PASSWORD,
          {
            title: title[biometryType],
            cancel: t("common.cancel"),
          },
        );

        if (!storedData || !storedData.password) {
          set({ isLoading: false });
          throw new Error(
            "No stored password found for biometric authentication",
          );
        }

        // Execute the callback function with the retrieved password
        return await callback(storedData.password, ...args);
      } catch (error) {
        logger.error(
          "verifyActionWithBiometrics",
          "Biometric authentication failed",
          error,
        );
        set({ isLoading: false });
        throw error;
      }
    },

    /**
     * Imports a wallet with the provided credentials
     *
     * @param {ImportWalletParams} params - The wallet import parameters
     */
    importWallet: async (params): Promise<boolean> => {
      set({ isLoading: true, error: null });

      try {
        await importWallet(params);

        // Fetch active account BEFORE setting authenticated status
        // This prevents AUTHENTICATED + null account state
        const activeAccount = await get().fetchActiveAccount();

        if (!activeAccount) {
          throw new Error(t("authStore.error.failedToLoadAccount"));
        }

        // Only set AUTHENTICATED after we have a valid account
        set({
          ...initialState,
          authStatus: AUTH_STATUS.AUTHENTICATED,
          isLoading: false,
          account: activeAccount,
          isLoadingAccount: false,
        });

        return true;
      } catch (error) {
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
        return false;
      }
    },

    /**
     * Gets the current authentication status
     *
     * @returns {Promise<AuthStatus>} The current authentication status
     */
    getAuthStatus: async () => {
      // Always re-validate auth status to ensure consistency
      // Don't rely on cached status as it may be stale after app updates
      const authStatus = await getAuthStatus();
      set({ authStatus });

      // If the hash key is expired, navigate to lock screen
      if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
        get().navigateToLockScreen();
      }

      return authStatus;
    },

    /**
     * Sets the authentication status
     *
     * @param {AuthStatus} authStatus - The authentication status
     */
    setAuthStatus: (authStatus: AuthStatus) => {
      set({ authStatus });
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

        // Security: Block access when hash key is expired or when locked
        // LOCKED state requires password re-entry before accessing sensitive data
        if (
          authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
          authStatus === AUTH_STATUS.LOCKED
        ) {
          set({
            authStatus,
          });

          // Navigate to lock screen
          get().navigateToLockScreen();

          set({ isLoadingAccount: false });
          return null;
        }

        // Use the freshly fetched authStatus for consistency
        const activeAccount = await getActiveAccount(authStatus);
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
     * Renames an account
     *
     * @param {RenameAccountParams} params - The rename account parameters
     */
    renameAccount: async (params) => {
      set({ isRenamingAccount: true });

      try {
        await renameAccount(params);
        await Promise.all([
          renameAccount(params),
          get().fetchActiveAccount(),
          get().getAllAccounts(),
        ]);
        set({ isRenamingAccount: false });
      } catch (error) {
        logger.error("renameAccount", "Failed to rename account", error);

        set({
          error:
            error instanceof Error
              ? error.message
              : t("authStore.error.failedToRenameAccount"),
          isRenamingAccount: false,
        });
      }
    },

    /**
     * Gets all accounts and updates the store
     *
     * @returns {Promise<void>}
     */
    getAllAccounts: async () => {
      set({ isLoadingAllAccounts: true });

      try {
        const allAccounts = await getAllAccounts();
        set({ allAccounts });
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? error.message
              : t("authStore.error.failedToGetAllAccounts"),
          isLoadingAllAccounts: false,
        });
      } finally {
        set({ isLoadingAllAccounts: false });
      }
    },

    createAccount: async (password: string) => {
      set({ isCreatingAccount: true, error: null });

      try {
        await createAccount(password);

        await Promise.all([get().getAllAccounts(), get().fetchActiveAccount()]);

        set({ isCreatingAccount: false, error: null });
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? error.message
              : t("authStore.error.failedToCreateAccount"),
          isCreatingAccount: false,
        });
        throw error;
      }
    },

    selectAccount: async (publicKey: string) => {
      // Clear previous account data immediately to prevent showing stale data
      clearAccountData();

      set({ isSwitchingAccount: true, error: null });
      try {
        // Security: Check auth status before allowing account switching
        // Block access when hash key is expired or when locked
        const authStatus = await getAuthStatus();
        if (
          authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
          authStatus === AUTH_STATUS.LOCKED
        ) {
          set({ authStatus });
          get().navigateToLockScreen();
          set({ isSwitchingAccount: false });
          return;
        }

        await selectAccount(publicKey);
        const activeAccount = await getActiveAccount(authStatus);
        set({ account: activeAccount, isSwitchingAccount: false });
      } catch (error) {
        logger.error(
          "useAuthenticationStore.selectAccount",
          "Failed to select account",
          error,
        );

        const errorMessage =
          error instanceof Error ? error.message : String(error);

        set({ error: errorMessage, isSwitchingAccount: false });
      }
    },

    getTemporaryStore: async () => getTemporaryStore(get().authStatus),
    clearError: () => {
      set({ error: null });
    },

    selectNetwork: async (network: NETWORKS) => {
      await dataStorage.setItem(STORAGE_KEYS.ACTIVE_NETWORK, network);

      set({ network });
    },

    getKeyFromKeyManager: async (
      password: string,
      activeAccountId?: string | null,
    ) => getKeyFromKeyManager(password, activeAccountId),

    importSecretKey: async (params: ImportSecretKeyParams) => {
      set({ isLoading: true, error: null });

      try {
        await importSecretKeyLocal(params, get().authStatus);

        await Promise.all([get().getAllAccounts(), get().fetchActiveAccount()]);

        set({ isLoading: false, error: null });
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? error.message
              : t("authStore.error.failedToImportSecretKey"),
          isLoading: false,
        });

        throw error;
      }
    },

    devResetAppAuth: () => {
      if (!__DEV__) {
        return;
      }

      set({ ...initialState });
      dataStorage.clear();
      get().logout();
    },

    setSignInMethod: (method: LoginType) => {
      set({ signInMethod: method });
    },

    setHasTriggeredAppOpenBiometricsLogin: (hasTriggered: boolean) => {
      set({ hasTriggeredAppOpenBiometricsLogin: hasTriggered });
    },
  };
});

import { NavigationContainerRef } from "@react-navigation/native";
import {
  encode as base64Encode,
  decode as base64Decode,
} from "@stablelib/base64";
import { Keypair, Networks } from "@stellar/stellar-sdk";
import {
  Key,
  KeyType,
  ScryptEncrypter,
} from "@stellar/typescript-wallet-sdk-km";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  ACCOUNTS_TO_VERIFY_ON_EXISTING_MNEMONIC_PHRASE,
  AUTO_LOCK_TIMER_MS,
  BIOMETRIC_STORAGE_KEYS,
  DEFAULT_AUTO_LOCK_TIMER,
  FACE_ID_BIOMETRY_TYPES,
  FINGERPRINT_BIOMETRY_TYPES,
  HASH_KEY_EXPIRATION_MS,
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
  MnemonicMap,
  SecretSourceType,
  TemporaryStore,
} from "config/types";
import { useAccountsFiatTotalsStore } from "ducks/accountsFiatTotals";
import { useBalancesStore } from "ducks/balances";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { useCollectiblesStore } from "ducks/collectibles";
import { useHistoryStore } from "ducks/history";
import { usePreferencesStore } from "ducks/preferences";
import { usePricesStore } from "ducks/prices";
import { useRecentProtocolsStore } from "ducks/recentProtocols";
import { useWalletKitStore } from "ducks/walletKit";
import {
  getNextDefaultAccountName,
  normalizeAccountName,
} from "helpers/accountName";
import { clearAllWebViewData } from "helpers/browser";
import {
  deriveKeyFromPassword,
  generateSalt,
  decryptDataWithDerivedKey,
  encryptDataWithDerivedKey,
} from "helpers/encryptPassword";
import { findAccountById, findAccountByPublicKey } from "helpers/findAccount";
import { createKeyManager } from "helpers/keyManager/keyManager";
import { markRebrandAnnouncementSeen } from "helpers/rebrandAnnouncement";
import { clearScreenshotDek } from "helpers/screenshotCrypto";
import { scrubStrKeys } from "helpers/stellarStrKey";
import { clearWalletKitStorage } from "helpers/walletKitUtil";
import { t } from "i18next";
import { AppState, Keyboard } from "react-native";
import ReactNativeBiometrics from "react-native-biometrics";
import * as Keychain from "react-native-keychain";
import { analytics } from "services/analytics";
import {
  getDerivationIndices,
  lowestUnusedIndex,
  markDerivationIndexUsed,
} from "services/auth/derivationIndices";
import { deriveAuthKeypair } from "services/auth/deriveAuthKeypair";
import { linkWalletSources } from "services/auth/linkSources";
import { clearLinkStatus, getLinkConflicts } from "services/auth/linkStatus";
import {
  addSecretSource,
  getDefaultMnemonic,
  getHeldMnemonic,
  getPhraseSourceId,
  getSecretKeySourceId,
  getSecretSources,
  pinFirstSource,
} from "services/auth/secretSources";
import { getWalletSources } from "services/auth/walletSources";
import { clearCachedWalletSources } from "services/auth/walletSourcesCache";
import {
  clearBackgroundedAt,
  getAutoLockTimer,
  getBackgroundedAt,
  persistAutoLockTimer,
} from "services/autoLock";
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
 * @property {string} [mnemonicPhrase] - The phrase that derived the key pair; absent for a secret-key import (optional)
 * @property {string} [phraseSourceId] - The source id of `mnemonicPhrase`. When given, the phrase is held in the session's mnemonic map under it (optional)
 * @property {string} sourceId - The `SecretSource` the account is rooted in, recorded on the account
 * @property {number} [derivationIndex] - The index on `phraseSourceId` that derived `keyPair` (optional)
 * @property {string} password - User's password for encrypting the wallet
 * @property {KeyPair} keyPair - The public and private key pair
 * @property {boolean} [importedFromSecretKey] - Whether the account was imported from an external secret key (optional)
 * @property {boolean} [shouldRefreshHashKey] - Whether to refresh the hash key (optional)
 * @property {boolean} [shouldSetActiveAccount] - Whether to set this account as active (optional)
 * @property {number} [accountNumber] - The account number for derivation (optional)
 * @property {string} [accountName] - The name the user chose (optional)
 */
interface StoreAccountParams {
  /**
   * The phrase that derived `keyPair`. Required for a derived account and
   * stamped into its keystore, which is where sign-in still collects the held
   * phrase from. A secret-key import has none.
   */
  mnemonicPhrase?: string;
  /**
   * The source id of `mnemonicPhrase`. When given, the phrase is held in the
   * session's mnemonic map under it.
   */
  phraseSourceId?: string;
  /**
   * The `SecretSource` the account is rooted in: the phrase it was derived
   * from, or its own secret key for a standalone import. Required and never
   * inferred from `phraseSourceId`.
   */
  sourceId: string;
  /**
   * The index on `phraseSourceId` that derived `keyPair`. Marked used the
   * moment the keystore exists. Secret-key imports have none.
   */
  derivationIndex?: number;
  password: string;
  keyPair: KeyPair;
  importedFromSecretKey?: boolean;
  shouldRefreshHashKey?: boolean;
  shouldSetActiveAccount?: boolean;
  accountNumber?: number;
  /**
   * The name the user chose. Absent or blank, `accountNumber`'s name, else
   * the next default name not already in use.
   */
  accountName?: string;
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
  // True when the wallet was soft-locked in-process (auto-lock timer): the
  // navigation tree stays mounted under a lock overlay so the user resumes
  // exactly where they were after unlocking.
  isSoftLocked: boolean;
  // True when the lock happened while the user was actively present in the
  // app — a foreground-idle timeout or a manual lock/logout. The lock screen
  // uses this to suppress the biometric auto-prompt: an unprompted Face ID is
  // jarring when the user just locked it themselves or stepped away. The
  // prompt still fires on cold start and on return from the background.
  suppressBiometricAutoPrompt: boolean;
  allAccounts: Account[];

  // Active account state
  account: ActiveAccount | null;
  isLoadingAccount: boolean;
  accountError: string | null;
  navigationRef: NavigationContainerRef<RootStackParamList> | null;

  // Biometric authentication state
  signInMethod: LoginType;

  // Source ids /user/link reported as belonging to another user (#68). Not
  // shown yet: the conflict UI is waiting on design.
  linkConflicts: string[];
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
 * @property {Function} linkSources - Sends /user/link for every unsettled source in the background and refreshes linkConflicts
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
  softLock: (options?: { suppressBiometricPrompt?: boolean }) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<boolean>;
  signIn: (params: SignInParams) => Promise<void>;
  importWallet: (params: ImportWalletParams) => Promise<boolean>;
  verifyMnemonicPhrase: (mnemonicPhrase: string) => boolean;
  importSecretKey: (params: ImportSecretKeyParams) => Promise<void>;
  linkSources: () => void;
  getAuthStatus: () => Promise<AuthStatus>;
  renameAccount: (params: RenameAccountParams) => Promise<void>;
  getAllAccounts: () => Promise<void>;
  /**
   * Adds an account at its phrase's lowest unused derivation index. `sourceId`
   * names the phrase; absent, the active account's phrase is used, else the
   * pinned source, else the first held. `accountName` names it; absent or
   * blank, the next default name.
   */
  createAccount: (
    password: string,
    sourceId?: string,
    accountName?: string,
  ) => Promise<void>;
  /**
   * Stores the phrase `generatePendingRecoveryPhrase` is holding as a new
   * phrase source and adds its first account, which becomes active.
   */
  addRecoveryPhraseSource: (
    password: string,
    pendingPhraseId: string,
    accountName?: string,
  ) => Promise<void>;
  selectAccount: (publicKey: string) => Promise<void>;
  selectNetwork: (network: NETWORKS) => Promise<void>;
  initializeNetwork: () => Promise<void>;

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
  /** The decrypted temporary store for the current auth status; null when locked, expired, or unreadable. */
  getTemporaryStore: () => Promise<TemporaryStore | null>;

  clearError: () => void;
  clearAccountError: () => void;
  devResetAppAuth: () => void;
  setAuthStatus: (authStatus: AuthStatus) => void;

  // Biometric authentication actions
  setSignInMethod: (method: LoginType) => void;
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
  isSoftLocked: false,
  suppressBiometricAutoPrompt: false,
  allAccounts: [],
  // Active account initial state
  account: null,
  isLoadingAccount: false,
  accountError: null,
  navigationRef: null,
  // Biometric authentication initial state
  signInMethod: LoginType.PASSWORD,
  linkConflicts: [],
};

/**
 * Module-level cache for the scrypt-derived symmetric encryption key (32 bytes).
 *
 * Not in the Zustand store because:
 *  - Uint8Array is not serializable (breaks devtools / persist middleware).
 *  - Updating it would notify all store subscribers and trigger re-renders.
 *  - It is an encryption implementation detail, not UI state.
 *
 * Kept through LOCKED state so unlock only needs one scrypt (password verify);
 * cleared only when a new hash key is generated (new session / wipe).
 */
let derivedKeyCache: Uint8Array | null = null;

/**
 * Set the symmetric encryption key both in memory and in SecureStorage so it
 * survives process restarts (e.g. cold app-open from LOCKED state).
 */
const setDerivedKeyCache = async (key: Uint8Array): Promise<void> => {
  derivedKeyCache = key;
  try {
    await secureDataStorage.setItem(
      SENSITIVE_STORAGE_KEYS.DERIVED_KEY,
      base64Encode(key),
    );
  } catch (e) {
    // Non-fatal: next cold open will derive the key once via the slow path.
    logger.debug("setDerivedKeyCache", "Failed to persist derived key", e);
  }
};

const clearDerivedKeyCache = (): void => {
  derivedKeyCache = null;
  // Best-effort removal from SecureStorage. Fire-and-forget: the in-memory null
  // is the authoritative security boundary; the persisted key is only an
  // optimisation and is derivable from HashKey anyway.
  secureDataStorage
    .remove(SENSITIVE_STORAGE_KEYS.DERIVED_KEY)
    .catch((e) =>
      logger.debug("clearDerivedKeyCache", "Failed to remove derived key", e),
    );
};

/**
 * Initialize the store by loading the active network from storage
 */
const loadPersistedNetwork = async (
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
    logger.error(
      "loadPersistedNetwork",
      "Failed to load persisted network",
      error,
    );
  }
};

/**
 * Key manager instance for handling cryptographic operations
 * We're using mainnet as the default, but the same key manager can be used for testnet as well
 */
const keyManager = createKeyManager(Networks.PUBLIC);

/**
 * Checks if a hash key is expired.
 *
 * Clock-rollback backstop: a key whose generatedAt is in the future means the
 * device clock was moved backward below the key's creation time — a rolled-back
 * clock would otherwise keep `now <= expiresAt` true indefinitely and prevent
 * the hard-expiry from ever forcing a full re-auth. Treat that as expired
 * (mirrors getBackgroundedAt's future-timestamp guard for the soft timer).
 * generatedAt is optional so keys persisted before this field fall back to the
 * plain expiry check.
 */
const isHashKeyExpired = (hashKey: HashKey): boolean => {
  const now = Date.now();
  if (hashKey.generatedAt !== undefined && hashKey.generatedAt > now) {
    return true;
  }
  return now > hashKey.expiresAt;
};

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

    // Read from SECURE storage (encrypted) to prevent tampering.
    // LOCKED check comes before isHashKeyExpired: if the user locked the app,
    // the hash key may have expired while it was sitting on the lock screen.
    // We still want LOCKED (not HASH_KEY_EXPIRED) so the signIn fast path runs
    // (TTL refresh + derived key cache) rather than forcing a full re-derivation.
    const persistedAuthStatus = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
    );
    if (persistedAuthStatus === AUTH_STATUS.LOCKED) {
      if (temporaryStore) {
        return AUTH_STATUS.LOCKED;
      }
      // Temp store missing: LOCKED state is invalid, treat as expired
      await secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.AUTH_STATUS);
      return AUTH_STATUS.HASH_KEY_EXPIRED;
    }

    // Hard expiry wins over the soft timer lock: checked before the timer so a
    // session backgrounded past the hash-key TTL forces a full re-auth instead
    // of a fast-path LOCKED that would just refresh the expired key. (The
    // persisted-LOCKED branch above keeps the fast path — there it's intended.)
    if (hashKey && isHashKeyExpired(hashKey)) {
      return AUTH_STATUS.HASH_KEY_EXPIRED;
    }

    // Auto-lock timer: useAuthCheck records a timestamp on background; on
    // return (warm or cold start), elapsed >= the selected duration soft-locks
    // via the fast unlock path. Uses wall-clock time, so a clock rollback can
    // dodge it — the hash-key expiry above still bounds the session.
    const backgroundedAt = await getBackgroundedAt();
    // Explicit null check, not truthiness: a clock-rollback returns 0 (epoch)
    // to force a conservative lock, and 0 is falsey — `if (backgroundedAt)`
    // would skip it and leave the session AUTHENTICATED.
    if (backgroundedAt !== null) {
      const autoLockTimer = await getAutoLockTimer();
      const autoLockTimerMs = AUTO_LOCK_TIMER_MS[autoLockTimer];
      const elapsedInBackground = Date.now() - backgroundedAt;

      // Backgrounded past the selected duration: soft-lock via the fast
      // unlock path (all presets are positive durations, so no zero/null case
      // to exclude).
      if (elapsedInBackground >= autoLockTimerMs && temporaryStore) {
        await secureDataStorage.setItem(
          SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
          AUTH_STATUS.LOCKED,
        );
        await clearBackgroundedAt();
        return AUTH_STATUS.LOCKED;
      }

      if (AppState.currentState === "active") {
        // Returned within the timer: consume the timestamp so the foreground
        // interval can't lock mid-use. The hash-key TTL is deliberately NOT
        // refreshed here — it's only anchored at credential-verified moments
        // (signIn / generateHashKey) so key material stays bounded however
        // often the app is reopened.
        await clearBackgroundedAt();
      }
      // Still backgrounded (periodic background check): leave the timestamp
      // intact so the timer keeps counting from the original moment.
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
 * @returns {Promise<TemporaryStore>} The decrypted temporary store
 * @throws {Error} If decryption fails (wrong key or corrupted data)
 */
const decryptTemporaryStore = async (
  hashKey: HashKey,
  temporaryStore: string,
): Promise<TemporaryStore> => {
  const { hashKey: hashKeyString, salt } = hashKey;

  // Fast path 1: reuse the in-memory key (within the same process).
  let derivedKey: Uint8Array;
  if (derivedKeyCache) {
    derivedKey = derivedKeyCache;
  } else {
    // Fast path 2: load from SecureStorage (survives process restarts).
    // DERIVED_KEY = scrypt(hashKey.hashKey, salt) is derivable from HashKey which is
    // already in SecureStorage, so this adds no new attack surface.
    const storedKey = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.DERIVED_KEY,
    );
    if (storedKey) {
      derivedKey = base64Decode(storedKey);
      derivedKeyCache = derivedKey; // warm in-memory cache; key is already in SecureStorage
    } else {
      // Slow path: full KDF (first login or after wipe).
      derivedKey = await deriveKeyFromPassword({
        password: hashKeyString,
        saltParam: salt,
      });
      await setDerivedKeyCache(derivedKey);
    }
  }

  // decryptDataWithDerivedKey throws on failure — no falsy return to check.
  return JSON.parse(
    decryptDataWithDerivedKey(temporaryStore, derivedKey),
  ) as TemporaryStore;
};

/**
 * A temporary store written before the mnemonic map existed holds one
 * `mnemonicPhrase`. The extension needs no migration because every lock
 * removes its store, but the mobile store survives lock, so an upgraded
 * install can decrypt one. Move the phrase under its source id in place
 * rather than invalidating the session.
 */
const upgradeLegacyTemporaryStore = async (
  store: TemporaryStore,
  hashKey: HashKey,
): Promise<TemporaryStore> => {
  const { mnemonicPhrase, ...rest } = store as TemporaryStore & {
    mnemonicPhrase?: string;
  };

  if (rest.mnemonics || typeof mnemonicPhrase !== "string") {
    return store;
  }

  const mnemonics: MnemonicMap = {};
  if (mnemonicPhrase) {
    try {
      mnemonics[await getPhraseSourceId(mnemonicPhrase)] = mnemonicPhrase;
    } catch (error) {
      // One unreadable phrase must not lock the user out: the private keys
      // are already in hand, so every account can still sign.
      logger.error(
        "upgradeLegacyTemporaryStore",
        "Failed to derive the phrase source id",
        error,
      );
    }
  }

  const upgraded: TemporaryStore = { ...rest, mnemonics };

  // decryptTemporaryStore just warmed the cache; derive only if it did not.
  let derivedKey = derivedKeyCache;
  if (!derivedKey) {
    derivedKey = await deriveKeyFromPassword({
      password: hashKey.hashKey,
      saltParam: hashKey.salt,
    });
    await setDerivedKeyCache(derivedKey);
  }

  await secureDataStorage.setItem(
    SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    encryptDataWithDerivedKey(JSON.stringify(upgraded), derivedKey),
  );

  return upgraded;
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
      // The security check above already filters NOT_AUTHENTICATED, so
      // we're in AUTHENTICATED or LOCKED state - both should carry a
      // valid hashKey. Missing here indicates storage corruption /
      // keychain ↔ AsyncStorage drift, which downstream callers will
      // treat as a hard auth failure.
      logger.error(
        "[getTemporaryStore]",
        "Hash key missing in active session",
        new Error("Hash key missing in active session"),
      );

      return null;
    }

    if (isHashKeyExpired(hashKey)) {
      // Hash key TTL expired - the security policy is forcing
      // re-authentication. Expected lifecycle, normally caught by
      // the security check at the top. Warn so the breadcrumb is
      // available for debugging if it ever fires off the expected
      // path; fires at most once per session, no buffer concern.
      logger.warn("[getTemporaryStore]", "Hash key has expired, access denied");

      return null;
    }
    const temporaryStore = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    );
    if (!temporaryStore) {
      // Can fire transiently during the delete-account → create-new-
      // account flow: the previous account's cleanup may not have
      // fully completed when the new account write begins, leaving
      // a brief window where authStatus + hashKey are present but
      // TEMPORARY_STORE has been removed and not yet rewritten. Rare
      // in practice and self-resolves on the next read, so we keep
      // the log at error (downstream callers swallow the null
      // silently) to monitor in case it starts happening more than
      // expected.
      logger.error(
        "[getTemporaryStore]",
        "Temporary store missing in active session",
        new Error("Temporary store missing in active session"),
      );

      return null;
    }

    let decryptedTemporaryStore: TemporaryStore | null = null;

    try {
      decryptedTemporaryStore = await upgradeLegacyTemporaryStore(
        await decryptTemporaryStore(hashKey, temporaryStore),
        hashKey,
      );
    } catch (error) {
      // Error will be handled in the failure tracking below
    }

    // A secret-key-only wallet holds an empty map, so only its presence is
    // checked, not its size.
    if (
      decryptedTemporaryStore &&
      decryptedTemporaryStore.privateKeys &&
      decryptedTemporaryStore.mnemonics
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
      // Pass a real Error with a stable message so all events group as
      // a single Sentry issue. The variable failure count and window
      // go into extra args (Sentry's "extra" payload) for diagnostics
      // - inlining them into the message would interpolate the count
      // into the title and split the group on every distinct count.
      logger.error(
        "[getTemporaryStore]",
        "Repeated decryption failures detected within failure window",
        new Error("Repeated decryption failures detected"),
        {
          failureCount: getTemporaryStoreFailureCount,
          failureResetWindowMs: FAILURE_RESET_WINDOW_MS,
        },
      );
    }
    clearDerivedKeyCache();
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
 * Reads only non-secure storage, so it works without authentication.
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

    // Calculate the hard-expiry timestamp (the coarse security backstop that
    // forces a full re-auth; the soft auto-lock timer is enforced separately).
    const now = Date.now();
    const expirationTime = now + HASH_KEY_EXPIRATION_MS;

    // Return the hash key object (caller will store it). generatedAt anchors
    // the clock-rollback backstop in isHashKeyExpired.
    return {
      hashKey,
      salt,
      expiresAt: expirationTime,
      generatedAt: now,
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
 * @param {string} [input.mnemonicPhrase] - The mnemonic phrase to hold; absent when the opened keystore carries none
 * @param {string} [input.phraseSourceId] - The source id of `mnemonicPhrase`; without it the phrase is not held
 * @param {MnemonicMap} [input.otherMnemonics] - Further phrases to hold, by source id, after `mnemonicPhrase` (optional)
 * @param {Object} input.activeKeyPair - The active key pair with account info
 * @param {boolean} input.shouldRefreshHashKey - Whether to refresh the hash key
 * @returns {Promise<void>}
 */
const createTemporaryStore = async (input: {
  password: string;
  mnemonicPhrase?: string;
  phraseSourceId?: string;
  otherMnemonics?: MnemonicMap;
  activeKeyPair: KeyPair & { accountName: string; id: string };
  shouldRefreshHashKey?: boolean;
}): Promise<void> => {
  const {
    password,
    mnemonicPhrase,
    phraseSourceId,
    otherMnemonics = {},
    activeKeyPair,
    shouldRefreshHashKey = true,
  } = input;

  // When refreshing the hash key, salvage any private keys already cached in the
  // existing temp store BEFORE the old derived key is cleared. This prevents
  // per-account re-derivation (StellarHDWallet.fromMnemonic) on first account
  // switch each session — the keys were already derived during wallet import.
  let preservedPrivateKeys: Record<string, string> = {};
  if (shouldRefreshHashKey) {
    try {
      const oldHashKey = await getHashKey();
      const oldTempStoreRaw = await secureDataStorage.getItem(
        SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
      );
      if (oldHashKey && oldTempStoreRaw) {
        const decrypted = await decryptTemporaryStore(
          oldHashKey,
          oldTempStoreRaw,
        );
        if (decrypted?.privateKeys) {
          preservedPrivateKeys = decrypted.privateKeys;
        }
      }
    } catch (e) {
      // Old store unreadable (first login, corrupted data, etc.) — proceed empty.
      logger.warn(
        "createTemporaryStore",
        "Could not salvage private keys from previous session; keys will be re-derived on first access",
        e,
      );
    }
    // Clear AFTER reading so decryptTemporaryStore can still use the old key.
    clearDerivedKeyCache();
  }

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

    // Every held phrase keyed by source id. A hash-key refresh starts from an
    // empty map and holds the phrases the caller unlocked with; a merge keeps
    // the phrases the session already holds. The unlocked phrase goes in
    // before the others: with nothing pinned, getDefaultMnemonic takes the
    // first held phrase.
    const mnemonics: MnemonicMap = { ...temporaryStore?.mnemonics };
    if (mnemonicPhrase && phraseSourceId) {
      mnemonics[phraseSourceId] = mnemonicPhrase;
    }
    Object.entries(otherMnemonics).forEach(([sourceId, phrase]) => {
      if (!mnemonics[sourceId]) {
        mnemonics[sourceId] = phrase;
      }
    });

    // Create the temporary store object
    const temporaryStoreObj = {
      ...temporaryStore,
      privateKeys: {
        ...temporaryStore?.privateKeys,
        ...preservedPrivateKeys,
        [activeKeyPair.id]: activeKeyPair.privateKey,
      },
      mnemonics,
    } as TemporaryStore;

    // Derive and cache the key — avoids the double-scrypt on
    // the next getTemporaryStore call (decryptTemporaryStore fast path).
    const derivedKey = await deriveKeyFromPassword({
      password: hashKeyObj.hashKey,
      saltParam: hashKeyObj.salt,
    });
    await setDerivedKeyCache(derivedKey);

    // Encrypt with the derived key directly (no scrypt inside)
    const encryptedData = encryptDataWithDerivedKey(
      JSON.stringify(temporaryStoreObj),
      derivedKey,
    );

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
  phraseSourceId,
  sourceId,
  derivationIndex,
  password,
  keyPair,
  accountNumber,
  accountName: requestedAccountName,
  shouldRefreshHashKey = true,
  shouldSetActiveAccount = true,
  importedFromSecretKey = false,
}: StoreAccountParams): Promise<void> => {
  const { publicKey, privateKey } = keyPair;

  if (derivationIndex !== undefined && !phraseSourceId) {
    throw new Error("A derivation index belongs to a phrase source");
  }
  if (!importedFromSecretKey && !mnemonicPhrase) {
    throw new Error("A derived account must carry its phrase");
  }
  if (importedFromSecretKey && mnemonicPhrase) {
    throw new Error("A secret-key import carries no phrase");
  }

  // A derived keystore keeps its phrase so sign-in can collect it; an
  // import's keystore says only that it is one. Provenance itself (type and
  // source) lives on the plain-storage account record, not in the keystore.
  const extra = mnemonicPhrase
    ? { imported: importedFromSecretKey, mnemonicPhrase }
    : { imported: importedFromSecretKey };

  const keyMetadata = {
    key: {
      extra,
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

  // Mark the index before anything else makes the account real. A mark that
  // failed after the account list write would leave a stored account whose
  // index the next add re-derives; a mark that succeeded before a later
  // failure leaves at worst a gap.
  if (derivationIndex !== undefined && phraseSourceId) {
    await markDerivationIndexUsed({
      sourceId: phraseSourceId,
      index: derivationIndex,
    });
  }

  const accountList = accountListRaw
    ? (JSON.parse(accountListRaw) as Account[])
    : [];
  const formatAccountName = (number: number) =>
    t("authStore.account", { number });
  const accountName =
    normalizeAccountName(requestedAccountName) ??
    (accountNumber !== undefined
      ? formatAccountName(accountNumber)
      : getNextDefaultAccountName(
          accountList.map(({ name }) => name),
          formatAccountName,
        ));

  // Listed before it is made active. An active id with no list entry makes
  // signIn recreate the account without knowing its source, so a write that
  // never lands must leave the account listed but inactive, not the reverse.
  await appendAccount({
    id: keyStore.id,
    sourceId,
    name: accountName,
    publicKey,
    importedFromSecretKey,
  });

  await Promise.all([
    shouldSetActiveAccount
      ? dataStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID, keyStore.id)
      : Promise.resolve(),
    createTemporaryStore({
      password,
      mnemonicPhrase,
      phraseSourceId,
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

/*
  A phrase generated for a new source in this wallet, held until the user has
  seen it and confirmed with their password. Module state rather than store
  state, so it never shows up in a store snapshot or a selector, and the
  screens never pass it back: `addRecoveryPhraseSource` reads it from here.
  Cleared once stored, when the flow is left, and on lock, log out or wipe.

  Each generation gets an id the screens carry instead of the phrase. The
  backup screen keeps the phrase it showed while the held one can be
  replaced underneath it (a second generation, e.g. from a double tap), so
  confirming must name the generation the user saw.
*/
let pendingRecoveryPhrase: { mnemonicPhrase: string; id: string } | null = null;
let pendingRecoveryPhraseCount = 0;

/**
 * Generates the phrase for a new source in an existing wallet and holds it
 * until `addRecoveryPhraseSource` stores it. Nothing is persisted. A second
 * call replaces the held phrase, so backing out and starting over never
 * stores the abandoned one.
 *
 * @returns The id of this generation, for the screens to pass along
 */
export const generatePendingRecoveryPhrase = (): string => {
  pendingRecoveryPhraseCount += 1;
  pendingRecoveryPhrase = {
    mnemonicPhrase: StellarHDWallet.generateMnemonic({ entropyBits: 128 }),
    // Unique within the process, which is all it has to be: the phrase never
    // outlives it.
    id: `pending-phrase-${pendingRecoveryPhraseCount}`,
  };
  return pendingRecoveryPhrase.id;
};

/**
 * The held phrase, if it's still the one generation `pendingPhraseId` made.
 *
 * @param {string} pendingPhraseId - The id `generatePendingRecoveryPhrase` returned
 */
export const getPendingRecoveryPhrase = (
  pendingPhraseId: string,
): string | null =>
  pendingPhraseId && pendingRecoveryPhrase?.id === pendingPhraseId
    ? pendingRecoveryPhrase.mnemonicPhrase
    : null;

/**
 * Drops the held phrase without storing it. With an id, only if it's still
 * that generation, so a screen going away can't drop a newer one.
 *
 * @param {string} [pendingPhraseId] - Limits the clear to that generation (optional)
 */
export const clearPendingRecoveryPhrase = (pendingPhraseId?: string): void => {
  if (
    pendingPhraseId === undefined ||
    pendingRecoveryPhrase?.id === pendingPhraseId
  ) {
    pendingRecoveryPhrase = null;
  }
};

/**
 * Clears all data from the key manager, temporary store (sensitive),
 * and non-sensitive data
 *
 * @returns {Promise<void>}
 */
const clearAllData = async (): Promise<void> => {
  clearDerivedKeyCache();
  clearCachedWalletSources();
  clearPendingRecoveryPhrase();

  const allKeys = await keyManager.loadAllKeyIds();

  await Promise.all([
    ...allKeys.map((key) => keyManager.removeKey(key)),
    clearTemporaryData(),
    clearNonSensitiveData(),
    // clearNonSensitiveData removes the map too; this also moves the epoch,
    // so a link pass from the replaced wallet stores nothing.
    clearLinkStatus(),
    dataStorage.remove(STORAGE_KEYS.COLLECTIBLES_LIST),
  ]);
};

/**
 * Resets the auto-lock setting to the default for a freshly established wallet
 * (first install, sign up, import, or wipe). Writes the default to both the
 * zustand store and the secure mirror and clears any stale background
 * timestamp, so a new wallet never inherits the previous one's policy — e.g. a
 * prior "None" would otherwise bake a never-expiring hash key. The secure
 * write is awaited so generateHashKey reads the default expiry, and so first
 * install lands on 24h even though the mirror was never written manually.
 *
 * It also clears the persisted LOCKED marker. Signing out and auto-lock write
 * it, and Forgot password wipes the wallet from that locked state; left
 * behind, it would soft-lock the next wallet as soon as it is set up.
 */
const resetAutoLockForNewWallet = async (): Promise<void> => {
  usePreferencesStore.setState({ autoLockTimer: DEFAULT_AUTO_LOCK_TIMER });
  await Promise.all([
    persistAutoLockTimer(DEFAULT_AUTO_LOCK_TIMER),
    clearBackgroundedAt(),
    secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.AUTH_STATUS),
  ]);
};

const getKeyFromKeyManager = async (
  password: string,
  activeAccountId?: string | null,
): Promise<Key> => {
  let accountId = activeAccountId;
  const allKeyIds = await keyManager.loadAllKeyIds();

  if (!accountId) {
    [accountId] = allKeyIds;
  }

  if (!accountId) {
    throw new Error(t("authStore.error.noKeyPairFound"));
  }

  // Pre-check: distinguish "key doesn't exist" from "wrong password".
  // Without this, keyManager.loadKey throws for both cases and we'd always
  // surface "invalid password" — misleading when key data is simply missing.
  if (!allKeyIds.includes(accountId)) {
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
 * @param {string} phraseSourceId - The source id the phrase is held under
 * @param {string} password - The password for encryption
 * @returns {Promise<void>}
 */
const verifyAndCreateExistingAccountsOnNetwork = async (
  mnemonicPhrase: string,
  phraseSourceId: string,
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
      index: i,
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

  // Store each key sequentially. The key manager maintains a shared allKeyIds
  // index via read-modify-write. Parallel storeKey calls race on that index and
  // cause some IDs to be silently dropped, producing the key-manager desync bug.
  const newAccounts = await newKeyPairs.reduce(
    async (
      accPromise: Promise<
        Array<{ account: Account; privateKey: string; id: string }>
      >,
      keyPair,
      index,
    ) => {
      const acc = await accPromise;
      const accountNumber = existingAccounts.length + index + 1;

      const keyStore = await keyManager.storeKey({
        key: {
          extra: { imported: false, mnemonicPhrase },
          type: KeyType.plaintextKey,
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey,
        },
        password,
        encrypterName: ScryptEncrypter.name,
      });

      // Mark the funded index before the account is written anywhere else,
      // as storeAccount does.
      await markDerivationIndexUsed({
        sourceId: phraseSourceId,
        index: keyPair.index,
      });

      acc.push({
        account: {
          id: keyStore.id,
          sourceId: phraseSourceId,
          name: t("authStore.account", { number: accountNumber }),
          publicKey: keyPair.publicKey,
          importedFromSecretKey: false,
        },
        privateKey: keyPair.privateKey,
        id: keyStore.id,
      });

      return acc;
    },
    Promise.resolve(
      [] as Array<{ account: Account; privateKey: string; id: string }>,
    ),
  );

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
  const updatedTemporaryStore: TemporaryStore = {
    ...latestTemporaryStore,
    privateKeys: updatedPrivateKeys,
    mnemonics: {
      ...latestTemporaryStore.mnemonics,
      [phraseSourceId]: mnemonicPhrase,
    },
  };

  // Convert to JSON and encrypt
  const temporaryStoreJson = JSON.stringify(updatedTemporaryStore);
  let encryptedData: string;
  if (derivedKeyCache) {
    encryptedData = encryptDataWithDerivedKey(
      temporaryStoreJson,
      derivedKeyCache,
    );
  } else {
    const derivedKey = await deriveKeyFromPassword({
      password: hashKey.hashKey,
      saltParam: hashKey.salt,
    });
    await setDerivedKeyCache(derivedKey);
    encryptedData = encryptDataWithDerivedKey(temporaryStoreJson, derivedKey);
  }

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
export function clearAccountData(
  options: { keepAccountsFiatTotals?: boolean } = {},
): void {
  // Clear balances data
  useBalancesStore.setState({
    balances: {},
    pricedBalances: {},
    scanResults: {},
    isLoading: false,
    isFunded: false,
    fetchedPublicKey: null,
    fetchedNetwork: null,
    subentryCount: 0,
    // Account-scoped, so the next account must not inherit it
    hiddenTokenIds: [],
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
    pricesByNetwork: {},
    sourceByNetwork: {},
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

  // Clear the wallets-list fiat totals by default, so one wallet lifetime's
  // totals can't bleed into the next (wipe → restore of the same seed).
  // Uses the store action (not setState) so any in-flight fetch cycle is
  // aborted too — otherwise it would write its pre-reset totals back a
  // moment after this wipe. Same-wallet transitions (account switch,
  // add/import account) opt out: the other accounts' totals are still
  // valid, and dropping them makes the open wallets sheet flash $0.00 on
  // every row mid-switch.
  if (!options.keepAccountsFiatTotals) {
    useAccountsFiatTotalsStore.getState().resetAccountsFiatTotals();
  }
}

/**
 * How far past the larger of the account count and the recovery scan to look
 * for a derived account's index. Pre-V2 builds started a new account at the
 * derived-account count and skipped keys the wallet already held, so an index
 * can sit past the current count once accounts have been removed.
 */
const INDEX_SEARCH_MARGIN = 10;

/**
 * The highest index to search for a wallet holding `accountCount` accounts.
 */
const indexSearchLimit = (accountCount: number): number =>
  Math.max(accountCount, ACCOUNTS_TO_VERIFY_ON_EXISTING_MNEMONIC_PHRASE) +
  INDEX_SEARCH_MARGIN;

/**
 * The index each of `publicKeys` sits at under `mnemonicPhrase`, searching
 * 0..`limit` and stopping once every key is found. A key not found is absent
 * from the result.
 */
const findDerivationIndices = (
  mnemonicPhrase: string,
  publicKeys: string[],
  limit: number,
): Map<string, number> => {
  const wanted = new Set(publicKeys);
  const found = new Map<string, number>();
  const wallet = StellarHDWallet.fromMnemonic(mnemonicPhrase);

  for (let index = 0; index <= limit && found.size < wanted.size; index += 1) {
    const publicKey = wallet.getPublicKey(index);
    if (wanted.has(publicKey) && !found.has(publicKey)) {
      found.set(publicKey, index);
    }
  }

  return found;
};

/**
 * Pre-V2 migration, unlock pass (port of the extension's #76). Runs at
 * sign-in while the password is in hand, and resolves every account recorded
 * before `Account.sourceId` existed.
 *
 * The extension also has an install pass that queues accounts in a
 * `pendingAttribution` list, writes hardware provenance and repairs legacy
 * `keyId` shapes. Mobile needs none of it: the plain-storage account list
 * already says which accounts are secret-key imports, an account with no
 * `sourceId` is the pending entry, and mobile has no hardware accounts or
 * legacy id shapes. Removing or recovering a wallet wipes the list, so stale
 * pending entries cannot outlive it either.
 *
 * - The wallet phrase (the one sign-in reads, which pre-V2 builds also took
 *   the analytics id from) is registered first so it takes "Seed Phrase 1"
 *   and, through addSecretSource, the pin. That keeps the pinned source equal
 *   to the wallet's existing `metrics_user_id`. This is the only place the
 *   pre-V2 identity rule applies; afterwards identity is the pinned source.
 * - Each derived account is rooted in that phrase and its actual index is
 *   marked. Mobile never had the extension's global counter, so there is no
 *   range to seed; the create-account skip loop still covers an index the
 *   search misses.
 * - Each secret-key import becomes its own "Secret Key N", in list order. Its
 *   key comes from the session's cached copy, else its keystore.
 *
 * The source registrations (each pins the first source if nothing is
 * pinned) and index marks are written before the account list, and all of them are idempotent, so a pass that fails part way
 * resumes on the next unlock. An account whose source cannot be derived stays
 * without one and can still sign. If the wallet holds a phrase whose id cannot
 * be derived, the pass writes nothing, so an import never takes the pin that
 * belongs to the phrase.
 *
 * Only adds data: no keystore is rewritten, and a downgraded build ignores
 * the new keys. Accounts that build adds carry no `sourceId`, so they are
 * attributed on the next unlock after upgrading again.
 *
 * @param {string} password - The password that just opened the active keystore
 * @param {string | undefined} mnemonicPhrase - The wallet phrase sign-in read, if any
 * @param {Function} resolvePhraseSourceId - That phrase's source id, or undefined
 * @returns {Promise<void>}
 */
const attributePendingAccounts = async (
  password: string,
  mnemonicPhrase: string | undefined,
  resolvePhraseSourceId: () => Promise<string | undefined>,
): Promise<void> => {
  const accountList = await getAllAccounts();
  const pending = accountList.filter((account) => !account.sourceId);

  if (!pending.length) {
    return;
  }

  // Registered before any import so the wallet phrase takes "Seed Phrase 1"
  // and, through addSecretSource, the pin, which never moves after that.
  // Outside the per-account catch: if the record or pin write fails, nothing
  // has been attributed and the whole pass retries. A held phrase whose id did
  // not resolve (the resolver has already logged why) ends the pass with
  // nothing written, so no import can take the pin; the next unlock retries.
  const phraseSourceId = await resolvePhraseSourceId();
  if (mnemonicPhrase && !phraseSourceId) {
    return;
  }
  if (phraseSourceId) {
    await addSecretSource({
      id: phraseSourceId,
      type: SecretSourceType.PHRASE,
    });
  }

  const pendingDerivedKeys = pending
    .filter(({ importedFromSecretKey }) => !importedFromSecretKey)
    .map(({ publicKey }) => publicKey);
  const derivationIndices =
    phraseSourceId && mnemonicPhrase && pendingDerivedKeys.length
      ? findDerivationIndices(
          mnemonicPhrase,
          pendingDerivedKeys,
          indexSearchLimit(accountList.length),
        )
      : new Map<string, number>();

  // The session was just rebuilt or verified, so LOCKED passes the read gate
  // the same way createTemporaryStore's merge path does.
  const temporaryStore = await getTemporaryStore(AUTH_STATUS.LOCKED);

  const resolveSourceId = async (
    account: Account,
  ): Promise<string | undefined> => {
    if (!account.importedFromSecretKey) {
      if (!phraseSourceId) {
        return undefined;
      }
      const index = derivationIndices.get(account.publicKey);
      if (index !== undefined) {
        await markDerivationIndexUsed({ sourceId: phraseSourceId, index });
      }
      return phraseSourceId;
    }

    const privateKey =
      temporaryStore?.privateKeys?.[account.id] ??
      (await keyManager.loadKey(account.id, password)).privateKey;

    if (!privateKey) {
      return undefined;
    }

    const sourceId = await getSecretKeySourceId(privateKey);
    await addSecretSource({ id: sourceId, type: SecretSourceType.SECRET_KEY });
    return sourceId;
  };

  // Sequential, in list order, so "Secret Key N" follows the order the
  // imports were added.
  const updatedAccountList = await accountList.reduce(
    async (accPromise: Promise<Account[]>, account) => {
      const acc = await accPromise;

      if (account.sourceId) {
        acc.push(account);
        return acc;
      }

      try {
        const sourceId = await resolveSourceId(account);
        acc.push(sourceId ? { ...account, sourceId } : account);
      } catch (error) {
        logger.error(
          "attributePendingAccounts",
          "Failed to attribute an account to its source",
          error,
        );
        acc.push(account);
      }

      return acc;
    },
    Promise.resolve([] as Account[]),
  );

  await dataStorage.setItem(
    STORAGE_KEYS.ACCOUNT_LIST,
    JSON.stringify(updatedAccountList),
  );
};

/**
 * Loads into the temporary store the private key of every account it does not
 * hold yet, with the password sign-in just verified.
 *
 * The extension's unlock opens every keystore; mobile holds only the keys it
 * has touched (the active one, accounts added this session, and keys carried
 * over from the previous store), and getActiveAccount fills the rest one at a
 * time. Enumerating the wallet's sources needs every account's key, so the
 * gaps are filled here, while the password is in hand. Usually nothing is
 * missing and this opens no keystore.
 *
 * @param {string} password - The password that just opened the active keystore
 * @returns {Promise<void>}
 */
const loadMissingPrivateKeys = async (password: string): Promise<void> => {
  // The session was just rebuilt or verified, so LOCKED passes the read gate
  // the same way attributePendingAccounts does.
  const temporaryStore = await getTemporaryStore(AUTH_STATUS.LOCKED);
  const hashKey = await getHashKey();

  if (!temporaryStore || !hashKey) {
    return;
  }

  const missing = (await getAllAccounts()).filter(
    ({ id }) => !temporaryStore.privateKeys?.[id],
  );

  // Sequential: each keystore open runs its own KDF.
  await missing.reduce(async (storePromise, { id }) => {
    const store = await storePromise;

    try {
      const { privateKey } = await keyManager.loadKey(id, password);
      return privateKey
        ? // Defined below; resolved at call time.
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          await updateTemporaryStoreWithPrivateKey(
            store,
            id,
            privateKey,
            hashKey,
          )
        : store;
    } catch (error) {
      // One unreadable keystore must not keep the others out.
      logger.error(
        "loadMissingPrivateKeys",
        "Failed to load an account's private key",
        error,
      );
      return store;
    }
  }, Promise.resolve(temporaryStore));
};

/** The phrase a keystore carries; a secret-key import's carries none. */
const readPhrase = (key: Key): string | undefined =>
  (key.extra as { mnemonicPhrase?: string } | undefined)?.mnemonicPhrase ||
  undefined;

/**
 * Opens the given keystores in order and returns the first phrase one yields.
 * A keystore that fails to open is logged and the next one is tried.
 *
 * @param {string[]} accountIds - The keystores to try, in order
 * @param {string} password - The password that opens them
 * @returns {Promise<string | undefined>} The phrase, or undefined when none yields one
 */
const readPhraseFromKeystores = async (
  accountIds: string[],
  password: string,
): Promise<string | undefined> =>
  // Sequential: each keystore open runs its own KDF, and the first hit ends
  // the search.
  accountIds.reduce(async (foundPromise: Promise<string | undefined>, id) => {
    const found = await foundPromise;
    if (found) {
      return found;
    }
    try {
      return readPhrase(await keyManager.loadKey(id, password));
    } catch (error) {
      logger.error(
        "signIn",
        "Failed to open a derived keystore for the wallet phrase",
        error,
      );
      return undefined;
    }
  }, Promise.resolve(undefined));

/**
 * Reads every phrase source the wallet's derived accounts are rooted in, other
 * than the one sign-in already holds, so a full unlock holds all of them.
 *
 * Each source's keystores are tried in list order until one yields its
 * phrase. The phrase is derived to confirm it is the recorded source and is
 * held under the id it derives; a mismatch is logged. A source none of whose
 * keystores opens is logged and left out: its accounts can still sign once
 * their keys load, but adding an account to it fails until the next unlock.
 *
 * Accounts with no `sourceId` are not grouped. They predate per-source
 * attribution, when a wallet had one phrase, so the held phrase covers them.
 *
 * @param {Object} input - The input parameters
 * @param {Account[]} input.accountList - The wallet's accounts
 * @param {string} input.password - The password that opens their keystores
 * @param {string} [input.heldSourceId] - The source sign-in already holds (optional)
 * @returns {Promise<{ mnemonics: MnemonicMap; signers: Map<string, Keypair> }>} The phrases and their keypairs, by source id
 */
const loadOtherPhraseSources = async ({
  accountList,
  password,
  heldSourceId,
}: {
  accountList: Account[];
  password: string;
  heldSourceId?: string;
}): Promise<{ mnemonics: MnemonicMap; signers: Map<string, Keypair> }> => {
  const accountIdsBySource = new Map<string, string[]>();
  accountList.forEach(({ id, sourceId, importedFromSecretKey }) => {
    if (importedFromSecretKey || !sourceId || sourceId === heldSourceId) {
      return;
    }
    accountIdsBySource.set(sourceId, [
      ...(accountIdsBySource.get(sourceId) ?? []),
      id,
    ]);
  });

  const mnemonics: MnemonicMap = {};
  const signers = new Map<string, Keypair>();

  // Sequential, like the keystore opens inside each source.
  await [...accountIdsBySource].reduce(
    async (previous, [sourceId, accountIds]) => {
      await previous;

      const phrase = await readPhraseFromKeystores(accountIds, password);
      if (!phrase) {
        logger.error(
          "signIn",
          "No keystore of a phrase source yields its phrase",
          new Error("Phrase source unreadable"),
        );
        return;
      }

      try {
        const { userId, keypair } = await deriveAuthKeypair(phrase);
        if (userId !== sourceId) {
          logger.error(
            "signIn",
            "A keystore's phrase does not derive its account's recorded source",
            new Error("Phrase source id mismatch"),
          );
        }
        mnemonics[userId] = phrase;
        signers.set(userId, keypair);
      } catch (error) {
        logger.error(
          "signIn",
          "Failed to derive a phrase source on unlock",
          error,
        );
      }
    },
    Promise.resolve(),
  );

  return { mnemonics, signers };
};

/**
 * Logs in the user with the provided password
 *
 * Validates the password against the stored key, loads the account data,
 * and creates a new temporary store with the sensitive information.
 *
 * @param {SignInParams} params - The signin parameters
 * @returns {Promise<{ phraseSigners: Map<string, Keypair> }>} The phrase keypairs it derived, by source id
 */
const signIn = async ({
  password,
  shouldCreateTempStore = true,
}: SignInParams & { shouldCreateTempStore?: boolean }): Promise<{
  phraseSigners: Map<string, Keypair>;
}> => {
  const activeAccountId = await dataStorage.getItem(
    STORAGE_KEYS.ACTIVE_ACCOUNT_ID,
  );

  const loadedKey = await getKeyFromKeyManager(password, activeAccountId);

  const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);
  const accountList = JSON.parse(accountListRaw ?? "[]") as Account[];

  /*
    The wallet phrase. A derived keystore carries it; a secret-key import
    carries none, so when an import is active the phrase is read from the
    wallet's derived keystores instead, in list order, until one yields it: a
    keystore that fails to open is logged and the next one is tried. A wallet
    with no readable derived keystore holds no phrase at all: it can still
    sign, and adding an account or showing the phrase reports that there is
    none.
  */
  let mnemonicPhrase = readPhrase(loadedKey);
  if (!mnemonicPhrase) {
    mnemonicPhrase = await readPhraseFromKeystores(
      accountList
        .filter(
          ({ id, importedFromSecretKey }) =>
            id !== loadedKey.id && !importedFromSecretKey,
        )
        .map(({ id }) => id),
      password,
    );
  }

  // The held phrase's source id, derived at most once per sign-in and only
  // when a caller needs it, so the soft-unlock fast path pays no PBKDF2 here.
  // A phrase whose id cannot be derived resolves to undefined: the active
  // private key is already in hand, so the account can still sign. The
  // keypair comes along so the wallet sources warm-up does not derive the
  // phrase a second time.
  const phraseSigners = new Map<string, Keypair>();
  let phraseSourceIdPromise: Promise<string | undefined> | null = null;
  const resolvePhraseSourceId = (): Promise<string | undefined> => {
    if (!phraseSourceIdPromise) {
      phraseSourceIdPromise = mnemonicPhrase
        ? deriveAuthKeypair(mnemonicPhrase).then(
            ({ userId, keypair }) => {
              phraseSigners.set(userId, keypair);
              return userId;
            },
            (error: unknown) => {
              logger.error(
                "signIn",
                "Failed to derive the phrase source id on unlock",
                error,
              );
              return undefined;
            },
          )
        : Promise.resolve(undefined);
    }
    return phraseSourceIdPromise;
  };

  let account = accountList.find((a) => a.id === activeAccountId);

  if (!account) {
    // Keychain has a key for activeAccountId but the AsyncStorage
    // ACCOUNT_LIST doesn't have a matching entry - keychain/AsyncStorage
    // drift. The next lines recover by recreating the account from the
    // loaded key. Worth a breadcrumb (warn) so we have visibility if the
    // recovery itself ever fails downstream, but not an error since
    // the user-visible flow keeps working.
    logger.warn(
      "signIn",
      "Active account ID missing from account list, recreating from keychain key",
    );

    // A secret-key import is its own source. Earlier builds stamped the
    // wallet phrase into imports too, so a key its keystore's phrase does not
    // derive is an import as well. A derived key past the search reads as an
    // import, which never claims the phrase restores a key it does not.
    const keystorePhrase = readPhrase(loadedKey);
    const importedFromSecretKey =
      !keystorePhrase ||
      !findDerivationIndices(
        keystorePhrase,
        [loadedKey.publicKey],
        indexSearchLimit(accountList.length + 1),
      ).has(loadedKey.publicKey);
    const sourceId = importedFromSecretKey
      ? await getSecretKeySourceId(loadedKey.privateKey).catch(
          (error: unknown) => {
            logger.error(
              "signIn",
              "Failed to derive the imported key's source id",
              error,
            );
            return undefined;
          },
        )
      : await resolvePhraseSourceId();

    account = {
      id: loadedKey.id,
      sourceId,
      name: t("authStore.account", { number: accountList.length + 1 }),
      publicKey: loadedKey.publicKey,
      importedFromSecretKey,
    };

    await appendAccount(account);
  }

  // Rebuilds the session from the keystore just opened, holding the wallet
  // phrase (if any) under its source id, and every other phrase source the
  // derived accounts are rooted in. The rebuild starts from an empty phrase
  // map, so a source not read here would drop out of the session. The LOCKED
  // fast path keeps the existing session and opens none of these keystores.
  const rebuildSession = async () => {
    const phraseSourceId = await resolvePhraseSourceId();
    const otherSources = await loadOtherPhraseSources({
      accountList,
      password,
      heldSourceId: phraseSourceId,
    });
    otherSources.signers.forEach((keypair, sourceId) =>
      phraseSigners.set(sourceId, keypair),
    );

    await createTemporaryStore({
      password,
      mnemonicPhrase,
      phraseSourceId,
      otherMnemonics: otherSources.mnemonics,
      activeKeyPair: {
        publicKey: loadedKey.publicKey,
        privateKey: loadedKey.privateKey,
        accountName: account.name,
        id: loadedKey.id,
      },
      shouldRefreshHashKey: true,
    });
  };

  // Handle temporary store based on whether it's a fresh login or unlock
  if (shouldCreateTempStore) {
    await rebuildSession();
  } else {
    // LOCKED path only: session data is intact on disk. Only refresh the hash
    // key TTL so the existing temp store (and derived key cache) remain valid.
    // This avoids generateHashKey (scrypt) + reEncryptTemporaryStore (2× scrypt).
    // Note: HASH_KEY_EXPIRED sets shouldCreateTempStore=true, so it never reaches
    // this branch — it always goes through the full createTemporaryStore above.
    //
    // Edge case: if DERIVED_KEY in SecureStorage is stale (e.g. from a different
    // password epoch due to a mid-flight setDerivedKeyCache failure),
    // decryptTemporaryStore will throw and getTemporaryStore will clear +
    // force re-auth. This is the correct safe fallback.
    const existingHashKey = await getHashKey();
    const existingTempStore = await secureDataStorage.getItem(
      SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    );
    if (existingHashKey && existingTempStore) {
      // Fast path: temp store is intact — just refresh the hard-expiry TTL.
      // Re-anchor generatedAt too (this is a credential-verified moment) so the
      // clock-rollback backstop stays aligned with the new expiry.
      const refreshNow = Date.now();
      await secureDataStorage.setItem(
        SENSITIVE_STORAGE_KEYS.HASH_KEY,
        JSON.stringify({
          ...existingHashKey,
          expiresAt: refreshNow + HASH_KEY_EXPIRATION_MS,
          generatedAt: refreshNow,
        }),
      );
    } else {
      // Hash key or temp store missing — rebuild session.
      await rebuildSession();
    }
  }

  // Before attribution, so it finds every import's key already held instead
  // of opening the keystore itself.
  try {
    await loadMissingPrivateKeys(password);
  } catch (error) {
    // Only the wallet sources miss these keys; the active one is held.
    logger.error("signIn", "Failed to load missing private keys", error);
  }

  try {
    await attributePendingAccounts(
      password,
      mnemonicPhrase,
      resolvePhraseSourceId,
    );
  } catch (error) {
    // Attribution must never lock the user out; the next unlock retries.
    logger.error("signIn", "Failed to attribute pre-V2 accounts", error);
  }

  // Repairs a pin write that failed after its source record landed. The
  // request path (getSigningIdentity) never writes the pin, so this and
  // registration (addSecretSource) are the only repairs.
  try {
    await pinFirstSource();
  } catch (error) {
    logger.error("signIn", "Failed to repair the pinned source", error);
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

  return { phraseSigners };
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
    const phraseSourceId = await getPhraseSourceId(mnemonicPhrase);

    clearAccountData();
    await clearAllData();

    // Store the account in the key manager and create the temporary store.
    // A new phrase's first account is its index 0.
    await storeAccount({
      mnemonicPhrase,
      phraseSourceId,
      sourceId: phraseSourceId,
      derivationIndex: 0,
      password,
      keyPair,
    });
    await addSecretSource({
      id: phraseSourceId,
      type: SecretSourceType.PHRASE,
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
    const phraseSourceId = await getPhraseSourceId(mnemonicPhrase);

    clearAccountData();
    await clearAllData();

    // Store the account in the key manager and create the temporary store.
    // A recovery starts the wallet afresh (clearAllData dropped every index
    // set); the recovered phrase rebuilds its own from index 0, and the
    // network discovery below records every funded index it finds.
    await storeAccount({
      mnemonicPhrase,
      phraseSourceId,
      sourceId: phraseSourceId,
      derivationIndex: 0,
      password,
      keyPair,
    });
    await addSecretSource({
      id: phraseSourceId,
      type: SecretSourceType.PHRASE,
    });

    await verifyAndCreateExistingAccountsOnNetwork(
      mnemonicPhrase,
      phraseSourceId,
      password,
      AUTH_STATUS.AUTHENTICATED,
    );

    // Restoring a wallet from a recovery phrase is account_recovery.*, NOT
    // account.import* (that is the secret-key path). This corrects a
    // cross-platform mislabel — the extension already classifies it this way.
    analytics.track(AnalyticsEvent.RECOVER_ACCOUNT_SUCCESS, {
      recovery_method: "recovery_phrase",
    });
  } catch (error) {
    // Scrub Stellar StrKeys before sending to analytics — this is a
    // third-party sink (Amplitude) not covered by Sentry's beforeSend, and the
    // forwarded message can include uncontrolled native error text.
    const importFailureMessage =
      error instanceof Error ? error.message : String(error);
    analytics.track(AnalyticsEvent.RECOVER_ACCOUNT_FAIL, {
      reason_code: scrubStrKeys(importFailureMessage) ?? importFailureMessage,
    });
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

  // Prefer cached derived key (no scrypt); fall back to full derivation only if
  // cache is cold (e.g. after an app restart that puts us back in LOCKED state).
  let encryptedData: string;
  if (derivedKeyCache) {
    encryptedData = encryptDataWithDerivedKey(tempStoreJson, derivedKeyCache);
    await setDerivedKeyCache(derivedKeyCache); // keep SecureStorage in sync in case a previous write failed silently
  } else {
    const derivedKey = await deriveKeyFromPassword({
      password: hashKey.hashKey,
      saltParam: hashKey.salt,
    });
    await setDerivedKeyCache(derivedKey);
    encryptedData = encryptDataWithDerivedKey(tempStoreJson, derivedKey);
  }

  await secureDataStorage.setItem(
    SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
    encryptedData,
  );

  return updatedTempStore;
};

/**
 * Attempts to derive a private key for a given account from any held phrase,
 * trying the first 50 indices of each phrase in turn
 *
 * @param {MnemonicMap} mnemonics - Every held phrase keyed by source id
 * @param {string} publicKey - The public key to match
 * @returns {string | null} The derived private key or null if not found
 */
const derivePrivateKeyFromMnemonics = (
  mnemonics: MnemonicMap,
  publicKey: string,
): string | null => {
  const indicesToTry = Array.from({ length: 50 }, (_, i) => i);
  const phrases = Object.values(mnemonics);

  for (let i = 0; i < phrases.length; i += 1) {
    const wallet = StellarHDWallet.fromMnemonic(phrases[i]);
    const matchingIndex = indicesToTry.find(
      (index) => wallet.getPublicKey(index) === publicKey,
    );

    if (matchingIndex !== undefined) {
      return wallet.getSecret(matchingIndex);
    }
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

  const account = findAccountById(
    JSON.parse(accountListRaw) as Account[],
    activeAccountId,
  );

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
        // Try to derive from a held phrase (which is in the temp store)
        const derivedKey = derivePrivateKeyFromMnemonics(
          temporaryStore.mnemonics,
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
  // Resolve before touching anything: an unknown key throws and leaves the
  // stored names as they were.
  const account = findAccountByPublicKey(accountList, publicKey);

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
 * Creates a new account at its phrase's lowest unused derivation index,
 * storing the account in the key manager and merging it into the session.
 *
 * The phrase to derive from: the one `requestedSourceId` names, else the
 * active account's phrase, else the pinned source or the first held phrase.
 * A chooser that always names one is still to come; the implicit cases cover
 * a one-phrase wallet until then. A derived account joins its phrase; it is
 * not a new source.
 *
 * @param {string} password - The user's password, verified against the active keystore first
 * @param {AuthStatus} authStatus - Current auth status, gating the session read
 * @param {string} [requestedSourceId] - The phrase source to derive from (optional)
 * @param {string} [accountName] - The new account's name; absent or blank, the next default name (optional)
 * @returns {Promise<void>}
 */
const createAccount = async (
  password: string,
  authStatus: AuthStatus,
  requestedSourceId?: string,
  accountName?: string,
): Promise<void> => {
  // Verifies the password before anything is derived: the new keystore is
  // encrypted with it, so a wrong one must fail here, not produce a keystore
  // the wallet can never open.
  await getKeyFromKeyManager(password);

  const temporaryStore = await getTemporaryStore(authStatus);
  if (!temporaryStore) {
    throw new Error(t("authStore.error.temporaryStoreNotFound"));
  }
  const { mnemonics } = temporaryStore;
  const allAccounts = await getAllAccounts();

  const resolveSource = async () => {
    if (requestedSourceId) {
      return getHeldMnemonic({ mnemonics, sourceId: requestedSourceId });
    }

    const activeAccountId = await dataStorage.getItem(
      STORAGE_KEYS.ACTIVE_ACCOUNT_ID,
    );
    const active = allAccounts.find(({ id }) => id === activeAccountId);
    const fromActive = active?.sourceId
      ? getHeldMnemonic({ mnemonics, sourceId: active.sourceId })
      : null;

    return fromActive || getDefaultMnemonic({ mnemonics });
  };

  const source = await resolveSource();

  if (!source) {
    throw new Error(
      t(
        requestedSourceId
          ? "authStore.error.unknownRecoveryPhrase"
          : "authStore.error.noRecoveryPhrase",
      ),
    );
  }

  const { mnemonic: mnemonicPhrase, sourceId } = source;

  /*
    Derive at the phrase's lowest unused index. If that key is already an
    account, the index set has fallen behind the accounts (a wallet from
    before the sets existed): mark the index used and move on to the next. At
    most every held account can collide, so the loop is bounded by the account
    count plus one. The set is read once; the skipped indices stand in for the
    marks until the loop ends.
  */
  const heldPublicKeys = new Set(allAccounts.map(({ publicKey }) => publicKey));
  const wallet = StellarHDWallet.fromMnemonic(mnemonicPhrase);
  const usedIndices = await getDerivationIndices(sourceId);
  const skipped: number[] = [];
  let derivationIndex = lowestUnusedIndex(usedIndices);
  let keyPair: KeyPair | null = null;

  while (!keyPair && skipped.length <= heldPublicKeys.size) {
    const publicKey = wallet.getPublicKey(derivationIndex);

    if (heldPublicKeys.has(publicKey)) {
      skipped.push(derivationIndex);
      derivationIndex = lowestUnusedIndex([...usedIndices, ...skipped]);
    } else {
      keyPair = { publicKey, privateKey: wallet.getSecret(derivationIndex) };
    }
  }

  if (skipped.length) {
    await skipped.reduce(async (previous, index) => {
      await previous;
      await markDerivationIndexUsed({ sourceId, index });
    }, Promise.resolve());
    logger.error(
      "createAccount",
      "Derivation index set was missing indices the wallet already holds",
      new Error("Derivation index set was missing indices"),
      { sourceId, skipped },
    );
  }

  if (!keyPair) {
    throw new Error(`No free derivation index found for source ${sourceId}`);
  }

  await storeAccount({
    mnemonicPhrase,
    phraseSourceId: sourceId,
    sourceId,
    derivationIndex,
    password,
    keyPair,
    accountName,
    shouldRefreshHashKey: false,
  });
};

/**
 * Stores the held phrase as a new phrase source and derives its first
 * account, at index 0, which becomes active. The wallet it joins may hold any
 * mix of sources, or no phrase at all (a secret-key wallet), so the password
 * is checked against the active keystore, as an import checks it.
 *
 * Unlike sign-up, this adds to a live wallet: it never clears data, and the
 * new phrase joins the phrases the session already holds.
 *
 * @param {string} password - The user's password, verified against the active keystore first
 * @param {AuthStatus} authStatus - Current auth status, gating the session read
 * @param {string} pendingPhraseId - The generation the user backed up; refused if another replaced it
 * @param {string} [accountName] - The new account's name; absent or blank, the next default name (optional)
 * @returns {Promise<void>}
 */
const addRecoveryPhraseSource = async (
  password: string,
  authStatus: AuthStatus,
  pendingPhraseId: string,
  accountName?: string,
): Promise<void> => {
  // A replaced generation reads as missing: the held phrase isn't the one
  // the user saw.
  const mnemonicPhrase = getPendingRecoveryPhrase(pendingPhraseId);
  if (!mnemonicPhrase) {
    throw new Error(t("authStore.error.pendingRecoveryPhraseMissing"));
  }

  // The new keystore is encrypted with the password, so a wrong one must
  // fail here, not produce a keystore the wallet can never open.
  await getKeyFromKeyManager(password);

  const temporaryStore = await getTemporaryStore(authStatus);
  if (!temporaryStore) {
    throw new Error(t("authStore.error.temporaryStoreNotFound"));
  }

  const sourceId = await getPhraseSourceId(mnemonicPhrase);
  const keyPair = deriveKeyPair({ mnemonicPhrase });

  // A generated phrase colliding is not a real case, but these checks are
  // what keep two sources or two accounts from sharing an id or an address.
  if ((await getSecretSources())[sourceId]) {
    throw new Error(t("authStore.error.recoveryPhraseAlreadyHeld"));
  }
  if (hasAccountInAccountList(await getAllAccounts(), keyPair)) {
    throw new Error(t("authStore.error.accountAlreadyExists"));
  }

  await storeAccount({
    mnemonicPhrase,
    phraseSourceId: sourceId,
    sourceId,
    derivationIndex: 0,
    password,
    keyPair,
    accountName,
    shouldRefreshHashKey: false,
  });
  await addSecretSource({
    id: sourceId,
    type: SecretSourceType.PHRASE,
  });

  clearPendingRecoveryPhrase();
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

    // An import needs the unlocked session to merge its private key into.
    // No phrase is involved: the import is its own source, registered below
    // from its own key, and nothing of any phrase is written into it.
    const temporaryStore = await getTemporaryStore(authStatus);
    if (!temporaryStore) {
      throw new Error(t("authStore.error.temporaryStoreNotFound"));
    }

    const sourceId = await getSecretKeySourceId(secretKey);

    await storeAccount({
      sourceId,
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
    await addSecretSource({
      id: sourceId,
      type: SecretSourceType.SECRET_KEY,
    });

    // account.imported carries import_method (secret-key path).
    analytics.track(AnalyticsEvent.ACCOUNT_SCREEN_IMPORT_ACCOUNT, {
      import_method: "secret_key",
    });
  } catch (error) {
    // Scrub Stellar StrKeys before sending to analytics — third-party sink
    // (Amplitude) not covered by Sentry's beforeSend.
    const importFailureMessage =
      error instanceof Error ? error.message : String(error);
    analytics.trackAccountScreenImportAccountFail(
      scrubStrKeys(importFailureMessage) ?? importFailureMessage,
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
  // Resolve before touching anything: an unknown key throws and leaves the
  // active account as it was.
  const { id } = findAccountByPublicKey(await getAllAccounts(), publicKey);

  await dataStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID, id);
};

const clearBiometricsData = async (): Promise<void> => {
  usePreferencesStore.getState().setIsBiometricsEnabled(false);
  await Promise.all([
    dataStorage.remove(STORAGE_KEYS.HAS_SEEN_BIOMETRICS_ENABLE_SCREEN),
    biometricDataStorage.clear(),
  ]);
};

/**
 * Returns a user-safe error message. Known translated auth errors (thrown as
 * `new Error(t("authStore.error.*"))`) are passed through; anything else is
 * replaced with the generic `fallbackKey`. The caller logs the raw error to
 * Sentry.
 */
export const getUserFacingError = (
  error: unknown,
  fallbackKey: string,
): string => {
  // Plain, user-understandable messages pass through. Cryptographic/internal
  // jargon (noKeyPairFound, hashKeyNotFound, temporaryStoreNotFound,
  // privateKeyNotFound) is intentionally excluded so it falls back to the
  // friendly generic copy instead of surfacing technical terms to the user.
  const safeMessages = new Set<string>([
    t("authStore.error.invalidPassword"),
    t("authStore.error.invalidMnemonicPhrase"),
    t("authStore.error.accountAlreadyExists"),
    t("authStore.error.accountNotFound"),
    t("authStore.error.accountListNotFound"),
    t("authStore.error.noActiveAccount"),
    t("authStore.error.noRecoveryPhrase"),
    t("authStore.error.unknownRecoveryPhrase"),
    t("authStore.error.pendingRecoveryPhraseMissing"),
    t("authStore.error.recoveryPhraseAlreadyHeld"),
    t("authStore.error.authenticationExpired"),
    t("authStore.error.failedToReEncryptData"),
    t("authStore.error.failedToDecryptData"),
  ]);

  return error instanceof Error && safeMessages.has(error.message)
    ? error.message
    : t(fallbackKey);
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
      // User-typed mnemonic validation. Invalid input here is the
      // expected failure mode (this is the verify step), not a bug -
      // the caller displays the error via the store's `error` field.
      // Emit only a breadcrumb so the diagnostic is preserved if a
      // downstream auth event captures it.
      logger.warn("verifyMnemonicPhrase", "Invalid mnemonic phrase", error);
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
      const temporaryStore = await getTemporaryStore(get().authStatus);
      if (!temporaryStore) {
        return false;
      }
      const { password } = temporaryStore;
      if (!password) {
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
        "Failed to initialize biometric password from temporary store",
        error,
      );
      return false;
    }
  },

  /**
   * Logs out the user by clearing sensitive data.
   *
   * When there are existing accounts and `shouldWipeAllData` is false, it preserves
   * account data and relevant sensitive info, sets the auth status to
   * `AUTH_STATUS.LOCKED`, and navigates to the lock screen.
   * When `shouldWipeAllData` is true or there are no existing accounts, it performs
   * a full logout and clears all user data.
   *
   * @param {boolean} [shouldWipeAllData=false] - If true, performs a full logout and
   * clears all user data; if false, keeps existing account data and locks the app.
   */
  logout: (shouldWipeAllData = false) => {
    set((state) => ({ ...state, isLoading: true, error: null }));
    clearPendingRecoveryPhrase();

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
            clearCachedWalletSources();

            set({
              account: null,
              isLoadingAccount: false,
              accountError: null,
              authStatus: AUTH_STATUS.LOCKED,
              // The user locked the app themselves — don't auto-prompt
              // biometrics on the lock screen; that only fires on cold start
              // or return from the background.
              suppressBiometricAutoPrompt: true,
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
                routes: [
                  {
                    name: ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN,
                    params: { autoFocus: true },
                  },
                ],
              });
            }
          } else {
            // Wipe path: clear derived key cache and use resetRoot so the auth screen is
            // visible before the long async cleanup begins.
            clearDerivedKeyCache();
            clearCachedWalletSources();

            // A reset leads into onboarding, which must not show the rebrand
            // announcement. Written first so a failed or interrupted wipe
            // cannot leave it pending.
            await markRebrandAnnouncementSeen();

            // Capture navigationRef before ...initialState clears it to null
            const { navigationRef: navRef } = get();
            clearAccountData();
            set({
              ...initialState,
              authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
              isLoading: true,
            });

            if (navRef && navRef.isReady()) {
              navRef.resetRoot({
                index: 0,
                routes: [{ name: ROOT_NAVIGATOR_ROUTES.AUTH_STACK }],
              });
            }

            // Make sure to disconnect all WalletConnect sessions first
            await useWalletKitStore.getState().disconnectAllSessions();

            // Clear all Wallet Connect storage
            await clearWalletKitStorage();

            // Clear all WebView data (cookies and screenshots) and the
            // screenshot DEK. The DEK lives outside clearTemporaryData so
            // that non-wipe paths (signUp/importWallet, decryption-failure
            // recovery) don't orphan still-referenced screenshot files.
            await clearAllWebViewData();
            await clearScreenshotDek();
            useBrowserTabsStore.getState().closeAllTabs();

            // Clear all recent protocols data
            useRecentProtocolsStore.getState().clearRecentProtocols();

            await clearTemporaryData();
            await clearNonSensitiveData();
            await clearLinkStatus();
            await dataStorage.remove(STORAGE_KEYS.COLLECTIBLES_LIST);

            // Reset auto-lock so the next wallet on this device doesn't
            // inherit the previous user's timer. The awaited secure-mirror
            // write (source of truth for getAuthStatus / generateHashKey)
            // means an interrupted wipe can't leave a weaker policy — e.g.
            // NONE's never-expire — behind for the next wallet.
            await resetAutoLockForNewWallet();

            await clearBiometricsData();

            set({ isLoading: false });
          }
        } catch (error) {
          logger.error("logout", "Failed to logout", error);

          set({
            error: getUserFacingError(error, "authStore.error.failedToLogout"),
            isLoading: false,
          });
        }
      })();
    }, 0);
  },

  /**
   * Soft-locks the wallet in-process (auto-lock timer).
   *
   * Unlike logout(), keeps the navigation tree mounted under the lock overlay
   * so the user resumes where they were after unlocking. Sensitive reads stay
   * gated while LOCKED (getActiveAccount, WalletKit). The active account is
   * left in the store so the mounted screens don't re-run validations and flash
   * errors; signing is independently blocked while LOCKED. Persisting LOCKED
   * covers cold starts (which fall back to the LockScreen route).
   */
  softLock: async (options?: { suppressBiometricPrompt?: boolean }) => {
    Keyboard.dismiss();
    // A phrase not yet confirmed doesn't outlive the session that made it.
    clearPendingRecoveryPhrase();

    // Atomic update: RootNavigator must never see LOCKED && !isSoftLocked
    // (it would unmount the preserved tree). Clear account so the decrypted
    // private key isn't held while locked — it re-populates on unlock.
    set({
      authStatus: AUTH_STATUS.LOCKED,
      isSoftLocked: true,
      account: null,
      // A foreground-idle lock suppresses the lock screen's biometric
      // auto-prompt; background / cold-start locks still prompt.
      suppressBiometricAutoPrompt: options?.suppressBiometricPrompt ?? false,
      isLoading: false,
    });
    clearCachedWalletSources();

    // Persist LOCKED (covers tampering + cold starts). Retry once and rethrow
    // on failure: a swallowed write would leave the wallet auto-unlockable on
    // the next cold launch.
    try {
      await secureDataStorage.setItem(
        SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
        AUTH_STATUS.LOCKED,
      );
    } catch (firstError) {
      logger.error(
        "softLock",
        "Failed to persist LOCKED status, retrying",
        firstError,
      );
      await secureDataStorage.setItem(
        SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
        AUTH_STATUS.LOCKED,
      );
    }
  },

  /**
   * Signs up a new user with the provided credentials
   *
   * @param {SignUpParams} params - The signup parameters
   * @returns {Promise<boolean>} `true` on success, `false` on failure
   */
  signUp: async (params): Promise<boolean> => {
    set((state) => ({ ...state, isLoading: true, error: null }));
    try {
      // Fresh wallet: reset auto-lock to the default before the hash key is
      // generated so it doesn't inherit a previous wallet's timer.
      await resetAutoLockForNewWallet();
      await signUp(params);
      // Mirror the extension's onboarding.password_created (createAccount.fulfilled)
      // so the create-password funnel has a success side on mobile (was fail-only).
      analytics.track(AnalyticsEvent.CREATE_PASSWORD_SUCCESS);
      // onboarding.completed at the single create-account terminal point (mirrors
      // the extension's confirmMnemonicPhrase.fulfilled). Consolidated here from
      // four UI-site emits (recovery-phrase / biometrics screens) that risked
      // double-counting. The import/recover flow emits account_recovery.completed
      // instead (see module importWallet), matching the extension's split.
      analytics.track(AnalyticsEvent.ACCOUNT_CREATOR_FINISHED);
      set({
        ...initialState,
        navigationRef: get().navigationRef,
        isLoading: false,
        authStatus: AUTH_STATUS.AUTHENTICATED,
      });
      // Fetch active account after successful signup
      await get().fetchActiveAccount();
      // Onboarding ends here: link the phrase and its account.
      get().linkSources();
      return true;
    } catch (error) {
      logger.error("useAuthenticationStore.signUp", "Sign up failed", error);
      // Mirror the extension's onboarding.password_create_failed emit so the
      // create-password failure funnel has cross-platform coverage.
      // Scrub Stellar StrKeys first — analytics is a third-party sink
      // (Amplitude) and the error text can include uncontrolled native content.
      const signUpFailureMessage =
        error instanceof Error ? error.message : String(error);
      analytics.track(AnalyticsEvent.CREATE_PASSWORD_FAIL, {
        reason_code: scrubStrKeys(signUpFailureMessage) ?? signUpFailureMessage,
      });
      set({
        error: getUserFacingError(error, "authStore.error.failedToSignUp"),
        isLoading: false,
      });
      return false;
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
      const currentAuthStatus = get().authStatus;
      const shouldCreateTempStore = currentAuthStatus !== AUTH_STATUS.LOCKED;

      const { phraseSigners } = await signIn({
        ...params,
        shouldCreateTempStore,
      });

      // Clear the persisted LOCKED marker and stale backgrounded-at timestamp
      // before flipping to AUTHENTICATED — awaited so the auto-lock funnel
      // can't observe the old values and re-lock the fresh session.
      await Promise.all([
        secureDataStorage.remove(SENSITIVE_STORAGE_KEYS.AUTH_STATUS),
        clearBackgroundedAt(),
      ]);

      // Password verified — unblock navigation immediately.
      // getActiveAccount is slow (derivePrivateKeyFromMnemonic) so we run it
      // in the background and let the home screen render with isLoadingAccount=true.
      analytics.trackReAuthSuccess();
      set({
        ...initialState,
        // Preserve navigationRef: nothing remounts to re-set it after a soft
        // unlock, so later lock navigations would otherwise no-op
        navigationRef: get().navigationRef,
        // Preserve signInMethod: resetting it to PASSWORD would make the
        // still-mounted biometric buttons drop biometric enforcement after a
        // soft unlock, letting transactions confirm without verification
        signInMethod: get().signInMethod,
        authStatus: AUTH_STATUS.AUTHENTICATED,
        isLoading: false,
        isLoadingAccount: true,
      });

      // Drop any stale isSessionAuthValid memo captured while locked — otherwise
      // the post-unlock request burst (balances + prices + history) could read a
      // cached `false` for up to the TTL and go out anonymous, defeating the auth
      // this feature exists to attach. (Defined below; resolved at call time.)
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      clearSessionAuthValidMemo();

      // Derive every source identity now, so the first signed backend request
      // finds them cached. In the background, like the account load below: it
      // needs AUTHENTICATED, which is only set above. A failure only skips the
      // warm-up; getWalletSources derives again on demand.
      //
      // Then send any source the server has not confirmed yet: the retry for
      // an install that was offline when the source was added, and the link
      // for accounts the pre-V2 attribution just registered. A no-op once
      // every source is settled. After the warm-up, so it reuses the cached
      // sources instead of deriving them a second time.
      getWalletSources({ phraseSigners })
        .catch((error: unknown) => {
          logger.error(
            "useAuthenticationStore.signIn",
            "Failed to derive wallet sources",
            error,
          );
        })
        .finally(() => get().linkSources());

      getActiveAccount(AUTH_STATUS.AUTHENTICATED)
        .then((activeAccount) => {
          if (!activeAccount) {
            // No active account after sign-in: lock and surface an error.
            // isSoftLocked must accompany LOCKED (RootNavigator unmounts the
            // tree on LOCKED && !isSoftLocked).
            set({
              isLoadingAccount: false,
              authStatus: AUTH_STATUS.LOCKED,
              isSoftLocked: true,
              account: null,
              error: t("authStore.error.failedToLoadAccount"),
            });
            get().navigateToLockScreen();
            return;
          }
          // A soft-lock may have engaged during the slow key derivation above
          // (softLock clears account to null). Drop this stale load rather than
          // repopulating the private key into a locked store — the next unlock
          // reloads it.
          if (get().isSoftLocked) {
            set({ isLoadingAccount: false });
            return;
          }
          set({ account: activeAccount, isLoadingAccount: false });
        })
        .catch((accountError) => {
          logger.error(
            "useAuthenticationStore.signIn",
            "Failed to load account in background",
            accountError,
          );
          set({
            isLoadingAccount: false,
            authStatus: AUTH_STATUS.LOCKED,
            isSoftLocked: true,
            account: null,
            error: t("authStore.error.failedToLoadAccount"),
          });
          get().navigateToLockScreen();
        });
    } catch (error) {
      const reAuthFailureMessage =
        error instanceof Error ? error.message : String(error);
      analytics.trackReAuthFail(
        scrubStrKeys(reAuthFailureMessage) ?? reAuthFailureMessage,
      );
      logger.error("useAuthenticationStore.signIn", "Sign in failed", error);
      set({
        error: getUserFacingError(error, "authStore.error.failedToSignIn"),
        isLoading: false,
      });
      throw error;
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
      [Keychain.BIOMETRY_TYPE.FACE]: t("authStore.faceBiometrics.signInTitle"),
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
      // Re-import replaces the wallet: reset auto-lock to the default before
      // the hash key is generated so it doesn't inherit the previous timer.
      await resetAutoLockForNewWallet();
      await importWallet(params);
      set({
        ...initialState,
        navigationRef: get().navigationRef,
        authStatus: AUTH_STATUS.AUTHENTICATED,
        isLoading: false,
      });

      // Fetch active account after successful wallet import
      get().fetchActiveAccount();
      // Link the recovered phrase and the accounts found on the network.
      get().linkSources();
      return true;
    } catch (error) {
      logger.error(
        "useAuthenticationStore.importWallet",
        "Import wallet failed",
        error,
      );
      set({
        error: getUserFacingError(
          error,
          "authStore.error.failedToImportWallet",
        ),
        isLoading: false,
      });
      return false;
    }
  },

  /**
   * Gets the current authentication status.
   *
   * Single funnel for lock transitions: an AUTHENTICATED→LOCKED transition
   * (auto-lock timer) goes through softLock for every caller (periodic checks,
   * fetchActiveAccount, selectAccount), keeping the navigation tree mounted
   * instead of racing it with navigation resets.
   */
  getAuthStatus: async () => {
    // Re-validate from storage; cached status may be stale after app updates
    const previousAuthStatus = get().authStatus;
    const authStatus = await getAuthStatus();

    if (
      authStatus === AUTH_STATUS.LOCKED &&
      previousAuthStatus === AUTH_STATUS.AUTHENTICATED
    ) {
      // Auto-lock timer fired: soft lock atomically so the tree never unmounts
      await get().softLock();
      return authStatus;
    }

    // Don't let a stale read (resolved just before the LOCKED persist landed)
    // downgrade an active soft lock to AUTHENTICATED. Only signIn clears
    // isSoftLocked; disk already holds LOCKED, so the next check self-heals.
    if (get().isSoftLocked && authStatus === AUTH_STATUS.AUTHENTICATED) {
      return get().authStatus;
    }

    // A soft lock is only valid over an authenticated session. If the session
    // is gone (wipe) or hard-expired, clear isSoftLocked too — otherwise the
    // overlay stays stranded over an accountless/expired app until kill.
    if (
      get().isSoftLocked &&
      (authStatus === AUTH_STATUS.NOT_AUTHENTICATED ||
        authStatus === AUTH_STATUS.HASH_KEY_EXPIRED)
    ) {
      set({ authStatus, isSoftLocked: false });
      // Session is no longer authenticated — evict the cached source signers so
      // private-key material never outlives the session (as softLock does).
      clearCachedWalletSources();
      if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
        get().navigateToLockScreen();
      }
      return authStatus;
    }

    set({ authStatus });

    // If the hash key is expired, evict the cached source signers (retention, not
    // just use, must end at hard-expiry) and navigate to lock screen.
    if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
      clearCachedWalletSources();
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
    // Soft-locked: the lock overlay is already covering the app and the
    // navigation tree must stay intact so the user resumes where they were.
    if (get().isSoftLocked) {
      return;
    }

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
        routes: [
          {
            name: ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN,
            params: { autoFocus: true },
          },
        ],
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
      // Via the store funnel so an auto-lock here soft-locks atomically
      // rather than racing a navigation reset
      const authStatus = await get().getAuthStatus();

      // Block sensitive data while expired/locked (funnel already navigated)
      if (
        authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
        authStatus === AUTH_STATUS.LOCKED
      ) {
        set({ isLoadingAccount: false });
        return null;
      }

      // Use the freshly fetched authStatus for consistency
      const activeAccount = await getActiveAccount(authStatus);
      set({ account: activeAccount, isLoadingAccount: false });
      return activeAccount;
    } catch (error) {
      logger.error(
        "useAuthenticationStore.fetchActiveAccount",
        "Failed to fetch active account",
        error,
      );
      set({
        accountError: getUserFacingError(
          error,
          "authStore.error.failedToLoadAccount",
        ),
        isLoadingAccount: false,
      });
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
      await Promise.all([get().fetchActiveAccount(), get().getAllAccounts()]);
      set({ isRenamingAccount: false });
    } catch (error) {
      logger.error("renameAccount", "Failed to rename account", error);

      set({
        error: getUserFacingError(
          error,
          "authStore.error.failedToRenameAccount",
        ),
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
      logger.error(
        "useAuthenticationStore.getAllAccounts",
        "Failed to get all accounts",
        error,
      );
      set({
        error: getUserFacingError(
          error,
          "authStore.error.failedToGetAllAccounts",
        ),
        isLoadingAllAccounts: false,
      });
    } finally {
      set({ isLoadingAllAccounts: false });
    }
  },

  createAccount: async (
    password: string,
    sourceId?: string,
    accountName?: string,
  ) => {
    set({ isCreatingAccount: true, error: null });

    try {
      await createAccount(password, get().authStatus, sourceId, accountName);

      // The new account becomes active: drop the previous account's data so
      // nothing (e.g. priced balances) carries over into its first render.
      // Same wallet, so the other accounts' list totals stay valid.
      clearAccountData({ keepAccountsFiatTotals: true });

      await Promise.all([get().getAllAccounts(), get().fetchActiveAccount()]);

      // account.created on the creation-success path with the real post-creation
      // count (matches the extension's addAccount.fulfilled -> allAccounts.length).
      // Replaces the former tap-time emit in ManageAccounts, which over-counted
      // abandoned add flows.
      analytics.track(AnalyticsEvent.ACCOUNT_SCREEN_ADD_ACCOUNT, {
        number_of_accounts: get().allAccounts.length,
      });

      // The new account is a source of its own.
      get().linkSources();

      set({ isCreatingAccount: false, error: null });
    } catch (error) {
      logger.error(
        "useAuthenticationStore.createAccount",
        "Failed to create account",
        error,
      );
      set({
        error: getUserFacingError(
          error,
          "authStore.error.failedToCreateAccount",
        ),
        isCreatingAccount: false,
      });
      throw error;
    }
  },

  addRecoveryPhraseSource: async (
    password: string,
    pendingPhraseId: string,
    accountName?: string,
  ) => {
    set({ isCreatingAccount: true, error: null });

    try {
      await addRecoveryPhraseSource(
        password,
        get().authStatus,
        pendingPhraseId,
        accountName,
      );

      // The new account becomes active, as on createAccount.
      clearAccountData({ keepAccountsFiatTotals: true });

      await Promise.all([get().getAllAccounts(), get().fetchActiveAccount()]);

      analytics.track(AnalyticsEvent.ACCOUNT_SCREEN_ADD_ACCOUNT, {
        number_of_accounts: get().allAccounts.length,
        source: "new_phrase",
      });

      // The new phrase is a source of its own.
      get().linkSources();

      set({ isCreatingAccount: false, error: null });
    } catch (error) {
      logger.error(
        "useAuthenticationStore.addRecoveryPhraseSource",
        "Failed to add recovery phrase",
        error,
      );
      set({
        error: getUserFacingError(
          error,
          "authStore.error.failedToAddRecoveryPhrase",
        ),
        isCreatingAccount: false,
      });
      throw error;
    }
  },

  selectAccount: async (publicKey: string) => {
    set({ isSwitchingAccount: true, error: null });
    try {
      // Via the store funnel so an auto-lock here soft-locks atomically
      const authStatus = await get().getAuthStatus();
      if (
        authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
        authStatus === AUTH_STATUS.LOCKED
      ) {
        set({ isSwitchingAccount: false });
        return;
      }

      // Only clear stale data once the switch is confirmed to proceed —
      // if anything above throws, the previous account's data stays intact.
      // The wallets-list totals survive: same wallet, still valid, and
      // dropping them would flash $0.00 rows in the sheet mid-switch (the
      // switch itself force-refreshes them in the background).
      clearAccountData({ keepAccountsFiatTotals: true });
      await selectAccount(publicKey);
      const activeAccount = await getActiveAccount(authStatus);
      set({ account: activeAccount, isSwitchingAccount: false });
    } catch (error) {
      logger.error(
        "useAuthenticationStore.selectAccount",
        "Failed to select account",
        error,
      );

      set({
        error: getUserFacingError(
          error,
          "authStore.error.failedToSelectAccount",
        ),
        isSwitchingAccount: false,
      });
    }
  },

  getTemporaryStore: async () => getTemporaryStore(get().authStatus),
  clearError: () => {
    set({ error: null });
  },
  clearAccountError: () => {
    set({ accountError: null });
  },

  selectNetwork: async (network: NETWORKS) => {
    await dataStorage.setItem(STORAGE_KEYS.ACTIVE_NETWORK, network);

    set({ network });
  },

  initializeNetwork: (): Promise<void> => loadPersistedNetwork(set),

  getKeyFromKeyManager: async (
    password: string,
    activeAccountId?: string | null,
  ) => getKeyFromKeyManager(password, activeAccountId),

  importSecretKey: async (params: ImportSecretKeyParams) => {
    set({ isLoading: true, error: null });

    try {
      await importSecretKeyLocal(params, get().authStatus);

      // The imported account becomes active: drop the previous account's
      // data so nothing (e.g. priced balances) carries over into its first
      // render. Same wallet, so the other accounts' list totals stay valid.
      clearAccountData({ keepAccountsFiatTotals: true });

      await Promise.all([get().getAllAccounts(), get().fetchActiveAccount()]);

      // A key another user owns comes back as a conflict.
      get().linkSources();

      set({ isLoading: false, error: null });
    } catch (error) {
      logger.error(
        "useAuthenticationStore.importSecretKey",
        "Failed to import secret key",
        error,
      );
      set({
        error: getUserFacingError(
          error,
          "authStore.error.failedToImportSecretKey",
        ),
        isLoading: false,
      });

      throw error;
    }
  },

  /**
   * Links every unsettled source (see linkWalletSources), then reads the
   * stored conflicts into `linkConflicts`. Not awaited by any caller, so a
   * slow or offline backend never holds up the flow that triggered it.
   * Never rejects.
   */
  linkSources: () => {
    linkWalletSources()
      .then(() => getLinkConflicts())
      .then((linkConflicts) => {
        // A lock or wipe that landed during the pass resets the store; don't
        // write the old session's answer back into it.
        if (get().authStatus === AUTH_STATUS.AUTHENTICATED) {
          set({ linkConflicts });
        }
      })
      .catch((error: unknown) => {
        logger.error(
          "useAuthenticationStore.linkSources",
          "Failed to read link conflicts",
          error,
        );
      });
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
}));

/**
 * Returns the session's default phrase from the unlocked temporary store (the
 * pinned source's, else the first held; see getDefaultMnemonic), or null when
 * the wallet is not fully authenticated (AUTHENTICATED), locked, holds no
 * phrase, or the store is unavailable.
 *
 * Not an identity: backend auth and the analytics id resolve through
 * getSigningIdentity.
 */
export const getActiveMnemonicPhrase = async (): Promise<string | null> => {
  if (
    useAuthenticationStore.getState().authStatus !== AUTH_STATUS.AUTHENTICATED
  ) {
    return null;
  }
  try {
    const store = await getTemporaryStore(
      useAuthenticationStore.getState().authStatus,
    );
    const held = await getDefaultMnemonic({
      mnemonics: store?.mnemonics ?? {},
    });
    // Re-check after the async decrypt and pinned-source read: a lock
    // (soft-lock / auto-lock) may have landed while awaiting storage. If so, do
    // NOT return the pre-lock mnemonic to a caller that would act on it after
    // softLock() (TOCTOU race). Nothing may await between this check and the
    // return.
    if (
      useAuthenticationStore.getState().authStatus !== AUTH_STATUS.AUTHENTICATED
    ) {
      return null;
    }
    return held?.mnemonic ?? null;
  } catch (error) {
    // Unreachable today (getTemporaryStore is itself total), but keep the guard
    // so a future throwing edit surfaces in Sentry instead of masquerading as a
    // normal locked session with an empty breadcrumb trail.
    logger.error(
      "getActiveMnemonicPhrase",
      "Failed to read active mnemonic",
      error,
    );
    return null;
  }
};

const assertAuthenticated = (): void => {
  if (
    useAuthenticationStore.getState().authStatus !== AUTH_STATUS.AUTHENTICATED
  ) {
    throw new Error(t("authStore.error.authenticationExpired"));
  }
};

/**
 * Returns one account's secret key for Edit account's reveal. `accountId` is
 * the account's keystore id, so the password is checked against that
 * account's own keystore, even though the session is unlocked, and the key
 * comes from the same decrypt. Only a keystore the key manager lists is ever
 * opened.
 *
 * @param {Object} input - The input parameters
 * @param {string} input.accountId - The account's keystore id (`Account.id`)
 * @param {string} input.password - The wallet password
 * @returns {Promise<string>} The account's secret key
 * @throws {Error} When the wallet is locked, the account isn't held, or the password is wrong
 */
export const revealAccountSecretKey = async ({
  accountId,
  password,
}: {
  accountId: string;
  password: string;
}): Promise<string> => {
  assertAuthenticated();

  const key = await getKeyFromKeyManager(password, accountId);

  // A lock that landed during the decrypt keeps the key from leaving.
  assertAuthenticated();

  if (!key.privateKey) {
    throw new Error(t("authStore.error.noKeyPairFound"));
  }

  return key.privateKey;
};

/**
 * Returns a recovery phrase for Edit account's reveal, after checking the
 * password against a keystore. Every keystore shares the wallet password.
 *
 * With a `sourceId`, the phrase that roots that account: it must be a phrase
 * source the wallet records. The session's held copy is used when there is
 * one; otherwise the phrase is read from one of the source's own keystores
 * and kept only if it derives to `sourceId`. Without one, the wallet's
 * default phrase, as Settings → Security shows it.
 *
 * @param {Object} input - The input parameters
 * @param {string} input.password - The wallet password
 * @param {string} [input.sourceId] - The phrase source to reveal (optional)
 * @returns {Promise<string>} The recovery phrase
 * @throws {Error} When the wallet is locked, the password is wrong, or the phrase isn't found
 */
export const revealRecoveryPhrase = async ({
  password,
  sourceId,
}: {
  password: string;
  sourceId?: string;
}): Promise<string> => {
  assertAuthenticated();

  const notFound = () => new Error(t("authStore.error.recoveryPhraseNotFound"));

  if (!sourceId) {
    await getKeyFromKeyManager(password);
    const mnemonic = await getActiveMnemonicPhrase();
    if (!mnemonic) {
      throw notFound();
    }
    return mnemonic;
  }

  const source = (await getSecretSources())[sourceId];
  if (source?.type !== SecretSourceType.PHRASE) {
    throw notFound();
  }

  const sourceAccountIds = (await getAllAccounts())
    .filter((account) => account.sourceId === sourceId)
    .map(({ id }) => id);

  // Checks the password first, so a wrong one reads as a wrong password
  // rather than as a missing phrase.
  await getKeyFromKeyManager(password, sourceAccountIds[0]);

  const store = await getTemporaryStore(
    useAuthenticationStore.getState().authStatus,
  );
  let mnemonic = getHeldMnemonic({
    mnemonics: store?.mnemonics ?? {},
    sourceId,
  })?.mnemonic;

  if (!mnemonic) {
    const read = await readPhraseFromKeystores(sourceAccountIds, password);
    if (read && (await getPhraseSourceId(read)) === sourceId) {
      mnemonic = read;
    }
  }

  // Nothing may await between this check and the return (see
  // getActiveMnemonicPhrase).
  assertAuthenticated();

  if (!mnemonic) {
    throw notFound();
  }

  return mnemonic;
};

/**
 * The secrets the unlocked session holds, for getWalletSources: every account
 * id in list order, the private keys held for them by account id, and the
 * held phrases by source id. Null when the wallet is not AUTHENTICATED or the
 * store is unavailable; re-checked after the decrypt, as in
 * getActiveMnemonicPhrase, so a lock that lands mid-read returns nothing.
 */
export const getHeldSecrets = async (): Promise<{
  accountIds: string[];
  privateKeys: Record<string, string>;
  mnemonics: MnemonicMap;
} | null> => {
  if (
    useAuthenticationStore.getState().authStatus !== AUTH_STATUS.AUTHENTICATED
  ) {
    return null;
  }

  const [store, accountList] = await Promise.all([
    getTemporaryStore(useAuthenticationStore.getState().authStatus),
    getAllAccounts(),
  ]);

  if (
    !store ||
    useAuthenticationStore.getState().authStatus !== AUTH_STATUS.AUTHENTICATED
  ) {
    return null;
  }

  return {
    accountIds: accountList.map(({ id }) => id),
    privateKeys: store.privateKeys ?? {},
    mnemonics: store.mnemonics ?? {},
  };
};

// Short-TTL memo + in-flight dedup for the session-validity funnel result.
// getWalletSources runs isSessionAuthValid on every call — per backend request
// once the JWT interceptor is wired — and each funnel run is ~5 keychain reads.
// The in-flight promise collapses a near-simultaneous burst (balances + prices
// + history on unlock) to one run; the value memo collapses sequential calls
// within the window.
//
// Tradeoff: a transition detected ONLY by the funnel (auto-lock timer elapse,
// hash hard-expiry) is reflected at this gate up to SESSION_AUTH_VALID_TTL_MS
// late. That is bounded and immaterial in practice (auto-lock windows are
// minutes to hours) and does not leak key material: explicit lock/logout/wipe
// paths clear the wallet sources cache AND flip in-memory authStatus, so during
// a stale-true memo getWalletSources finds an empty cache and is blocked by
// getHeldSecrets's AUTHENTICATED gate before it can derive.
export const SESSION_AUTH_VALID_TTL_MS = 1000;
let sessionAuthValidMemo: { value: boolean; expiresAt: number } | null = null;
let sessionAuthValidInFlight: Promise<boolean> | null = null;

/** Drops the isSessionAuthValid memo (tests + any caller needing a fresh read). */
export const clearSessionAuthValidMemo = (): void => {
  sessionAuthValidMemo = null;
};

/**
 * Session-validity gate for backend auth-key use. Delegates to the authoritative
 * `getAuthStatus()` funnel — the single source of truth for lock transitions —
 * so it evaluates account existence, persisted LOCKED, hash-key hard-expiry AND
 * the auto-lock timer (`backgroundedAt` + `autoLockTimer`), rather than
 * re-implementing a subset. Result is memoized for SESSION_AUTH_VALID_TTL_MS
 * (see above). Does not decrypt the temporary store (no PBKDF2); persisted/secure
 * reads only.
 */
export const isSessionAuthValid = async (): Promise<boolean> => {
  const memo = sessionAuthValidMemo;
  if (memo && Date.now() < memo.expiresAt) return memo.value;

  if (!sessionAuthValidInFlight) {
    sessionAuthValidInFlight = (async () => {
      try {
        const value = (await getAuthStatus()) === AUTH_STATUS.AUTHENTICATED;
        sessionAuthValidMemo = {
          value,
          expiresAt: Date.now() + SESSION_AUTH_VALID_TTL_MS,
        };
        return value;
      } finally {
        sessionAuthValidInFlight = null;
      }
    })();
  }
  return sessionAuthValidInFlight;
};

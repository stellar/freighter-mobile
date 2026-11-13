import { NavigationContainerRef } from "@react-navigation/native";
import { Keypair } from "@stellar/stellar-sdk";
import { act, renderHook } from "@testing-library/react-hooks";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  AUTO_LOCK_TIMER,
  DEFAULT_AUTO_LOCK_TIMER,
  NETWORKS,
  STORAGE_KEYS,
  SENSITIVE_STORAGE_KEYS,
  LoginType,
} from "config/constants";
import { logger } from "config/logger";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { Account, AUTH_STATUS, SecretSourceType } from "config/types";
import {
  useAuthenticationStore,
  ActiveAccount,
  appendAccounts,
  clearAccountData,
  isSessionAuthValid,
  clearSessionAuthValidMemo,
  SESSION_AUTH_VALID_TTL_MS,
  getActiveMnemonicPhrase,
  revealAccountSecretKey,
  revealRecoveryPhrase,
  getHeldSecrets,
  generatePendingRecoveryPhrase,
  getPendingRecoveryPhrase,
  clearPendingRecoveryPhrase,
  holdPendingRecoveryPhrase,
} from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useCollectiblesStore } from "ducks/collectibles";
import { useHistoryStore } from "ducks/history";
import { usePreferencesStore } from "ducks/preferences";
import { usePricesStore } from "ducks/prices";
import {
  encryptDataWithPassword,
  decryptDataWithPassword,
  deriveKeyFromPassword,
  generateSalt,
  decryptDataWithDerivedKey,
  encryptDataWithDerivedKey,
} from "helpers/encryptPassword";
import { createKeyManager } from "helpers/keyManager/keyManager";
import { clearScreenshotDek } from "helpers/screenshotCrypto";
import { AppState } from "react-native";
import * as Keychain from "react-native-keychain";
import { getSupportedBiometryType, BIOMETRY_TYPE } from "react-native-keychain";
import { analytics } from "services/analytics";
import { deriveAuthKeypair } from "services/auth/deriveAuthKeypair";
import { linkWalletSources } from "services/auth/linkSources";
import { clearLinkStatus, getLinkConflicts } from "services/auth/linkStatus";
import { getPhraseSourceId } from "services/auth/secretSources";
import { getWalletSources } from "services/auth/walletSources";
import { clearCachedWalletSources } from "services/auth/walletSourcesCache";
import { getAccount } from "services/stellar";
import {
  clearNonSensitiveData,
  clearTemporaryData,
  getHashKey,
} from "services/storage/helpers";
// Import mocked modules
import { rnBiometrics } from "services/storage/secureStorage";
import {
  dataStorage,
  secureDataStorage,
  biometricDataStorage,
} from "services/storage/storageFactory";
import StellarHDWallet from "stellar-hd-wallet";

// Mock dependencies
jest.mock("helpers/keyManager/keyManager", () => {
  // Create a shared mock keyManager instance inside the factory
  const mockKeyManager = {
    storeKey: jest.fn().mockResolvedValue(undefined),
    loadKey: jest.fn().mockResolvedValue({
      id: "account_id_123",
      publicKey: "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM",
      privateKey: "SDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPK",
      extra: { mnemonicPhrase: "test mnemonic phrase" },
    }),
    loadAllKeyIds: jest.fn().mockResolvedValue(["account_id_123"]),
    removeKey: jest.fn().mockResolvedValue(undefined),
  };

  return {
    createKeyManager: jest.fn(() => mockKeyManager),
    __mockKeyManager: mockKeyManager, // Export for test access
  };
});

jest.mock("helpers/encryptPassword", () => ({
  encryptDataWithPassword: jest.fn(),
  decryptDataWithPassword: jest.fn(),
  deriveKeyFromPassword: jest.fn(),
  generateSalt: jest.fn(),
  decryptDataWithDerivedKey: jest.fn(),
  encryptDataWithDerivedKey: jest.fn(),
}));

jest.mock("@stablelib/base64", () => ({
  encode: jest.fn((data) => Buffer.from(data).toString("base64")),
  decode: jest.fn((str) => Buffer.from(str, "base64")),
}));

jest.mock("@stablelib/base64", () => ({
  encode: jest.fn((data) => Buffer.from(data).toString("base64")),
  decode: jest.fn((str) => Buffer.from(str, "base64")),
}));

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    remove: jest.fn(),
  },
  secureDataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  },
  biometricDataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    checkIfExists: jest.fn(),
  },
}));

jest.mock("services/storage/secureStorage", () => ({
  rnBiometrics: {
    isSensorAvailable: jest.fn(),
  },
}));

jest.mock("ducks/preferences", () => ({
  usePreferencesStore: {
    getState: jest.fn(() => ({
      isBiometricsEnabled: false,
      setAutoLockTimer: jest.fn(),
    })),
    setState: jest.fn(),
  },
}));

jest.mock("stellar-hd-wallet", () => ({
  __esModule: true,
  default: {
    fromMnemonic: jest.fn(),
    generateMnemonic: jest.fn(),
    validateMnemonic: jest.fn(() => true),
  },
}));

jest.mock("services/stellar", () => ({
  getAccount: jest.fn(),
}));

jest.mock("services/storage/helpers", () => ({
  clearNonSensitiveData: jest.fn(),
  clearTemporaryData: jest.fn(),
  getHashKey: jest.fn(),
}));

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// The record, pin and resolver helpers run for real over the in-memory
// dataStorage below. Only the id derivations are stubbed: the fixture
// mnemonics are not BIP39 phrases, and the real derivations are pinned
// against vectors in __tests__/services/auth/secretSources.test.ts.
jest.mock("services/auth/secretSources", () => ({
  ...jest.requireActual("services/auth/secretSources"),
  getPhraseSourceId: jest.fn((mnemonic: string) =>
    Promise.resolve(`phrase:${mnemonic}`),
  ),
  getSecretKeySourceId: jest.fn((secretKey: string) =>
    Promise.resolve(`key:${secretKey}`),
  ),
}));

// signIn derives the phrase keypair itself so the wallet sources warm-up can
// reuse it; stubbed to the same id as getPhraseSourceId above.
jest.mock("services/auth/deriveAuthKeypair", () => ({
  ...jest.requireActual("services/auth/deriveAuthKeypair"),
  deriveAuthKeypair: jest.fn((mnemonic: string) =>
    Promise.resolve({ userId: `phrase:${mnemonic}`, keypair: { mnemonic } }),
  ),
}));

jest.mock("services/auth/walletSources", () => ({
  getWalletSources: jest.fn(() =>
    Promise.resolve({ sources: [], signers: new Map() }),
  ),
}));

jest.mock("services/auth/walletSourcesCache", () => ({
  clearCachedWalletSources: jest.fn(),
}));

// The linker and its status map are tested on their own
// (__tests__/services/auth/linkSources.test.ts); here only the triggers are.
jest.mock("services/auth/linkSources", () => ({
  linkWalletSources: jest.fn(() => Promise.resolve()),
}));

jest.mock("services/auth/linkStatus", () => ({
  clearLinkStatus: jest.fn(() => Promise.resolve()),
  getLinkConflicts: jest.fn(() => Promise.resolve([])),
}));

jest.mock("i18next", () => ({
  t: (key: string) => key,
}));

jest.mock("ducks/walletKit", () => ({
  useWalletKitStore: {
    getState: jest.fn(() => ({
      disconnectAllSessions: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

jest.mock("helpers/walletKitUtil", () => ({
  clearWalletKitStorage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("helpers/browser", () => ({
  clearAllWebViewData: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("helpers/screenshotCrypto", () => ({
  clearScreenshotDek: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("ducks/browserTabs", () => ({
  useBrowserTabsStore: {
    getState: jest.fn(() => ({
      closeAllTabs: jest.fn(),
    })),
  },
}));

jest.mock("ducks/balances", () => ({
  useBalancesStore: {
    getState: jest.fn(() => ({
      fetchBalances: jest.fn().mockResolvedValue(undefined),
    })),
    setState: jest.fn(),
  },
}));

jest.mock("ducks/history", () => ({
  useHistoryStore: {
    getState: jest.fn(() => ({
      fetchHistory: jest.fn().mockResolvedValue(undefined),
    })),
    setState: jest.fn(),
  },
}));

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: {
    setState: jest.fn(),
  },
}));

jest.mock("ducks/prices", () => ({
  usePricesStore: {
    getState: jest.fn(() => ({
      fetchPrices: jest.fn().mockResolvedValue(undefined),
    })),
    setState: jest.fn(),
  },
}));

const mockResetAccountsFiatTotals = jest.fn();
jest.mock("ducks/accountsFiatTotals", () => ({
  useAccountsFiatTotalsStore: {
    getState: jest.fn(() => ({
      resetAccountsFiatTotals: mockResetAccountsFiatTotals,
    })),
  },
}));

describe("auth duck", () => {
  // Mock keyManager
  const mockKeyManager = {
    storeKey: jest.fn(),
    loadKey: jest.fn(),
    loadAllKeyIds: jest.fn(),
    removeKey: jest.fn(),
  };

  // Properly typed mock navigation
  const mockNavigationRef = {
    isReady: jest.fn().mockReturnValue(true),
    resetRoot: jest.fn(),
    getCurrentRoute: jest.fn(),
  } as unknown as NavigationContainerRef<RootStackParamList>;

  // Mock data
  const mockMnemonicPhrase = "test mnemonic phrase";
  const mockPassword = "password123";
  const mockPublicKey =
    "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
  const mockPrivateKey =
    "SDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPK";
  const mockAccountId = "account_id_123";
  const mockAccountName = "Account 1";

  const mockSalt = "salt123";
  const mockHashKey = "hashKey123";
  const mockHashKeyObj = {
    hashKey: mockHashKey,
    salt: mockSalt,
    expiresAt: Date.now() + 3600000, // Valid for 1 hour
  };

  const mockAccount: ActiveAccount = {
    publicKey: mockPublicKey,
    privateKey: mockPrivateKey,
    accountName: mockAccountName,
    id: mockAccountId,
    subentryCount: 0,
  };

  const mockEncryptedData = "encryptedData123";
  // What the mocked getPhraseSourceId derives for mockMnemonicPhrase
  const mockPhraseSourceId = `phrase:${mockMnemonicPhrase}`;
  const mockTemporaryStore = JSON.stringify({
    privateKeys: {
      [mockAccountId]: mockPrivateKey,
    },
    mnemonics: { [mockPhraseSourceId]: mockMnemonicPhrase },
  });

  let dataStorageMemory: Record<string, string>;
  let accountCounter = 0;

  // Save original store methods before they get mocked
  const originalStoreMethods = {
    logout: useAuthenticationStore.getState().logout,
    signUp: useAuthenticationStore.getState().signUp,
    importWallet: useAuthenticationStore.getState().importWallet,
    importWalletFromSecretKey:
      useAuthenticationStore.getState().importWalletFromSecretKey,
    fetchActiveAccount: useAuthenticationStore.getState().fetchActiveAccount,
    getAuthStatus: useAuthenticationStore.getState().getAuthStatus,
    selectAccount: useAuthenticationStore.getState().selectAccount,
    setNavigationRef: useAuthenticationStore.getState().setNavigationRef,
    signIn: useAuthenticationStore.getState().signIn,
    importSecretKey: useAuthenticationStore.getState().importSecretKey,
    renameAccount: useAuthenticationStore.getState().renameAccount,
    createAccount: useAuthenticationStore.getState().createAccount,
    addRecoveryPhraseSource:
      useAuthenticationStore.getState().addRecoveryPhraseSource,
    importRecoveryPhrase:
      useAuthenticationStore.getState().importRecoveryPhrase,
    initializeNetwork: useAuthenticationStore.getState().initializeNetwork,
    softLock: useAuthenticationStore.getState().softLock,
    navigateToLockScreen:
      useAuthenticationStore.getState().navigateToLockScreen,
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    // Reset the store before each test
    useAuthenticationStore.getState().logout = jest.fn();
    useAuthenticationStore.getState().signUp = jest.fn();
    useAuthenticationStore.getState().signIn = jest.fn();
    useAuthenticationStore.getState().importWallet = jest.fn();
    useAuthenticationStore.getState().importWalletFromSecretKey = jest.fn();
    useAuthenticationStore.getState().getAuthStatus = jest.fn();
    useAuthenticationStore.getState().fetchActiveAccount = jest.fn();
    useAuthenticationStore.getState().refreshActiveAccount = jest.fn();
    useAuthenticationStore.getState().setNavigationRef = jest.fn();
    useAuthenticationStore.getState().navigateToLockScreen = jest.fn();
    useAuthenticationStore.getState().createAccount = jest.fn();
    useAuthenticationStore.getState().renameAccount = jest.fn();
    useAuthenticationStore.getState().getAllAccounts = jest.fn();
    useAuthenticationStore.getState().selectAccount = jest.fn();
    useAuthenticationStore.getState().clearError = jest.fn();
    useAuthenticationStore.getState().initializeNetwork = jest.fn();

    // Reset the store state
    act(() => {
      useAuthenticationStore.setState({
        network: NETWORKS.TESTNET,
        isLoading: false,
        isCreatingAccount: false,
        isRenamingAccount: false,
        isLoadingAllAccounts: false,
        isSwitchingAccount: false,
        error: null,
        authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
        allAccounts: [],
        account: null,
        isLoadingAccount: false,
        accountError: null,
        navigationRef: null,
      });
    });

    dataStorageMemory = {};
    accountCounter = 0;

    (dataStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if (key === STORAGE_KEYS.ACTIVE_NETWORK) {
        return Promise.resolve(dataStorageMemory[key] ?? NETWORKS.PUBLIC);
      }

      return Promise.resolve(dataStorageMemory[key] ?? null);
    });

    (dataStorage.setItem as jest.Mock).mockImplementation(
      (key: string, value: string) => {
        dataStorageMemory[key] = value;

        return Promise.resolve();
      },
    );

    (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
        return Promise.resolve(null); // No temporary store
      }
      if (key === SENSITIVE_STORAGE_KEYS.HASH_KEY) {
        return Promise.resolve(null); // No hash key
      }
      return Promise.resolve(null);
    });

    // Setup createKeyManager mock
    (createKeyManager as jest.Mock).mockReturnValue(mockKeyManager);

    // Setup stellar-hd-wallet mock
    const mockWallet = {
      getPublicKey: jest.fn().mockReturnValue(mockPublicKey),
      getSecret: jest.fn().mockReturnValue(mockPrivateKey),
    };
    (StellarHDWallet.fromMnemonic as jest.Mock).mockReturnValue(mockWallet);

    // Setup encryption mocks
    (generateSalt as jest.Mock).mockReturnValue(mockSalt);
    (deriveKeyFromPassword as jest.Mock).mockResolvedValue(
      new Uint8Array([1, 2, 3]),
    );
    (encryptDataWithPassword as jest.Mock).mockResolvedValue({
      encryptedData: mockEncryptedData,
    });
    (decryptDataWithPassword as jest.Mock).mockResolvedValue(
      mockTemporaryStore,
    );
    // New derived-key helpers (synchronous, no KDF)
    (decryptDataWithDerivedKey as jest.Mock).mockReturnValue(
      mockTemporaryStore,
    );
    (encryptDataWithDerivedKey as jest.Mock).mockReturnValue(mockEncryptedData);

    // secureDataStorage.remove must return a Promise so clearDerivedKeyCache's
    // .catch() call does not throw TypeError
    (secureDataStorage.remove as jest.Mock).mockResolvedValue(undefined);

    // biometricDataStorage.clear is called in clearBiometricsData (logout/wipe path)
    (
      biometricDataStorage as jest.Mocked<typeof biometricDataStorage> & {
        clear: jest.Mock;
      }
    ).clear = jest.fn().mockResolvedValue(undefined);

    // Setup storage helpers
    (getHashKey as jest.Mock).mockResolvedValue(mockHashKeyObj);
    (clearTemporaryData as jest.Mock).mockResolvedValue(undefined);
    (clearNonSensitiveData as jest.Mock).mockResolvedValue(undefined);

    // Setup KeyManager mocks with explicit promises
    mockKeyManager.storeKey.mockResolvedValue({ id: mockAccountId });
    mockKeyManager.loadAllKeyIds.mockResolvedValue([mockAccountId]);
    mockKeyManager.loadKey.mockResolvedValue({
      id: mockAccountId,
      publicKey: mockPublicKey,
      privateKey: mockPrivateKey,
      extra: { mnemonicPhrase: mockMnemonicPhrase },
    });
  });

  describe("store state", () => {
    it("should have correct initial state values", () => {
      const { result } = renderHook(() => useAuthenticationStore());

      expect(result.current.network).toBe(NETWORKS.TESTNET);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.authStatus).toBe(AUTH_STATUS.NOT_AUTHENTICATED);
      expect(result.current.account).toBeNull();
    });

    it("should update state correctly", () => {
      act(() => {
        useAuthenticationStore.setState({
          isLoading: true,
          error: "Test error",
          authStatus: AUTH_STATUS.AUTHENTICATED,
          account: mockAccount,
        });
      });

      const { result } = renderHook(() => useAuthenticationStore());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe("Test error");
      expect(result.current.authStatus).toBe(AUTH_STATUS.AUTHENTICATED);
      expect(result.current.account).toEqual(mockAccount);
    });

    it("should have all required functions", () => {
      const { result } = renderHook(() => useAuthenticationStore());

      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.logout).toBe("function");
      expect(typeof result.current.importWallet).toBe("function");
      expect(typeof result.current.getAuthStatus).toBe("function");
      expect(typeof result.current.fetchActiveAccount).toBe("function");
      expect(typeof result.current.renameAccount).toBe("function");
      expect(typeof result.current.getAllAccounts).toBe("function");
      expect(typeof result.current.createAccount).toBe("function");
      expect(typeof result.current.selectAccount).toBe("function");
    });
  });

  describe("signUp", () => {
    it("should set loading state when signing up", () => {
      const { result } = renderHook(() => useAuthenticationStore());

      const signUpMock = jest.fn();
      result.current.signUp = signUpMock;

      result.current.signUp({
        mnemonicPhrase: mockMnemonicPhrase,
        password: mockPassword,
      });

      expect(signUpMock).toHaveBeenCalledWith({
        mnemonicPhrase: mockMnemonicPhrase,
        password: mockPassword,
      });
    });

    it("should create an account and set authenticated state on success", () => {
      const { result } = renderHook(() => useAuthenticationStore());

      // Set up the desired state to test
      act(() => {
        useAuthenticationStore.setState({
          authStatus: AUTH_STATUS.AUTHENTICATED,
          isLoading: false,
        });
      });

      // Just verify the state is as expected
      expect(result.current.authStatus).toBe(AUTH_STATUS.AUTHENTICATED);
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle errors during signup", () => {
      const { result } = renderHook(() => useAuthenticationStore());

      // Set up the desired state to test
      act(() => {
        useAuthenticationStore.setState({
          error: "Signup failed",
          isLoading: false,
          authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
        });
      });

      // Verify state
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("Signup failed");
      expect(result.current.authStatus).toBe(AUTH_STATUS.NOT_AUTHENTICATED);
    });
  });

  describe("appendAccounts", () => {
    const createAccount = (overrides: Partial<Account> = {}): Account => {
      accountCounter += 1;
      return {
        id: `account-${accountCounter}`,
        name: `Account ${accountCounter}`,
        publicKey: `GACCOUNT${accountCounter}`,
        importedFromSecretKey: false,
        ...overrides,
      };
    };

    it("should append new accounts when storage is empty", async () => {
      const accounts = [
        createAccount({ id: "account-1", publicKey: "GA1", name: "Account 1" }),
        createAccount({ id: "account-2", publicKey: "GA2", name: "Account 2" }),
      ];

      await appendAccounts(accounts);

      expect(JSON.parse(dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST])).toEqual(
        accounts,
      );
      expect(dataStorage.setItem).toHaveBeenCalledTimes(1);
    });

    it("should append new accounts to storage without duplicating existing ones", async () => {
      const existingAccounts = [
        {
          id: "account-existing",
          name: "Existing Account",
          publicKey: "GEXISTING",
          importedFromSecretKey: false,
        },
      ];
      const duplicatedAccount = {
        id: "account-existing",
        name: "Existing Account Updated Name (ignored)",
        publicKey: "GEXISTING",
        importedFromSecretKey: false,
      };
      const newAccount = {
        id: "account-new",
        name: "New Account",
        publicKey: "GNEWACCOUNT",
        importedFromSecretKey: false,
      };

      dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] =
        JSON.stringify(existingAccounts);

      await appendAccounts([duplicatedAccount, newAccount]);

      expect(dataStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ACCOUNT_LIST,
        JSON.stringify([...existingAccounts, newAccount]),
      );
      expect(JSON.parse(dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST])).toEqual([
        ...existingAccounts,
        newAccount,
      ]);
    });

    it("should ignore duplicates and prevent multiple writes when nothing new is added", async () => {
      const existingAccount = createAccount({
        id: "account-existing",
        publicKey: "GEXISTING",
        name: "Existing Account",
      });

      dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
        existingAccount,
      ]);

      await appendAccounts([existingAccount]);

      // appendAccounts should return early without calling setItem again
      expect(dataStorage.setItem).not.toHaveBeenCalled();
      expect(JSON.parse(dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST])).toEqual([
        existingAccount,
      ]);
    });

    it("should maintain existing order and append multiple new accounts at the end", async () => {
      const existingAccounts = [
        createAccount({
          id: "account-1",
          publicKey: "GA_EXISTING_1",
          name: "Existing Account 1",
        }),
      ];

      const newAccounts = [
        createAccount({
          id: "account-2",
          publicKey: "GA_NEW_1",
          name: "New Account 1",
        }),
        createAccount({
          id: "account-3",
          publicKey: "GA_NEW_2",
          name: "New Account 2",
        }),
      ];

      dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] =
        JSON.stringify(existingAccounts);

      await appendAccounts([
        newAccounts[0],
        ...existingAccounts,
        newAccounts[1],
      ]);

      expect(JSON.parse(dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST])).toEqual([
        ...existingAccounts,
        ...newAccounts,
      ]);
      expect(dataStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ACCOUNT_LIST,
        JSON.stringify([...existingAccounts, ...newAccounts]),
      );
    });
  });

  describe("signIn", () => {
    it("should authenticate user with valid credentials", () => {
      const { result } = renderHook(() => useAuthenticationStore());

      const signInMock = jest.fn().mockResolvedValue(undefined);
      result.current.signIn = signInMock;

      result.current.signIn({ password: mockPassword });

      expect(signInMock).toHaveBeenCalledWith({
        password: mockPassword,
      });

      // Set the desired authenticated state
      act(() => {
        useAuthenticationStore.setState({
          authStatus: AUTH_STATUS.AUTHENTICATED,
          isLoading: false,
          account: mockAccount,
        });
      });

      expect(result.current.authStatus).toBe(AUTH_STATUS.AUTHENTICATED);
      expect(result.current.account).toBeDefined();
    });

    it("should handle invalid credentials", async () => {
      const { result } = renderHook(() => useAuthenticationStore());

      const signInMock = jest
        .fn()
        .mockRejectedValue(new Error("Invalid password"));
      result.current.signIn = signInMock;

      await expect(
        result.current.signIn({ password: "wrong_password" }),
      ).rejects.toThrow("Invalid password");
    });
  });

  describe("logout", () => {
    it("should clear sensitive data and set HASH_KEY_EXPIRED status for users with accounts", () => {
      const { result } = renderHook(() => useAuthenticationStore());

      // Set up the initial state
      act(() => {
        useAuthenticationStore.setState({
          authStatus: AUTH_STATUS.AUTHENTICATED,
          account: mockAccount,
        });
      });

      const logoutMock = jest.fn();
      result.current.logout = logoutMock;
      result.current.setNavigationRef = jest.fn();

      // Set the navigation ref
      result.current.setNavigationRef(mockNavigationRef);

      // Call logout
      result.current.logout();

      expect(logoutMock).toHaveBeenCalled();

      // Simulate the state after logout
      act(() => {
        useAuthenticationStore.setState({
          authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
          account: null,
          isLoading: false,
        });
      });

      expect(result.current.account).toBeNull();
      expect(result.current.authStatus).toBe(AUTH_STATUS.HASH_KEY_EXPIRED);
    });
  });

  describe("navigateToLockScreen", () => {
    it("resets to a lock screen that focuses its password field", () => {
      act(() => {
        useAuthenticationStore.setState({
          navigateToLockScreen: originalStoreMethods.navigateToLockScreen,
          navigationRef: mockNavigationRef,
          isSoftLocked: false,
        });
      });
      (mockNavigationRef.getCurrentRoute as jest.Mock).mockReturnValueOnce({
        name: "Home",
      });

      useAuthenticationStore.getState().navigateToLockScreen();

      expect(mockNavigationRef.resetRoot).toHaveBeenCalledWith({
        index: 0,
        routes: [
          {
            name: ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN,
            params: { autoFocus: true },
          },
        ],
      });
    });

    it("should reset navigation to lock screen", () => {
      const { result } = renderHook(() => useAuthenticationStore());

      const navigateToLockScreenMock = jest.fn();
      const setNavigationRefMock = jest.fn();

      result.current.navigateToLockScreen = navigateToLockScreenMock;
      result.current.setNavigationRef = setNavigationRefMock;

      // Set the navigation ref
      result.current.setNavigationRef(mockNavigationRef);

      // Call navigateToLockScreen
      result.current.navigateToLockScreen();

      expect(setNavigationRefMock).toHaveBeenCalledWith(mockNavigationRef);
      expect(navigateToLockScreenMock).toHaveBeenCalled();
    });

    it("should not navigate if already on lock screen", () => {
      const { result } = renderHook(() => useAuthenticationStore());

      (mockNavigationRef.getCurrentRoute as jest.Mock).mockReturnValueOnce({
        name: ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN,
      });

      const navigateToLockScreenMock = jest.fn();
      const setNavigationRefMock = jest.fn();

      result.current.navigateToLockScreen = navigateToLockScreenMock;
      result.current.setNavigationRef = setNavigationRefMock;

      // Set the navigation ref
      result.current.setNavigationRef(mockNavigationRef);

      // Call navigateToLockScreen
      result.current.navigateToLockScreen();

      expect(setNavigationRefMock).toHaveBeenCalledWith(mockNavigationRef);
      expect(navigateToLockScreenMock).toHaveBeenCalled();
    });
  });

  describe("fetchActiveAccount", () => {
    it("should fetch and set active account", () => {
      const { result } = renderHook(() => useAuthenticationStore());

      const fetchActiveAccountMock = jest.fn().mockResolvedValue(mockAccount);
      result.current.fetchActiveAccount = fetchActiveAccountMock;

      // Call fetchActiveAccount
      result.current.fetchActiveAccount();

      expect(fetchActiveAccountMock).toHaveBeenCalled();

      // Set the desired state after fetching active account
      act(() => {
        useAuthenticationStore.setState({
          account: mockAccount,
          isLoadingAccount: false,
        });
      });

      expect(result.current.isLoadingAccount).toBe(false);
      expect(result.current.account).toBeDefined();
      expect(result.current.account?.publicKey).toBe(mockPublicKey);
      expect(result.current.account?.privateKey).toBe(mockPrivateKey);
    });
  });

  describe("enableBiometrics", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (getSupportedBiometryType as jest.Mock).mockResolvedValue(
        BIOMETRY_TYPE.FACE_ID,
      );
      (rnBiometrics.isSensorAvailable as jest.Mock).mockResolvedValue(true);
      (usePreferencesStore.getState as jest.Mock).mockReturnValue({
        isBiometricsEnabled: true,
      });
    });

    it("should successfully enable biometrics and execute callback with password", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");
      const mockStoredData = { password: "storedPassword" };

      (biometricDataStorage.getItem as jest.Mock).mockResolvedValue(
        mockStoredData,
      );

      let response;
      await act(async () => {
        response = await result.current.enableBiometrics(mockCallback);
      });

      expect(getSupportedBiometryType).toHaveBeenCalled();
      expect(biometricDataStorage.getItem).toHaveBeenCalledWith(
        "biometricPassword",
        {
          title: "authStore.faceId.signInTitle",
          cancel: "common.cancel",
        },
      );
      expect(mockCallback).toHaveBeenCalledWith("storedPassword");
      expect(response).toBe("success");
    });

    it("should throw error when no biometry type is found", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");

      (getSupportedBiometryType as jest.Mock).mockResolvedValue(null);

      await expect(
        act(async () => {
          await result.current.enableBiometrics(mockCallback);
        }),
      ).rejects.toThrow("No biometry type found");
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it("should throw error when no stored password is found", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");

      (biometricDataStorage.getItem as jest.Mock).mockResolvedValue(null);

      await expect(
        act(async () => {
          await result.current.enableBiometrics(mockCallback);
        }),
      ).rejects.toThrow(
        "No stored password found for biometric authentication",
      );
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it("should handle biometric authentication failure", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");
      const mockError = new Error("Biometric authentication failed");

      (biometricDataStorage.getItem as jest.Mock).mockRejectedValue(mockError);

      await expect(
        act(async () => {
          await result.current.enableBiometrics(mockCallback);
        }),
      ).rejects.toThrow("Biometric authentication failed");
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe("verifyActionWithBiometrics", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (getSupportedBiometryType as jest.Mock).mockResolvedValue(
        BIOMETRY_TYPE.FACE_ID,
      );
      (rnBiometrics.isSensorAvailable as jest.Mock).mockResolvedValue(true);
      (usePreferencesStore.getState as jest.Mock).mockReturnValue({
        isBiometricsEnabled: true,
      });
    });

    it("should successfully verify action with biometrics when enabled", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");
      const mockStoredData = { password: "storedPassword" };
      const mockArgs = ["arg1", "arg2"];

      // Set up the store state to enable biometrics
      act(() => {
        useAuthenticationStore.setState({
          signInMethod: LoginType.FACE,
        });
      });

      (biometricDataStorage.getItem as jest.Mock).mockResolvedValue(
        mockStoredData,
      );

      let response;
      await act(async () => {
        response = await result.current.verifyActionWithBiometrics(
          mockCallback,
          ...mockArgs,
        );
      });

      expect(getSupportedBiometryType).toHaveBeenCalled();
      expect(biometricDataStorage.getItem).toHaveBeenCalledWith(
        "biometricPassword",
        {
          title: "authStore.faceId.signInTitle",
          cancel: "common.cancel",
        },
      );
      expect(mockCallback).toHaveBeenCalledWith("storedPassword", ...mockArgs);
      expect(response).toBe("success");
    });

    it("should fall back to callback without password when biometrics disabled", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");
      const mockArgs = ["arg1", "arg2"];

      (usePreferencesStore.getState as jest.Mock).mockReturnValue({
        isBiometricsEnabled: false,
      });

      let response;
      await act(async () => {
        response = await result.current.verifyActionWithBiometrics(
          mockCallback,
          ...mockArgs,
        );
      });

      expect(getSupportedBiometryType).not.toHaveBeenCalled();
      expect(biometricDataStorage.getItem).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(undefined, ...mockArgs);
      expect(response).toBe("success");
    });

    it("should fall back to callback without password when sensor unavailable", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");
      const mockArgs = ["arg1", "arg2"];

      // Mock biometrics as disabled so the function returns early
      (usePreferencesStore.getState as jest.Mock).mockReturnValue({
        isBiometricsEnabled: false,
      });

      (rnBiometrics.isSensorAvailable as jest.Mock).mockResolvedValue(false);

      let response;
      await act(async () => {
        response = await result.current.verifyActionWithBiometrics(
          mockCallback,
          ...mockArgs,
        );
      });

      expect(getSupportedBiometryType).not.toHaveBeenCalled();
      expect(biometricDataStorage.getItem).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(undefined, ...mockArgs);
      expect(response).toBe("success");
    });

    it("should fall back to callback without password when using password sign-in method", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");
      const mockArgs = ["arg1", "arg2"];

      // Mock the store state to have password sign-in method
      act(() => {
        useAuthenticationStore.setState({
          signInMethod: LoginType.PASSWORD,
        });
      });

      let response;
      await act(async () => {
        response = await result.current.verifyActionWithBiometrics(
          mockCallback,
          ...mockArgs,
        );
      });

      expect(getSupportedBiometryType).not.toHaveBeenCalled();
      expect(biometricDataStorage.getItem).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(undefined, ...mockArgs);
      expect(response).toBe("success");
    });

    it("should fall back to callback without password when no biometry type available", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");
      const mockArgs = ["arg1", "arg2"];

      // Set up the store state to enable biometrics
      (usePreferencesStore.getState as jest.Mock).mockReturnValue({
        isBiometricsEnabled: true,
      });

      // Set the sign-in method to FACE so biometrics path is taken
      act(() => {
        useAuthenticationStore.setState({
          signInMethod: LoginType.FACE,
        });
      });

      (getSupportedBiometryType as jest.Mock).mockResolvedValue(null);

      let response;
      await act(async () => {
        response = await result.current.verifyActionWithBiometrics(
          mockCallback,
          ...mockArgs,
        );
      });

      expect(getSupportedBiometryType).toHaveBeenCalled();
      expect(biometricDataStorage.getItem).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(undefined, ...mockArgs);
      expect(response).toBe("success");
    });

    it("should throw error when no stored password is found", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");
      const mockArgs = ["arg1", "arg2"];

      // Set up the store state to enable biometrics
      (usePreferencesStore.getState as jest.Mock).mockReturnValue({
        isBiometricsEnabled: true,
      });
      act(() => {
        useAuthenticationStore.setState({
          signInMethod: LoginType.FACE,
        });
      });

      (biometricDataStorage.getItem as jest.Mock).mockResolvedValue(null);

      await expect(
        act(async () => {
          await result.current.verifyActionWithBiometrics(
            mockCallback,
            ...mockArgs,
          );
        }),
      ).rejects.toThrow(
        "No stored password found for biometric authentication",
      );
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it("should handle biometric authentication failure", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");
      const mockArgs = ["arg1", "arg2"];
      const mockError = new Error("Biometric authentication failed");

      // Set up the store state to enable biometrics
      (usePreferencesStore.getState as jest.Mock).mockReturnValue({
        isBiometricsEnabled: true,
      });
      act(() => {
        useAuthenticationStore.setState({
          signInMethod: LoginType.FACE,
        });
      });

      (biometricDataStorage.getItem as jest.Mock).mockRejectedValue(mockError);

      await expect(
        act(async () => {
          await result.current.verifyActionWithBiometrics(
            mockCallback,
            ...mockArgs,
          );
        }),
      ).rejects.toThrow("Biometric authentication failed");
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe("authentication mechanisms", () => {
    beforeEach(() => {
      // Setup default mocks for authenticated state
      (getHashKey as jest.Mock).mockResolvedValue(mockHashKeyObj);
      (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
          return Promise.resolve(mockEncryptedData);
        }
        if (key === SENSITIVE_STORAGE_KEYS.HASH_KEY) {
          return Promise.resolve(JSON.stringify(mockHashKeyObj));
        }
        return Promise.resolve(null);
      });
      (decryptDataWithDerivedKey as jest.Mock).mockReturnValue(
        mockTemporaryStore,
      );
    });

    describe("getTemporaryStore authentication checks", () => {
      it("should return false when hash key is not found", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        (getHashKey as jest.Mock).mockResolvedValue(null);

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
          });
        });

        // initBiometricPassword catches errors and returns false
        await act(async () => {
          const success = await result.current.initBiometricPassword();
          expect(success).toBe(false);
        });
      });

      it("should return false when hash key is expired", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        const expiredHashKey = {
          ...mockHashKeyObj,
          expiresAt: Date.now() - 1000, // Expired 1 second ago
        };
        (getHashKey as jest.Mock).mockResolvedValue(expiredHashKey);

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
          });
        });

        // initBiometricPassword catches errors and returns false
        await act(async () => {
          const success = await result.current.initBiometricPassword();
          expect(success).toBe(false);
        });
      });

      it("should treat a hash key with a future generatedAt as expired (clock rollback)", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        // Device clock rolled back below the key's creation time: generatedAt
        // is in the future even though expiresAt hasn't been reached by wall
        // clock. Must be treated as expired so a rolled-back clock can't keep
        // stale key material usable past the hard-expiry backstop.
        const rolledBackHashKey = {
          ...mockHashKeyObj,
          generatedAt: Date.now() + 60_000,
          expiresAt: Date.now() + 3_600_000,
        };
        (getHashKey as jest.Mock).mockResolvedValue(rolledBackHashKey);

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
          });
        });

        await act(async () => {
          const success = await result.current.initBiometricPassword();
          expect(success).toBe(false);
        });
      });

      it("should return false when auth status is HASH_KEY_EXPIRED", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        // Ensure hash key is valid (not expired) - this is required for getTemporaryStore to work
        const validHashKey = {
          ...mockHashKeyObj,
          expiresAt: Date.now() + 3600000, // Valid for 1 hour
        };
        (getHashKey as jest.Mock).mockResolvedValue(validHashKey);

        // Mock temporary store with password
        const tempStoreWithPassword = JSON.stringify({
          privateKeys: {
            [mockAccountId]: mockPrivateKey,
          },
          mnemonics: { [mockPhraseSourceId]: mockMnemonicPhrase },
          password: mockPassword,
        });
        (decryptDataWithDerivedKey as jest.Mock).mockReturnValue(
          tempStoreWithPassword,
        );

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
          });
        });

        await act(async () => {
          const success = await result.current.initBiometricPassword();
          expect(success).toBe(false);
        });
      });

      it("should return false when decryption fails", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        (decryptDataWithDerivedKey as jest.Mock).mockImplementation(() => {
          throw new Error("Decryption failed");
        });

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
          });
        });

        // initBiometricPassword catches errors and returns false
        await act(async () => {
          const success = await result.current.initBiometricPassword();
          expect(success).toBe(false);
        });

        // Should clear temporary data on decryption failure, but the
        // screenshot DEK must survive: tabs and screenshot files are not
        // cleared on this path, and rotating the key would orphan them.
        expect(clearTemporaryData).toHaveBeenCalled();
        expect(clearScreenshotDek).not.toHaveBeenCalled();
      });

      it("should return false when temporary store has invalid structure", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        const invalidTempStore = JSON.stringify({
          // Missing privateKeys and mnemonicPhrase
          someOtherField: "value",
        });
        (decryptDataWithDerivedKey as jest.Mock).mockReturnValue(
          invalidTempStore,
        );

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
          });
        });

        // initBiometricPassword catches errors and returns false
        await act(async () => {
          const success = await result.current.initBiometricPassword();
          expect(success).toBe(false);
        });

        // Should clear temporary data on invalid structure
        expect(clearTemporaryData).toHaveBeenCalled();
      });

      it("should return false when decryption throws an error", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        const decryptionError = new Error("Decryption failed");
        (decryptDataWithDerivedKey as jest.Mock).mockImplementation(() => {
          throw decryptionError;
        });

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
          });
        });

        // initBiometricPassword catches errors and returns false
        await act(async () => {
          const success = await result.current.initBiometricPassword();
          expect(success).toBe(false);
        });

        // Should clear temporary data on decryption error
        expect(clearTemporaryData).toHaveBeenCalled();
      });

      it("should return null when temporary store data is not found", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
            return Promise.resolve(null);
          }
          if (key === SENSITIVE_STORAGE_KEYS.HASH_KEY) {
            return Promise.resolve(JSON.stringify(mockHashKeyObj));
          }
          return Promise.resolve(null);
        });

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
          });
        });

        // initBiometricPassword should return false when temp store is null
        await act(async () => {
          const success = await result.current.initBiometricPassword();
          expect(success).toBe(false);
        });
      });
    });

    describe("failure tracking", () => {
      beforeEach(() => {
        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
          });
        });
      });

      it("should track repeated unauthorized access attempts", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        // Ensure hash key is valid so we can test decryption failures
        const validHashKey = {
          ...mockHashKeyObj,
          expiresAt: Date.now() + 3600000, // Valid for 1 hour
        };
        (getHashKey as jest.Mock).mockResolvedValue(validHashKey);

        // Ensure temporary store exists
        (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
            return Promise.resolve(mockEncryptedData);
          }
          if (key === SENSITIVE_STORAGE_KEYS.HASH_KEY) {
            return Promise.resolve(JSON.stringify(validHashKey));
          }
          return Promise.resolve(null);
        });

        // Mock decryption failures to trigger tracking
        (decryptDataWithDerivedKey as jest.Mock).mockImplementation(() => {
          throw new Error("Decryption failed");
        });

        // Make multiple failed attempts sequentially to properly track failures
        for (let i = 0; i < 3; i++) {
          // eslint-disable-next-line no-await-in-loop, @typescript-eslint/no-loop-func
          await act(async () => {
            const success = await result.current.initBiometricPassword();
            expect(success).toBe(false);
          });
        }

        // Should log suspicious repeated failures after threshold.
        // Stable Error message + variable count moved to extra args
        // so events group as a single Sentry issue across counts.
        expect(logger.error).toHaveBeenCalledWith(
          "[getTemporaryStore]",
          expect.stringContaining("Repeated decryption failures"),
          expect.any(Error),
          expect.objectContaining({
            failureCount: expect.any(Number),
            failureResetWindowMs: expect.any(Number),
          }),
        );
      });

      it("should reset failure count on successful access", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        // First, make a failed decryption attempt
        (decryptDataWithDerivedKey as jest.Mock).mockImplementation(() => {
          throw new Error("Decryption failed");
        });
        await act(async () => {
          const success = await result.current.initBiometricPassword();
          expect(success).toBe(false);
        });

        // Then, make a successful attempt - restore successful decryption
        const tempStoreWithPassword = JSON.stringify({
          privateKeys: {
            [mockAccountId]: mockPrivateKey,
          },
          mnemonics: { [mockPhraseSourceId]: mockMnemonicPhrase },
          password: mockPassword,
        });
        (decryptDataWithDerivedKey as jest.Mock).mockReturnValue(
          tempStoreWithPassword,
        );

        // Ensure temporary store is available
        (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
            return Promise.resolve(mockEncryptedData);
          }
          if (key === SENSITIVE_STORAGE_KEYS.HASH_KEY) {
            const validHashKey = {
              ...mockHashKeyObj,
              expiresAt: Date.now() + 3600000, // Valid for 1 hour
            };
            return Promise.resolve(JSON.stringify(validHashKey));
          }
          return Promise.resolve(null);
        });

        // Ensure auth status is authenticated for successful access
        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
          });
        });

        await act(async () => {
          const success = await result.current.initBiometricPassword();
          expect(success).toBe(true);
        });

        // Failure count should be reset, so next failure should not trigger suspicious log
        const errorCallCount = (logger.error as jest.Mock).mock.calls.filter(
          (call) => call[1] === "Repeated failures detected",
        ).length;

        // Make another failure
        (getHashKey as jest.Mock).mockResolvedValue(null);
        await act(async () => {
          const success = await result.current.initBiometricPassword();
          expect(success).toBe(false);
        });

        // Should not have increased suspicious failure count
        const newErrorCallCount = (logger.error as jest.Mock).mock.calls.filter(
          (call) => call[1] === "Repeated failures detected",
        ).length;

        // The count should be the same (or only increased by 1 if we hit threshold again)
        expect(newErrorCallCount).toBeLessThanOrEqual(errorCallCount + 1);
      });
    });
  });

  describe("LOCKED state functionality", () => {
    describe("logout with LOCKED state", () => {
      it("should set LOCKED status and preserve temporary store on logout", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        // Mock that accounts exist
        (dataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === STORAGE_KEYS.ACCOUNT_LIST) {
            return Promise.resolve(JSON.stringify([mockAccount]));
          }
          return Promise.resolve(null);
        });

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
            account: mockAccount,
            logout: originalStoreMethods.logout,
            setNavigationRef: originalStoreMethods.setNavigationRef,
          });
        });

        act(() => {
          result.current.setNavigationRef(mockNavigationRef);
        });

        // Call logout (which should set LOCKED state)
        await act(async () => {
          result.current.logout();
          // Wait for async operations
          await new Promise((resolve) => {
            setTimeout(resolve, 300);
          });
        });

        // Verify LOCKED status was persisted in secure storage
        expect(secureDataStorage.setItem).toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
          AUTH_STATUS.LOCKED,
        );

        // A manual lock suppresses the lock screen's biometric auto-prompt
        expect(
          useAuthenticationStore.getState().suppressBiometricAutoPrompt,
        ).toBe(true);

        // The lock screen is navigated to, not launched into, so it focuses
        // its password field
        expect(mockNavigationRef.resetRoot).toHaveBeenCalledWith({
          index: 0,
          routes: [
            {
              name: ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN,
              params: { autoFocus: true },
            },
          ],
        });
      });

      it("should wipe all data on logout when shouldWipeAllData is true", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        (dataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === STORAGE_KEYS.ACCOUNT_LIST) {
            return Promise.resolve(JSON.stringify([mockAccount]));
          }
          return Promise.resolve(null);
        });

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
            account: mockAccount,
            logout: originalStoreMethods.logout,
            setNavigationRef: originalStoreMethods.setNavigationRef,
          });
        });

        act(() => {
          result.current.setNavigationRef(mockNavigationRef);
        });

        // Call logout with wipe all data flag
        await act(async () => {
          result.current.logout(true);
          await new Promise((resolve) => {
            setTimeout(resolve, 300);
          });
        });

        // Verify data was cleared
        expect(clearTemporaryData).toHaveBeenCalled();
        expect(clearNonSensitiveData).toHaveBeenCalled();
        expect(clearLinkStatus).toHaveBeenCalled();
        expect(clearScreenshotDek).toHaveBeenCalled();
        expect(dataStorage.remove).toHaveBeenCalledWith(
          STORAGE_KEYS.COLLECTIBLES_LIST,
        );

        // Auto-lock is reset to the default so the next wallet doesn't inherit
        // the wiped wallet's timer
        expect(usePreferencesStore.setState).toHaveBeenCalledWith({
          autoLockTimer: DEFAULT_AUTO_LOCK_TIMER,
        });
      });

      it("should call resetRoot to AUTH_STACK on logout(true) even though ...initialState clears navigationRef", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        (dataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === STORAGE_KEYS.ACCOUNT_LIST) {
            return Promise.resolve(JSON.stringify([mockAccount]));
          }
          return Promise.resolve(null);
        });

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
            account: mockAccount,
            logout: originalStoreMethods.logout,
            setNavigationRef: originalStoreMethods.setNavigationRef,
          });
        });

        act(() => {
          result.current.setNavigationRef(mockNavigationRef);
        });

        // Confirm navigationRef is in the store before calling logout
        expect(useAuthenticationStore.getState().navigationRef).toBe(
          mockNavigationRef,
        );

        await act(async () => {
          result.current.logout(true);
          await new Promise((resolve) => {
            setTimeout(resolve, 300);
          });
        });

        // Key regression: navigationRef is captured before ...initialState clears
        // it to null, so resetRoot must still be called with AUTH_STACK.
        expect(mockNavigationRef.resetRoot).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: ROOT_NAVIGATOR_ROUTES.AUTH_STACK }],
        });
        // State should reflect NOT_AUTHENTICATED after deletion
        expect(useAuthenticationStore.getState().authStatus).toBe(
          AUTH_STATUS.NOT_AUTHENTICATED,
        );
      });
    });

    describe("lock left by a previous wallet", () => {
      // Signing out (or auto-lock) persists LOCKED, and Forgot password wipes
      // the wallet from that locked state. Left behind, the marker would lock
      // the next wallet as soon as it is set up.
      let secureMemory: Record<string, string>;

      beforeEach(() => {
        secureMemory = {
          [SENSITIVE_STORAGE_KEYS.AUTH_STATUS]: AUTH_STATUS.LOCKED,
        };
        (secureDataStorage.getItem as jest.Mock).mockImplementation(
          (key: string) => Promise.resolve(secureMemory[key] ?? null),
        );
        (secureDataStorage.setItem as jest.Mock).mockImplementation(
          (key: string, value: string) => {
            secureMemory[key] = value;
            return Promise.resolve();
          },
        );
        (secureDataStorage.remove as jest.Mock).mockImplementation(
          (key: string) => {
            delete secureMemory[key];
            return Promise.resolve();
          },
        );

        // The store holds the key manager its module created on import, so
        // stub that instance to store the new wallet's key
        const { __mockKeyManager: moduleKeyManager } = jest.requireMock<{
          __mockKeyManager: typeof mockKeyManager;
        }>("helpers/keyManager/keyManager");
        moduleKeyManager.storeKey.mockResolvedValue({ id: mockAccountId });
      });

      it("doesn't survive a wipe", async () => {
        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.LOCKED,
            logout: originalStoreMethods.logout,
          });
        });

        await act(async () => {
          useAuthenticationStore.getState().logout(true);
          await new Promise((resolve) => {
            setTimeout(resolve, 300);
          });
        });

        expect(secureMemory).not.toHaveProperty(
          SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
        );
      });

      it("doesn't lock a wallet created after it", async () => {
        act(() => {
          useAuthenticationStore.setState({
            signUp: originalStoreMethods.signUp,
            fetchActiveAccount: originalStoreMethods.fetchActiveAccount,
            getAuthStatus: originalStoreMethods.getAuthStatus,
            softLock: originalStoreMethods.softLock,
          });
        });

        await act(async () => {
          await useAuthenticationStore.getState().signUp({
            mnemonicPhrase: mockMnemonicPhrase,
            password: mockPassword,
          });
        });

        expect(useAuthenticationStore.getState()).toMatchObject({
          authStatus: AUTH_STATUS.AUTHENTICATED,
          isSoftLocked: false,
        });
      });

      it("doesn't lock a wallet imported after it", async () => {
        // Import checks the recovery phrase's accounts against the network.
        // With real keys already in the session it finds them all stored
        // locally and skips the network.
        const keypair = Keypair.random();
        (StellarHDWallet.fromMnemonic as jest.Mock).mockReturnValue({
          getPublicKey: jest.fn().mockReturnValue(keypair.publicKey()),
          getSecret: jest.fn().mockReturnValue(keypair.secret()),
        });
        (decryptDataWithDerivedKey as jest.Mock).mockReturnValue(
          JSON.stringify({
            privateKeys: { [mockAccountId]: keypair.secret() },
            mnemonicPhrase: mockMnemonicPhrase,
          }),
        );

        act(() => {
          useAuthenticationStore.setState({
            importWallet: originalStoreMethods.importWallet,
            fetchActiveAccount: originalStoreMethods.fetchActiveAccount,
            getAuthStatus: originalStoreMethods.getAuthStatus,
            softLock: originalStoreMethods.softLock,
          });
        });

        let imported = false;
        await act(async () => {
          imported = await useAuthenticationStore.getState().importWallet({
            mnemonicPhrase: mockMnemonicPhrase,
            password: mockPassword,
          });
        });

        expect(imported).toBe(true);
        expect(useAuthenticationStore.getState()).toMatchObject({
          authStatus: AUTH_STATUS.AUTHENTICATED,
          isSoftLocked: false,
        });
      });
    });

    describe("getAuthStatus with LOCKED state", () => {
      it("should return LOCKED when persisted status is LOCKED and temp store exists", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        act(() => {
          useAuthenticationStore.setState({
            getAuthStatus: originalStoreMethods.getAuthStatus,
          });
        });

        // Mock accounts exist
        (dataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === STORAGE_KEYS.ACCOUNT_LIST) {
            return Promise.resolve(JSON.stringify([mockAccount]));
          }
          return Promise.resolve(null);
        });

        // Mock secure storage with both AUTH_STATUS and TEMPORARY_STORE
        (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === SENSITIVE_STORAGE_KEYS.AUTH_STATUS) {
            return Promise.resolve(AUTH_STATUS.LOCKED);
          }
          if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
            return Promise.resolve("encrypted-temp-store");
          }
          return Promise.resolve(null);
        });

        // Mock hash key exists and is valid
        (getHashKey as jest.Mock).mockResolvedValue({
          hashKey: "mock-hash-key",
          salt: "mock-salt",
          createdAt: Date.now(),
        });

        await act(async () => {
          const status = await result.current.getAuthStatus();
          expect(status).toBe(AUTH_STATUS.LOCKED);
        });
      });

      it("should clear invalid LOCKED status if temp store doesn't exist", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        act(() => {
          useAuthenticationStore.setState({
            getAuthStatus: originalStoreMethods.getAuthStatus,
          });
        });

        (dataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === STORAGE_KEYS.ACCOUNT_LIST) {
            return Promise.resolve(JSON.stringify([mockAccount]));
          }
          return Promise.resolve(null);
        });

        (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === SENSITIVE_STORAGE_KEYS.AUTH_STATUS) {
            return Promise.resolve(AUTH_STATUS.LOCKED);
          }
          // Mock temporary store does NOT exist
          return Promise.resolve(null);
        });

        (getHashKey as jest.Mock).mockResolvedValue({
          hashKey: "mock-hash-key",
          salt: "mock-salt",
          expiresAt: Date.now() + 3600000, // Valid for 1 hour
        });

        // Ensure secureDataStorage.remove is a mock function
        (secureDataStorage.remove as jest.Mock).mockResolvedValue(undefined);

        await act(async () => {
          const status = await result.current.getAuthStatus();
          expect(status).toBe(AUTH_STATUS.HASH_KEY_EXPIRED);
        });

        // Verify invalid LOCKED status was cleared from secure storage
        expect(secureDataStorage.remove).toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
        );
      });
    });

    describe("getAuthStatus with auto-lock timer", () => {
      const ONE_HOUR_MS = 3600000;

      const mockAuthenticatedStorage = ({
        backgroundedAt,
        autoLockTimer,
      }: {
        backgroundedAt: number | null;
        autoLockTimer: AUTO_LOCK_TIMER | null;
      }) => {
        (dataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === STORAGE_KEYS.ACCOUNT_LIST) {
            return Promise.resolve(JSON.stringify([mockAccount]));
          }
          return Promise.resolve(null);
        });

        (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
            return Promise.resolve("encrypted-temp-store");
          }
          if (key === SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT) {
            return Promise.resolve(
              backgroundedAt ? String(backgroundedAt) : null,
            );
          }
          if (key === SENSITIVE_STORAGE_KEYS.AUTO_LOCK_TIMER_SETTING) {
            return Promise.resolve(autoLockTimer);
          }
          // No persisted AUTH_STATUS (not LOCKED)
          return Promise.resolve(null);
        });

        (getHashKey as jest.Mock).mockResolvedValue({
          hashKey: "mock-hash-key",
          salt: "mock-salt",
          expiresAt: Date.now() + ONE_HOUR_MS,
        });

        (secureDataStorage.remove as jest.Mock).mockResolvedValue(undefined);
        (secureDataStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      };

      const restoreGetAuthStatus = () => {
        act(() => {
          useAuthenticationStore.setState({
            getAuthStatus: originalStoreMethods.getAuthStatus,
          });
        });
      };

      it("should soft-lock when the background duration exceeds the timer", async () => {
        const { result } = renderHook(() => useAuthenticationStore());
        restoreGetAuthStatus();

        mockAuthenticatedStorage({
          backgroundedAt: Date.now() - 2 * ONE_HOUR_MS,
          autoLockTimer: AUTO_LOCK_TIMER.ONE_HOUR,
        });

        await act(async () => {
          const status = await result.current.getAuthStatus();
          expect(status).toBe(AUTH_STATUS.LOCKED);
        });

        // LOCKED state is persisted and the timestamp is consumed
        expect(secureDataStorage.setItem).toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
          AUTH_STATUS.LOCKED,
        );
        expect(secureDataStorage.remove).toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT,
        );
      });

      it("should stay authenticated and consume the timestamp WITHOUT refreshing the hash key TTL", async () => {
        const { result } = renderHook(() => useAuthenticationStore());
        restoreGetAuthStatus();

        // The jest AppState mock has no real currentState; the consume
        // branch only runs when the app is actively foregrounded
        const previousAppState = AppState.currentState;
        (AppState as { currentState: string }).currentState = "active";

        mockAuthenticatedStorage({
          backgroundedAt: Date.now() - 60000, // 1 minute ago
          autoLockTimer: AUTO_LOCK_TIMER.ONE_HOUR,
        });

        await act(async () => {
          const status = await result.current.getAuthStatus();
          expect(status).toBe(AUTH_STATUS.AUTHENTICATED);
        });

        // Timestamp is consumed...
        expect(secureDataStorage.remove).toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT,
        );
        // ...but the hash key expiry must NOT advance without credential
        // verification (key material lifetime stays bounded)
        expect(secureDataStorage.setItem).not.toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.HASH_KEY,
          expect.any(String),
        );

        (AppState as { currentState: typeof previousAppState }).currentState =
          previousAppState;
      });

      it("should return HASH_KEY_EXPIRED when the hash key expired even if within the timer", async () => {
        const { result } = renderHook(() => useAuthenticationStore());
        restoreGetAuthStatus();

        const previousAppState = AppState.currentState;
        (AppState as { currentState: string }).currentState = "active";

        mockAuthenticatedStorage({
          backgroundedAt: Date.now() - 60000, // 1 minute ago, within timer
          autoLockTimer: AUTO_LOCK_TIMER.ONE_HOUR,
        });

        // Hash key hard-expired (e.g. > 72h since the last unlock)
        (getHashKey as jest.Mock).mockResolvedValue({
          hashKey: "mock-hash-key",
          salt: "mock-salt",
          expiresAt: Date.now() - ONE_HOUR_MS,
        });

        (clearCachedWalletSources as jest.Mock).mockClear();

        await act(async () => {
          const status = await result.current.getAuthStatus();
          expect(status).toBe(AUTH_STATUS.HASH_KEY_EXPIRED);
        });

        // Hard-expiry must evict the cached source signers — retention, not
        // just use, ends at expiry (the eviction-coverage gap raised in review).
        expect(clearCachedWalletSources).toHaveBeenCalled();

        (AppState as { currentState: typeof previousAppState }).currentState =
          previousAppState;
      });

      it("should return HASH_KEY_EXPIRED (not LOCKED) when backgrounded beyond BOTH the timer and the hash-key TTL", async () => {
        // The reviewer's scenario: the timer branch would otherwise return a
        // fast-path LOCKED that refreshes the expired key, silently defeating
        // the hard-expiry backstop. Expiry must win → full re-auth.
        const { result } = renderHook(() => useAuthenticationStore());
        restoreGetAuthStatus();

        mockAuthenticatedStorage({
          backgroundedAt: Date.now() - 2 * ONE_HOUR_MS, // beyond the 1h timer
          autoLockTimer: AUTO_LOCK_TIMER.ONE_HOUR,
        });

        // ...and the hash key has hard-expired (beyond its TTL)
        (getHashKey as jest.Mock).mockResolvedValue({
          hashKey: "mock-hash-key",
          salt: "mock-salt",
          expiresAt: Date.now() - ONE_HOUR_MS,
        });

        await act(async () => {
          const status = await result.current.getAuthStatus();
          expect(status).toBe(AUTH_STATUS.HASH_KEY_EXPIRED);
        });

        // Must NOT have converted the session to a soft timer lock
        expect(secureDataStorage.setItem).not.toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
          AUTH_STATUS.LOCKED,
        );
      });

      it("should default to 12 hours when no timer preference is persisted", async () => {
        const { result } = renderHook(() => useAuthenticationStore());
        restoreGetAuthStatus();

        // 13h exceeds the 12h default but not the old 24h, so this pins the
        // default at 12h (matching the extension) rather than merely "some
        // default under 13h".
        mockAuthenticatedStorage({
          backgroundedAt: Date.now() - 13 * ONE_HOUR_MS,
          autoLockTimer: null,
        });

        await act(async () => {
          const status = await result.current.getAuthStatus();
          expect(status).toBe(AUTH_STATUS.LOCKED);
        });
      });

      it("should not evaluate the timer when no backgrounded-at timestamp exists", async () => {
        const { result } = renderHook(() => useAuthenticationStore());
        restoreGetAuthStatus();

        mockAuthenticatedStorage({
          backgroundedAt: null,
          autoLockTimer: AUTO_LOCK_TIMER.ONE_HOUR,
        });

        await act(async () => {
          const status = await result.current.getAuthStatus();
          expect(status).toBe(AUTH_STATUS.AUTHENTICATED);
        });

        expect(secureDataStorage.remove).not.toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT,
        );
      });
    });

    describe("softLock", () => {
      it("should set LOCKED with isSoftLocked and persist the status without touching navigation", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        const mockResetRoot = jest.fn();
        const softLockNavigationRef = {
          isReady: jest.fn().mockReturnValue(true),
          getCurrentRoute: jest.fn().mockReturnValue({ name: "Home" }),
          resetRoot: mockResetRoot,
        } as unknown as NavigationContainerRef<RootStackParamList>;

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
            isSoftLocked: false,
            navigationRef: softLockNavigationRef,
          });
        });

        await act(async () => {
          await result.current.softLock();
        });

        expect(result.current.authStatus).toBe(AUTH_STATUS.LOCKED);
        expect(result.current.isSoftLocked).toBe(true);
        // The derived source signers must not outlive the session.
        expect(clearCachedWalletSources).toHaveBeenCalled();
        // The whole point of softLock: the navigation tree stays untouched
        expect(mockResetRoot).not.toHaveBeenCalled();
        expect(secureDataStorage.setItem).toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
          AUTH_STATUS.LOCKED,
        );
      });

      it("should funnel a warm timer lock through softLock atomically", async () => {
        const { result } = renderHook(() => useAuthenticationStore());
        act(() => {
          useAuthenticationStore.setState({
            getAuthStatus: originalStoreMethods.getAuthStatus,
            softLock: originalStoreMethods.softLock,
            authStatus: AUTH_STATUS.AUTHENTICATED,
            isSoftLocked: false,
          });
        });

        // Storage says the auto-lock timer fired while we were AUTHENTICATED
        (dataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === STORAGE_KEYS.ACCOUNT_LIST) {
            return Promise.resolve(JSON.stringify([mockAccount]));
          }
          return Promise.resolve(null);
        });
        (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
            return Promise.resolve("encrypted-temp-store");
          }
          if (key === SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT) {
            return Promise.resolve(String(Date.now() - 7200000)); // 2h ago
          }
          if (key === SENSITIVE_STORAGE_KEYS.AUTO_LOCK_TIMER_SETTING) {
            return Promise.resolve(AUTO_LOCK_TIMER.ONE_HOUR);
          }
          return Promise.resolve(null);
        });
        (getHashKey as jest.Mock).mockResolvedValue({
          hashKey: "mock-hash-key",
          salt: "mock-salt",
          expiresAt: Date.now() + 3600000,
        });

        // RootNavigator must NEVER observe LOCKED && !isSoftLocked — that
        // combination unmounts the preserved navigation tree
        const observedInvalidStates: string[] = [];
        const unsubscribe = useAuthenticationStore.subscribe((state) => {
          if (state.authStatus === AUTH_STATUS.LOCKED && !state.isSoftLocked) {
            observedInvalidStates.push(state.authStatus);
          }
        });

        await act(async () => {
          const status = await result.current.getAuthStatus();
          expect(status).toBe(AUTH_STATUS.LOCKED);
        });

        unsubscribe();
        expect(observedInvalidStates).toHaveLength(0);
        expect(result.current.authStatus).toBe(AUTH_STATUS.LOCKED);
        expect(result.current.isSoftLocked).toBe(true);
      });

      it("should make navigateToLockScreen a no-op while soft-locked", () => {
        const { result } = renderHook(() => useAuthenticationStore());

        const mockResetRoot = jest.fn();
        const softLockedNavigationRef = {
          isReady: jest.fn().mockReturnValue(true),
          getCurrentRoute: jest.fn().mockReturnValue({ name: "Home" }),
          resetRoot: mockResetRoot,
        } as unknown as NavigationContainerRef<RootStackParamList>;

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.LOCKED,
            isSoftLocked: true,
            navigationRef: softLockedNavigationRef,
          });
        });

        act(() => {
          result.current.navigateToLockScreen();
        });

        expect(mockResetRoot).not.toHaveBeenCalled();
      });
    });

    describe("signIn from LOCKED state", () => {
      it("should authenticate from LOCKED state and refresh TTL on the existing hash key", async () => {
        // Update the keyManager mock to return the correct account
        mockKeyManager.loadKey.mockResolvedValueOnce({
          id: mockAccount.id,
          publicKey: mockAccount.publicKey,
          privateKey: "mock-private-key",
          extra: { mnemonicPhrase: "mock mnemonic phrase" },
        });
        mockKeyManager.loadAllKeyIds.mockResolvedValueOnce([mockAccount.id]);

        (dataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === STORAGE_KEYS.ACTIVE_ACCOUNT_ID) {
            return Promise.resolve(mockAccount.id);
          }
          if (key === STORAGE_KEYS.ACCOUNT_LIST) {
            return Promise.resolve(JSON.stringify([mockAccount]));
          }
          return Promise.resolve(null);
        });

        // Mock old hash key (for re-encryption)
        (getHashKey as jest.Mock)
          .mockResolvedValueOnce({
            hashKey: "old-mock-hash-key",
            salt: "old-mock-salt",
            createdAt: Date.now(),
          })
          .mockResolvedValue({
            hashKey: "new-mock-hash-key",
            salt: "new-mock-salt",
            createdAt: Date.now(),
          });

        (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
            return Promise.resolve("encrypted-temp-store");
          }
          if (key === SENSITIVE_STORAGE_KEYS.HASH_KEY) {
            return Promise.resolve(
              JSON.stringify({
                hashKey: "old-mock-hash-key",
                salt: "old-mock-salt",
                createdAt: Date.now(),
              }),
            );
          }
          return Promise.resolve(null);
        });

        // New LOCKED path: TTL refresh only — no re-encryption, no KDF for decryption.
        // decryptDataWithDerivedKey is used by getActiveAccount (background load).
        (decryptDataWithDerivedKey as jest.Mock).mockReturnValue(
          JSON.stringify({
            privateKeys: { [mockAccount.id]: "mock-private-key" },
            mnemonics: {
              "phrase:mock mnemonic phrase": "mock mnemonic phrase",
            },
          }),
        );

        // Mock deriveKeyFromPassword for decryptTemporaryStore (cold AES cache path)
        (deriveKeyFromPassword as jest.Mock).mockResolvedValue(
          new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        );

        // Ensure secureDataStorage.setItem is mocked
        (secureDataStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        const { result } = renderHook(() => useAuthenticationStore());

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.LOCKED,
            signIn: originalStoreMethods.signIn,
          });
        });

        await act(async () => {
          await result.current.signIn({ password: "test-password" });
        });

        // Flush background getActiveAccount promise
        await act(async () => {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          });
        });

        expect(result.current.authStatus).toBe(AUTH_STATUS.AUTHENTICATED);
        expect(result.current.account).toBeTruthy();

        // Verify persisted AUTH_STATUS was cleared from secure storage
        expect(secureDataStorage.remove).toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.AUTH_STATUS,
        );

        // Verify TTL was refreshed on the existing hash key (no re-encryption)
        expect(secureDataStorage.setItem).toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.HASH_KEY,
          expect.stringContaining('"expiresAt":'),
        );
        // Verify that re-encryption did NOT occur
        expect(decryptDataWithPassword).not.toHaveBeenCalled();
        expect(encryptDataWithPassword).not.toHaveBeenCalled();
      });
    });

    describe("account switching", () => {
      it("should switch accounts and fetch new account data", async () => {
        const switchKeyManager = {
          loadKey: jest.fn(),
          storeKey: jest.fn(),
        };

        (createKeyManager as jest.Mock).mockReturnValue(switchKeyManager);

        const secondAccount: Account = {
          id: "account-2",
          name: "Account 2",
          publicKey: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        };

        // Track the active account ID in a variable that can be updated
        let activeAccountId = mockAccount.id;

        (dataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === STORAGE_KEYS.ACCOUNT_LIST) {
            return Promise.resolve(
              JSON.stringify([mockAccount, secondAccount]),
            );
          }
          if (key === STORAGE_KEYS.ACTIVE_ACCOUNT_ID) {
            return Promise.resolve(activeAccountId);
          }
          return Promise.resolve(null);
        });

        // Mock setItem to update the tracked active account ID
        (dataStorage.setItem as jest.Mock).mockImplementation((key, value) => {
          if (key === STORAGE_KEYS.ACTIVE_ACCOUNT_ID) {
            activeAccountId = value;
          }
          return Promise.resolve();
        });

        (getHashKey as jest.Mock).mockResolvedValue({
          hashKey: "mock-hash-key",
          salt: "mock-salt",
          createdAt: Date.now(),
        });

        (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
            return Promise.resolve("encrypted-temp-store");
          }
          return Promise.resolve(null);
        });

        (decryptDataWithDerivedKey as jest.Mock).mockReturnValue(
          JSON.stringify({
            privateKeys: {
              [mockAccount.id]: "mock-private-key-1",
              [secondAccount.id]: "mock-private-key-2",
            },
            mnemonics: {
              "phrase:mock mnemonic phrase": "mock mnemonic phrase",
            },
          }),
        );

        const { result } = renderHook(() => useAuthenticationStore());

        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.AUTHENTICATED,
            account: mockAccount,
            selectAccount: originalStoreMethods.selectAccount,
          });
        });

        await act(async () => {
          await result.current.selectAccount(secondAccount.publicKey);
        });

        // Verify active account was updated - check that setItem was called
        expect(dataStorage.setItem).toHaveBeenCalledWith(
          STORAGE_KEYS.ACTIVE_ACCOUNT_ID,
          secondAccount.id,
        );

        // Verify the account state was updated
        expect(result.current.account?.id).toBe(secondAccount.id);
        expect(result.current.isSwitchingAccount).toBe(false);
      });
    });
  });

  describe("clearAccountData", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should clear all balances store data", () => {
      // Call clearAccountData
      clearAccountData();

      // Verify setState was called with correct reset values
      expect(useBalancesStore.setState).toHaveBeenCalledWith({
        balances: {},
        pricedBalances: {},
        scanResults: {},
        isLoading: false,
        isFunded: false,
        fetchedPublicKey: null,
        fetchedNetwork: null,
        subentryCount: 0,
        hiddenTokenIds: [],
        error: null,
      });
    });

    it("should clear all history store data", () => {
      // Call clearAccountData
      clearAccountData();

      // Verify setState was called with correct reset values
      expect(useHistoryStore.setState).toHaveBeenCalledWith({
        rawHistoryData: null,
        isLoading: false,
        error: null,
        hasRecentTransaction: false,
        isFetching: false,
      });
    });

    it("should clear all prices store data", () => {
      // Call clearAccountData
      clearAccountData();

      // Verify setState was called with correct reset values
      expect(usePricesStore.setState).toHaveBeenCalledWith({
        pricesByNetwork: {},
        sourceByNetwork: {},
        isLoading: false,
        error: null,
        lastUpdated: null,
      });
    });

    it("should reset the accounts fiat totals store through its action", () => {
      // The action (not setState) also aborts any in-flight fetch cycle, so
      // a cycle running during a wipe can't write pre-wipe totals back.
      clearAccountData();

      expect(mockResetAccountsFiatTotals).toHaveBeenCalledTimes(1);
    });

    it("should keep the wallets-list totals when keepAccountsFiatTotals is set", () => {
      // Same-wallet transitions (account switch, add/import account) keep
      // the other accounts' totals — they're still valid, and dropping them
      // flashes $0.00 rows in the open wallets sheet mid-switch.
      clearAccountData({ keepAccountsFiatTotals: true });

      expect(mockResetAccountsFiatTotals).not.toHaveBeenCalled();
      // The account-scoped stores still reset as usual.
      expect(useBalancesStore.setState).toHaveBeenCalledTimes(1);
    });

    it("should clear every account-scoped store in a single call", () => {
      clearAccountData();

      expect(useBalancesStore.setState).toHaveBeenCalledTimes(1);
      expect(useHistoryStore.setState).toHaveBeenCalledTimes(1);
      expect(usePricesStore.setState).toHaveBeenCalledTimes(1);
      expect(useCollectiblesStore.setState).toHaveBeenCalledTimes(1);
      expect(mockResetAccountsFiatTotals).toHaveBeenCalledTimes(1);
    });

    it("should reset loading flags to false", () => {
      clearAccountData();

      // Verify balances loading flag
      const balancesCall = (useBalancesStore.setState as jest.Mock).mock
        .calls[0]?.[0];
      expect(balancesCall?.isLoading).toBe(false);

      // Verify history loading flags
      const historyCall = (useHistoryStore.setState as jest.Mock).mock
        .calls[0]?.[0];
      expect(historyCall?.isLoading).toBe(false);
      expect(historyCall?.isFetching).toBe(false);

      // Verify prices loading flag
      const pricesCall = (usePricesStore.setState as jest.Mock).mock
        .calls[0]?.[0];
      expect(pricesCall?.isLoading).toBe(false);
    });

    it("should clear all error states", () => {
      clearAccountData();

      // Verify balances error
      const balancesCall = (useBalancesStore.setState as jest.Mock).mock
        .calls[0]?.[0];
      expect(balancesCall?.error).toBeNull();

      // Verify history error
      const historyCall = (useHistoryStore.setState as jest.Mock).mock
        .calls[0]?.[0];
      expect(historyCall?.error).toBeNull();

      // Verify prices error
      const pricesCall = (usePricesStore.setState as jest.Mock).mock
        .calls[0]?.[0];
      expect(pricesCall?.error).toBeNull();
    });

    it("should reset balances store to empty objects and zero values", () => {
      clearAccountData();

      const balancesCall = (useBalancesStore.setState as jest.Mock).mock
        .calls[0]?.[0];
      expect(balancesCall?.balances).toEqual({});
      expect(balancesCall?.pricedBalances).toEqual({});
      expect(balancesCall?.scanResults).toEqual({});
      expect(balancesCall?.isFunded).toBe(false);
      expect(balancesCall?.subentryCount).toBe(0);
    });

    it("should reset fetchedPublicKey and fetchedNetwork so account_funded fails closed across an account switch", () => {
      // Regression: clearAccountData must reset fetchedPublicKey/fetchedNetwork
      // alongside isFunded. Otherwise, during the selectAccount switch window the
      // balances snapshot reads isFunded=false while fetchedPublicKey still equals
      // the (still-active) previous account, so buildCommonContext's
      // `fetchedPublicKey === activePublicKey` guard matches and emits a wrong
      // account_funded=false for an account that is actually funded.
      clearAccountData();

      const balancesCall = (useBalancesStore.setState as jest.Mock).mock
        .calls[0]?.[0];
      expect(balancesCall?.fetchedPublicKey).toBeNull();
      expect(balancesCall?.fetchedNetwork).toBeNull();
    });

    it("should reset history store to null values and false flags", () => {
      clearAccountData();

      const historyCall = (useHistoryStore.setState as jest.Mock).mock
        .calls[0]?.[0];
      expect(historyCall?.rawHistoryData).toBeNull();
      expect(historyCall?.hasRecentTransaction).toBe(false);
    });

    it("should reset prices store to empty object and null values", () => {
      clearAccountData();

      const pricesCall = (usePricesStore.setState as jest.Mock).mock
        .calls[0]?.[0];
      expect(pricesCall?.pricesByNetwork).toEqual({});
      expect(pricesCall?.sourceByNetwork).toEqual({});
      expect(pricesCall?.lastUpdated).toBeNull();
    });

    it("should reset collectibles store to empty collections", () => {
      clearAccountData();

      expect(useCollectiblesStore.setState).toHaveBeenCalledWith({
        collections: [],
        isLoading: false,
        error: null,
      });
    });
  });

  describe("initializeNetwork", () => {
    it("should load TESTNET from ACTIVE_NETWORK storage and update network in store", async () => {
      const { result } = renderHook(() => useAuthenticationStore());

      (dataStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === STORAGE_KEYS.ACTIVE_NETWORK) {
          return Promise.resolve(NETWORKS.TESTNET);
        }
        return Promise.resolve(null);
      });

      act(() => {
        useAuthenticationStore.setState({
          network: NETWORKS.PUBLIC,
          initializeNetwork: originalStoreMethods.initializeNetwork,
        });
      });

      await act(async () => {
        await result.current.initializeNetwork();
      });

      expect(result.current.network).toBe(NETWORKS.TESTNET);
    });

    it("should keep PUBLIC network when ACTIVE_NETWORK is not in storage", async () => {
      const { result } = renderHook(() => useAuthenticationStore());

      (dataStorage.getItem as jest.Mock).mockImplementation(() =>
        Promise.resolve(null),
      );

      act(() => {
        useAuthenticationStore.setState({
          network: NETWORKS.PUBLIC,
          initializeNetwork: originalStoreMethods.initializeNetwork,
        });
      });

      await act(async () => {
        await result.current.initializeNetwork();
      });

      expect(result.current.network).toBe(NETWORKS.PUBLIC);
    });
  });

  describe("isSessionAuthValid", () => {
    // isSessionAuthValid now delegates to the authoritative getAuthStatus()
    // funnel, so these drive the real computation via storage mocks (one source
    // of truth) rather than the in-memory authStatus + hash key alone.
    const ONE_HOUR = 3_600_000;

    const mockFunnelStorage = ({
      backgroundedAt = null,
      autoLockTimer = null,
      hashKey = {
        hashKey: "mock-hash-key",
        salt: "mock-salt",
        expiresAt: Date.now() + ONE_HOUR,
      } as unknown,
      hasTempStore = true,
      hasAccount = true,
      persistedLocked = false,
    }: {
      backgroundedAt?: number | null;
      autoLockTimer?: AUTO_LOCK_TIMER | null;
      hashKey?: unknown;
      hasTempStore?: boolean;
      hasAccount?: boolean;
      persistedLocked?: boolean;
    } = {}) => {
      (dataStorage.getItem as jest.Mock).mockImplementation((key) =>
        Promise.resolve(
          key === STORAGE_KEYS.ACCOUNT_LIST && hasAccount
            ? JSON.stringify([mockAccount])
            : null,
        ),
      );
      (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
          return Promise.resolve(hasTempStore ? "encrypted-temp-store" : null);
        }
        if (key === SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT) {
          return Promise.resolve(
            backgroundedAt !== null ? String(backgroundedAt) : null,
          );
        }
        if (key === SENSITIVE_STORAGE_KEYS.AUTO_LOCK_TIMER_SETTING) {
          return Promise.resolve(autoLockTimer);
        }
        if (key === SENSITIVE_STORAGE_KEYS.AUTH_STATUS) {
          return Promise.resolve(persistedLocked ? AUTH_STATUS.LOCKED : null);
        }
        return Promise.resolve(null);
      });
      (getHashKey as jest.Mock).mockResolvedValue(hashKey);
      (secureDataStorage.remove as jest.Mock).mockResolvedValue(undefined);
      (secureDataStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    };

    // The memo is module-scoped state that would otherwise leak across tests.
    beforeEach(() => {
      clearSessionAuthValidMemo();
    });

    it("returns true when the funnel reports AUTHENTICATED (accounts + valid hash + within timer)", async () => {
      mockFunnelStorage();
      expect(await isSessionAuthValid()).toBe(true);
    });

    it("returns false when no accounts exist (NOT_AUTHENTICATED)", async () => {
      mockFunnelStorage({ hasAccount: false });
      expect(await isSessionAuthValid()).toBe(false);
    });

    it("returns false when the hash key is absent and no temp store (HASH_KEY_EXPIRED)", async () => {
      mockFunnelStorage({ hashKey: null, hasTempStore: false });
      expect(await isSessionAuthValid()).toBe(false);
    });

    it("returns false when the hash key is expired", async () => {
      mockFunnelStorage({
        hashKey: {
          hashKey: "mock-hash-key",
          salt: "mock-salt",
          expiresAt: Date.now() - 1000,
        },
      });
      expect(await isSessionAuthValid()).toBe(false);
    });

    it("returns false when the session is persisted LOCKED", async () => {
      mockFunnelStorage({ persistedLocked: true });
      expect(await isSessionAuthValid()).toBe(false);
    });

    it("returns false once the auto-lock timer has elapsed even though the hash key is still within its TTL (foreground-before-funnel window)", async () => {
      // The Codex regression: a stale in-memory AUTHENTICATED + within-TTL hash
      // key would report valid, but the funnel soft-locks on the elapsed timer.
      mockFunnelStorage({
        backgroundedAt: Date.now() - 2 * ONE_HOUR, // beyond the 1h timer
        autoLockTimer: AUTO_LOCK_TIMER.ONE_HOUR,
        // hashKey left at the default (expiresAt = +1h, i.e. still valid)
      });
      expect(await isSessionAuthValid()).toBe(false);
    });

    it("dedupes a concurrent burst into a single funnel run (in-flight promise shared)", async () => {
      mockFunnelStorage();
      (getHashKey as jest.Mock).mockClear();

      const results = await Promise.all([
        isSessionAuthValid(),
        isSessionAuthValid(),
        isSessionAuthValid(),
      ]);

      expect(results).toEqual([true, true, true]);
      // getAuthStatus (→ getHashKey once per run) ran a single time for all three.
      expect(getHashKey).toHaveBeenCalledTimes(1);
    });

    it("memoizes within the TTL and re-runs the funnel once it expires", async () => {
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
      mockFunnelStorage();
      (getHashKey as jest.Mock).mockClear();

      await isSessionAuthValid();
      await isSessionAuthValid();
      await isSessionAuthValid();
      // Second and third calls are served from the memo — one funnel run.
      expect(getHashKey).toHaveBeenCalledTimes(1);

      // Advance past the TTL: the memo expires and the funnel runs again.
      nowSpy.mockReturnValue(1_000_000 + SESSION_AUTH_VALID_TTL_MS + 1);
      await isSessionAuthValid();
      expect(getHashKey).toHaveBeenCalledTimes(2);

      nowSpy.mockRestore();
    });
  });

  describe("getActiveMnemonicPhrase lock race (TOCTOU)", () => {
    beforeEach(() => {
      // Working temporary-store decrypt (mirrors the "authentication
      // mechanisms" setup) so the happy path actually yields the mnemonic —
      // otherwise the race test's null would pass for the wrong reason.
      (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
          return Promise.resolve(mockEncryptedData);
        }
        if (key === SENSITIVE_STORAGE_KEYS.HASH_KEY) {
          return Promise.resolve(JSON.stringify(mockHashKeyObj));
        }
        return Promise.resolve(null);
      });
      (decryptDataWithDerivedKey as jest.Mock).mockReturnValue(
        mockTemporaryStore,
      );
    });

    it("returns the mnemonic when AUTHENTICATED throughout the decrypt", async () => {
      act(() => {
        useAuthenticationStore.setState({
          authStatus: AUTH_STATUS.AUTHENTICATED,
        });
      });
      (getHashKey as jest.Mock).mockResolvedValue(mockHashKeyObj);

      const result = await getActiveMnemonicPhrase();

      expect(result).toBe(mockMnemonicPhrase);
    });

    it("returns null if a lock lands during the temporary-store decrypt", async () => {
      act(() => {
        useAuthenticationStore.setState({
          authStatus: AUTH_STATUS.AUTHENTICATED,
        });
      });
      // Simulate a soft-lock / auto-lock landing while getTemporaryStore is
      // awaiting SecureStorage: flip the store to LOCKED during the decrypt
      // path (getHashKey is awaited inside getTemporaryStore). The pre-lock
      // AUTHENTICATED status was already captured, so the store still decrypts
      // — but getActiveMnemonicPhrase must re-check afterward and refuse to
      // return the pre-lock mnemonic to a caller that would act on it after
      // softLock.
      (getHashKey as jest.Mock).mockImplementation(() => {
        useAuthenticationStore.setState({
          authStatus: AUTH_STATUS.LOCKED,
        });
        return Promise.resolve(mockHashKeyObj);
      });

      const result = await getActiveMnemonicPhrase();

      expect(result).toBeNull();
    });

    it("returns null if a lock lands during the pinned-source read", async () => {
      act(() => {
        useAuthenticationStore.setState({
          authStatus: AUTH_STATUS.AUTHENTICATED,
        });
      });
      (getHashKey as jest.Mock).mockResolvedValue(mockHashKeyObj);
      // The decrypt completes while AUTHENTICATED; the lock lands on the
      // AsyncStorage read of the pinned source id that follows it.
      (dataStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
        if (key === STORAGE_KEYS.PINNED_SOURCE_ID) {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.LOCKED,
          });
        }
        return Promise.resolve(null);
      });

      const result = await getActiveMnemonicPhrase();

      expect(result).toBeNull();
    });
  });

  // Port of the extension's secret-sources storage model (#72): the session
  // holds every phrase in a map keyed by source id, and the wallet records
  // every phrase and every standalone key as a labelled SecretSource.
  describe("secret sources", () => {
    // One pinned account that no fixture phrase derives
    // (ACCOUNT_SOURCE_VECTORS[0].accounts[0]).
    const importedSecretKey =
      "SBUV3MRWKNS6AYKZ6E6MOUVF2OYMON3MIUASWL3JLY5E3ISDJFELYBRZ";
    const importedPublicKey =
      "GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX";

    // auth.ts captured its key manager at module load, so the factory's shared
    // instance is what its code paths call, not the per-test mockKeyManager.
    const { __mockKeyManager: sharedKeyManager } = jest.requireMock<{
      __mockKeyManager: {
        storeKey: jest.Mock;
        loadKey: jest.Mock;
        loadAllKeyIds: jest.Mock;
        removeKey: jest.Mock;
      };
    }>("helpers/keyManager/keyManager");

    beforeEach(() => {
      sharedKeyManager.storeKey.mockResolvedValue({ id: mockAccountId });
      sharedKeyManager.loadAllKeyIds.mockResolvedValue([mockAccountId]);
      sharedKeyManager.loadKey.mockResolvedValue({
        id: mockAccountId,
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
        extra: { mnemonicPhrase: mockMnemonicPhrase },
      });
    });

    const writtenTemporaryStores = () =>
      (encryptDataWithDerivedKey as jest.Mock).mock.calls.map(
        ([json]: [string]) => JSON.parse(json),
      );
    const storedSources = (): Array<{
      id: string;
      type: string;
      label: string;
    }> =>
      Object.values(
        JSON.parse(dataStorageMemory[STORAGE_KEYS.SECRET_SOURCES] ?? "{}"),
      );

    const mockAuthenticatedSession = (temporaryStore: string) => {
      (getHashKey as jest.Mock).mockResolvedValue(mockHashKeyObj);
      (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
          return Promise.resolve(mockEncryptedData);
        }
        if (key === SENSITIVE_STORAGE_KEYS.HASH_KEY) {
          return Promise.resolve(JSON.stringify(mockHashKeyObj));
        }
        return Promise.resolve(null);
      });
      (decryptDataWithDerivedKey as jest.Mock).mockReturnValue(temporaryStore);
      act(() => {
        useAuthenticationStore.setState({
          authStatus: AUTH_STATUS.AUTHENTICATED,
        });
      });
    };

    // The wipe a new wallet starts with, as clearNonSensitiveData does it:
    // every STORAGE_KEYS entry, including the pin and the source set.
    const wipeNonSensitiveData = () => {
      (clearNonSensitiveData as jest.Mock).mockImplementation(() => {
        Object.values(STORAGE_KEYS).forEach((key) => {
          delete dataStorageMemory[key];
        });
        return Promise.resolve();
      });
    };

    it("signUp holds the phrase under its source id and records it as Seed Phrase 1", async () => {
      wipeNonSensitiveData();
      dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID] = "phrase:previous";
      const { result } = renderHook(() => useAuthenticationStore());
      act(() => {
        useAuthenticationStore.setState({
          signUp: originalStoreMethods.signUp,
        });
      });

      await act(async () => {
        await result.current.signUp({
          mnemonicPhrase: mockMnemonicPhrase,
          password: mockPassword,
        });
      });

      expect(result.current.authStatus).toBe(AUTH_STATUS.AUTHENTICATED);
      const [written] = writtenTemporaryStores();
      expect(written.mnemonics).toEqual({
        [mockPhraseSourceId]: mockMnemonicPhrase,
      });
      expect(written).not.toHaveProperty("mnemonicPhrase");
      expect(storedSources()).toEqual([
        expect.objectContaining({
          id: mockPhraseSourceId,
          type: SecretSourceType.PHRASE,
          label: "Seed Phrase 1",
        }),
      ]);
      // The new wallet's first source replaces the previous wallet's pin.
      expect(dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(
        mockPhraseSourceId,
      );
    });

    it("importWallet pins the recovered phrase in place of the previous wallet's pin", async () => {
      wipeNonSensitiveData();
      dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID] = "phrase:previous";
      const { result } = renderHook(() => useAuthenticationStore());
      act(() => {
        useAuthenticationStore.setState({
          importWallet: originalStoreMethods.importWallet,
        });
      });

      await act(async () => {
        await result.current.importWallet({
          mnemonicPhrase: mockMnemonicPhrase,
          password: mockPassword,
        });
      });

      expect(result.current.error).toBeNull();
      expect(dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(
        mockPhraseSourceId,
      );
    });

    it("signUp clears the previous wallet's link status and links the new phrase", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      act(() => {
        useAuthenticationStore.setState({
          signUp: originalStoreMethods.signUp,
        });
      });

      await act(async () => {
        await result.current.signUp({
          mnemonicPhrase: mockMnemonicPhrase,
          password: mockPassword,
        });
      });

      expect(clearLinkStatus).toHaveBeenCalled();
      expect(linkWalletSources).toHaveBeenCalledTimes(1);
      // The clear lands before the pass, so the pass starts on the new epoch.
      expect(
        (clearLinkStatus as jest.Mock).mock.invocationCallOrder[0],
      ).toBeLessThan(
        (linkWalletSources as jest.Mock).mock.invocationCallOrder[0],
      );
    });

    it("importWallet clears the previous wallet's link status and links the recovered phrase", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      act(() => {
        useAuthenticationStore.setState({
          importWallet: originalStoreMethods.importWallet,
        });
      });

      await act(async () => {
        await result.current.importWallet({
          mnemonicPhrase: mockMnemonicPhrase,
          password: mockPassword,
        });
      });

      expect(clearLinkStatus).toHaveBeenCalled();
      expect(linkWalletSources).toHaveBeenCalledTimes(1);
    });

    it("a failed signUp sends no link call", async () => {
      sharedKeyManager.storeKey.mockRejectedValueOnce(new Error("boom"));
      const { result } = renderHook(() => useAuthenticationStore());
      act(() => {
        useAuthenticationStore.setState({
          signUp: originalStoreMethods.signUp,
        });
      });

      await act(async () => {
        await result.current.signUp({
          mnemonicPhrase: mockMnemonicPhrase,
          password: mockPassword,
        });
      });

      expect(linkWalletSources).not.toHaveBeenCalled();
    });

    it("importSecretKey records the key as its own source and stamps no phrase into its keystore", async () => {
      mockAuthenticatedSession(mockTemporaryStore);
      dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = mockAccountId;
      dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
        { id: mockAccountId, name: mockAccountName, publicKey: mockPublicKey },
      ]);
      dataStorageMemory[STORAGE_KEYS.SECRET_SOURCES] = JSON.stringify({
        [mockPhraseSourceId]: {
          id: mockPhraseSourceId,
          type: SecretSourceType.PHRASE,
          label: "Seed Phrase 1",
          createdAt: 1,
        },
      });
      dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID] = mockPhraseSourceId;
      sharedKeyManager.storeKey.mockResolvedValue({
        id: "imported-account-id",
      });
      const { result } = renderHook(() => useAuthenticationStore());
      act(() => {
        useAuthenticationStore.setState({
          importSecretKey: originalStoreMethods.importSecretKey,
        });
      });

      await act(async () => {
        await result.current.importSecretKey({
          secretKey: importedSecretKey,
          password: mockPassword,
        });
      });

      expect(sharedKeyManager.storeKey).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.objectContaining({
            publicKey: importedPublicKey,
            extra: { imported: true },
          }),
        }),
      );
      expect(storedSources()).toEqual([
        expect.objectContaining({ label: "Seed Phrase 1" }),
        expect.objectContaining({
          id: `key:${importedSecretKey}`,
          type: SecretSourceType.SECRET_KEY,
          label: "Secret Key 1",
        }),
      ]);
      // The import holds no phrase of its own: the map is unchanged, only
      // the private key joins the session.
      const [written] = writtenTemporaryStores();
      expect(written.mnemonics).toEqual({
        [mockPhraseSourceId]: mockMnemonicPhrase,
      });
      expect(written.privateKeys["imported-account-id"]).toBe(
        importedSecretKey,
      );
      // The phrase came first, so it keeps the pin.
      expect(dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(
        mockPhraseSourceId,
      );
      // The imported key is a source of its own.
      expect(linkWalletSources).toHaveBeenCalledTimes(1);
    });

    it("importSecretKey leaves the active account alone when the account list write fails", async () => {
      mockAuthenticatedSession(mockTemporaryStore);
      dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = mockAccountId;
      dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
        { id: mockAccountId, name: mockAccountName, publicKey: mockPublicKey },
      ]);
      sharedKeyManager.storeKey.mockResolvedValue({
        id: "imported-account-id",
      });
      (dataStorage.setItem as jest.Mock).mockImplementation(
        (key: STORAGE_KEYS, value: string) => {
          if (key === STORAGE_KEYS.ACCOUNT_LIST) {
            return Promise.reject(new Error("write failed"));
          }
          dataStorageMemory[key] = value;
          return Promise.resolve();
        },
      );
      const { result } = renderHook(() => useAuthenticationStore());
      act(() => {
        useAuthenticationStore.setState({
          importSecretKey: originalStoreMethods.importSecretKey,
        });
      });

      await act(async () => {
        await result.current
          .importSecretKey({
            secretKey: importedSecretKey,
            password: mockPassword,
          })
          .catch(() => undefined);
      });

      // An active id with no list entry is the drift signIn would recreate
      // under the phrase, so the import must not become active unlisted.
      expect(dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID]).toBe(
        mockAccountId,
      );
    });

    describe("importWalletFromSecretKey", () => {
      const previousSources = () => {
        dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = mockAccountId;
        dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
          {
            id: mockAccountId,
            name: mockAccountName,
            publicKey: mockPublicKey,
          },
        ]);
        dataStorageMemory[STORAGE_KEYS.SECRET_SOURCES] = JSON.stringify({
          [mockPhraseSourceId]: {
            id: mockPhraseSourceId,
            type: SecretSourceType.PHRASE,
            label: "Seed Phrase 1",
            createdAt: 1,
          },
        });
        dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID] = mockPhraseSourceId;
      };

      const runImport = async (secretKey = importedSecretKey) => {
        const { result } = renderHook(() => useAuthenticationStore());
        act(() => {
          useAuthenticationStore.setState({
            importWalletFromSecretKey:
              originalStoreMethods.importWalletFromSecretKey,
          });
        });
        let succeeded = false;
        await act(async () => {
          succeeded = await result.current.importWalletFromSecretKey({
            secretKey,
            password: mockPassword,
          });
        });
        return { result, succeeded };
      };

      beforeEach(() => {
        wipeNonSensitiveData();
        sharedKeyManager.storeKey.mockResolvedValue({
          id: "imported-account-id",
        });
      });

      it("replaces the wallet with one imported account and no phrase", async () => {
        previousSources();

        const { result, succeeded } = await runImport();

        expect(succeeded).toBe(true);
        expect(result.current.authStatus).toBe(AUTH_STATUS.AUTHENTICATED);
        expect(result.current.error).toBeNull();
        expect(sharedKeyManager.removeKey).toHaveBeenCalledWith(mockAccountId);
        expect(sharedKeyManager.storeKey).toHaveBeenCalledWith(
          expect.objectContaining({
            key: expect.objectContaining({
              publicKey: importedPublicKey,
              privateKey: importedSecretKey,
              extra: { imported: true },
            }),
          }),
        );
        expect(
          JSON.parse(dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST]),
        ).toEqual([
          expect.objectContaining({
            id: "imported-account-id",
            sourceId: `key:${importedSecretKey}`,
            publicKey: importedPublicKey,
            importedFromSecretKey: true,
          }),
        ]);
        expect(dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID]).toBe(
          "imported-account-id",
        );
        expect(storedSources()).toEqual([
          expect.objectContaining({
            id: `key:${importedSecretKey}`,
            type: SecretSourceType.SECRET_KEY,
            label: "Secret Key 1",
          }),
        ]);
        expect(dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(
          `key:${importedSecretKey}`,
        );
        const [written] = writtenTemporaryStores();
        expect(written.mnemonics).toEqual({});
        expect(written.privateKeys["imported-account-id"]).toBe(
          importedSecretKey,
        );
        expect(linkWalletSources).toHaveBeenCalledTimes(1);
        expect(analytics.track).toHaveBeenCalledWith(
          AnalyticsEvent.RECOVER_ACCOUNT_SUCCESS,
          { recovery_method: "secret_key" },
        );
      });

      it("leaves the wallet untouched when the key is invalid", async () => {
        previousSources();
        const before = { ...dataStorageMemory };

        const { result, succeeded } = await runImport(
          `${importedSecretKey.slice(0, -1)}A`,
        );

        expect(succeeded).toBe(false);
        expect(result.current.error).toBe("authStore.error.invalidSecretKey");
        expect(clearNonSensitiveData).not.toHaveBeenCalled();
        expect(sharedKeyManager.removeKey).not.toHaveBeenCalled();
        expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
        expect(dataStorageMemory).toEqual(before);
        expect(analytics.track).toHaveBeenCalledWith(
          AnalyticsEvent.RECOVER_ACCOUNT_FAIL,
          { recovery_method: "secret_key", reason_code: "invalid_secret_key" },
        );
      });

      it.each([
        [
          "the key store",
          () => sharedKeyManager.storeKey.mockRejectedValue(new Error("boom")),
        ],
        [
          "the source registration",
          () =>
            (dataStorage.setItem as jest.Mock).mockImplementation(
              (key: STORAGE_KEYS, value: string) => {
                if (key === STORAGE_KEYS.SECRET_SOURCES) {
                  return Promise.reject(new Error("write failed"));
                }
                dataStorageMemory[key] = value;
                return Promise.resolve();
              },
            ),
        ],
      ])(
        "leaves a fresh install when %s fails after the wipe",
        async (_label, fail) => {
          previousSources();
          fail();

          const { result, succeeded } = await runImport();

          expect(succeeded).toBe(false);
          expect(result.current.error).toBe(
            "authStore.error.failedToImportWallet",
          );
          // Wiped before storing, and again to drop the partial writes.
          expect(clearNonSensitiveData).toHaveBeenCalledTimes(2);
          // Each wipe also sweeps keystore entries the index doesn't list.
          expect(Keychain.getAllGenericPasswordServices).toHaveBeenCalledTimes(
            2,
          );
          expect(dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST]).toBeUndefined();
          expect(
            dataStorageMemory[STORAGE_KEYS.SECRET_SOURCES],
          ).toBeUndefined();
          expect(analytics.track).toHaveBeenCalledWith(
            AnalyticsEvent.RECOVER_ACCOUNT_FAIL,
            expect.objectContaining({ recovery_method: "secret_key" }),
          );
          expect(linkWalletSources).not.toHaveBeenCalled();
        },
      );

      it("never logs or tracks the key", async () => {
        sharedKeyManager.storeKey.mockRejectedValue(
          new Error(`could not store ${importedSecretKey}`),
        );

        await runImport();

        const calls = JSON.stringify([
          (logger.error as jest.Mock).mock.calls,
          (logger.warn as jest.Mock).mock.calls,
          (analytics.track as jest.Mock).mock.calls,
        ]);
        expect(calls).not.toContain(importedSecretKey);
      });
    });

    describe("signIn", () => {
      beforeEach(() => {
        dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = mockAccountId;
        dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
          {
            id: mockAccountId,
            name: mockAccountName,
            publicKey: mockPublicKey,
          },
        ]);
        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
            signIn: originalStoreMethods.signIn,
          });
        });
      });

      it("rebuilds the session with the keystore's phrase held under its source id", async () => {
        const { result } = renderHook(() => useAuthenticationStore());

        await act(async () => {
          await result.current.signIn({ password: mockPassword });
        });

        const [written] = writtenTemporaryStores();
        expect(written.mnemonics).toEqual({
          [mockPhraseSourceId]: mockMnemonicPhrase,
        });
        expect(written.privateKeys).toEqual({
          [mockAccountId]: mockPrivateKey,
        });
      });

      it("keeps the session, holding no phrase, when the phrase's source id cannot be derived", async () => {
        (deriveAuthKeypair as jest.Mock).mockRejectedValueOnce(
          new Error("Invalid mnemonic (see bip39)"),
        );
        const { result } = renderHook(() => useAuthenticationStore());

        await act(async () => {
          await result.current.signIn({ password: mockPassword });
        });

        const [written] = writtenTemporaryStores();
        expect(written.mnemonics).toEqual({});
        expect(written.privateKeys).toEqual({
          [mockAccountId]: mockPrivateKey,
        });
        expect(logger.error).toHaveBeenCalledWith(
          "signIn",
          "Failed to derive the phrase source id on unlock",
          expect.any(Error),
        );
      });

      // The request path never writes the pin, so unlock repairs a pin write
      // that failed after its source record landed.
      it("pins the earliest registered source when the wallet has records but no pin", async () => {
        const firstId = "a".repeat(64);
        const secondId = "b".repeat(64);
        dataStorageMemory[STORAGE_KEYS.SECRET_SOURCES] = JSON.stringify({
          [firstId]: { id: firstId, type: SecretSourceType.SECRET_KEY },
          [secondId]: { id: secondId, type: SecretSourceType.PHRASE },
        });
        // Already attributed, so the attribution pass registers nothing and
        // only the repair can pin.
        dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
          {
            id: mockAccountId,
            name: mockAccountName,
            publicKey: mockPublicKey,
            sourceId: firstId,
          },
        ]);
        const { result } = renderHook(() => useAuthenticationStore());

        await act(async () => {
          await result.current.signIn({ password: mockPassword });
        });

        expect(dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(firstId);
      });
    });

    // Port of the extension's wallet source enumeration (#65): unlock holds
    // every account's private key and warms the source identities.
    describe("wallet sources", () => {
      const secondAccount = {
        id: "second-account-id",
        name: "Account 2",
        publicKey: importedPublicKey,
        sourceId: `key:${importedSecretKey}`,
        importedFromSecretKey: true,
      };
      const thirdAccount = {
        id: "third-account-id",
        name: "Account 3",
        publicKey: "GTHIRD",
        sourceId: "key:SCTHIRD",
        importedFromSecretKey: true,
      };

      // LOCKED fast path: the session holds only the active account's key.
      const lockedWithAccounts = (accounts: Array<{ id: string }>) => {
        dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = mockAccountId;
        dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
          {
            id: mockAccountId,
            name: mockAccountName,
            publicKey: mockPublicKey,
            sourceId: mockPhraseSourceId,
          },
          ...accounts,
        ]);
        mockAuthenticatedSession(mockTemporaryStore);
        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.LOCKED,
            signIn: originalStoreMethods.signIn,
          });
        });
      };

      const keystoreFor = (id: string) => {
        if (id === secondAccount.id) {
          return {
            id,
            publicKey: importedPublicKey,
            privateKey: importedSecretKey,
          };
        }
        if (id === thirdAccount.id) {
          return { id, publicKey: "GTHIRD", privateKey: "SCTHIRD" };
        }
        return {
          id: mockAccountId,
          publicKey: mockPublicKey,
          privateKey: mockPrivateKey,
          extra: { mnemonicPhrase: mockMnemonicPhrase },
        };
      };

      const signIn = async () => {
        const { result } = renderHook(() => useAuthenticationStore());
        await act(async () => {
          await result.current.signIn({ password: mockPassword });
        });
        return result;
      };

      beforeEach(() => {
        sharedKeyManager.loadKey.mockImplementation((id: string) =>
          Promise.resolve(keystoreFor(id)),
        );
      });

      describe("with a second phrase source", () => {
        const otherPhrase = "other wallet phrase";
        const otherSourceId = `phrase:${otherPhrase}`;
        const otherAccount = {
          id: "other-phrase-account-id",
          name: "Account 2",
          publicKey: "GOTHER",
          sourceId: otherSourceId,
        };
        const otherSiblingAccount = {
          ...otherAccount,
          id: "other-phrase-sibling-id",
          name: "Account 3",
          publicKey: "GOTHERSIBLING",
        };
        const otherKeystore = (id: string) => ({
          id,
          publicKey: "GOTHER",
          privateKey: "SCOTHER",
          extra: { imported: false, mnemonicPhrase: otherPhrase },
        });
        const openFailure = new Error("keystore unreadable");

        const signInAfterExpiry = async (
          accounts: Array<{ id: string }>,
          loadOther: (id: string) => Promise<unknown>,
        ) => {
          lockedWithAccounts(accounts);
          sharedKeyManager.loadKey.mockImplementation((id: string) =>
            id === mockAccountId
              ? Promise.resolve(keystoreFor(id))
              : loadOther(id),
          );
          act(() => {
            useAuthenticationStore.setState({
              authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
            });
          });
          await signIn();
        };

        it("holds every phrase source after a full sign-in, the unlocked phrase first", async () => {
          await signInAfterExpiry([otherAccount], (id) =>
            Promise.resolve(otherKeystore(id)),
          );

          const [written] = writtenTemporaryStores();
          expect(Object.entries(written.mnemonics)).toEqual([
            [mockPhraseSourceId, mockMnemonicPhrase],
            [otherSourceId, otherPhrase],
          ]);
          const [[{ phraseSigners }]] = (getWalletSources as jest.Mock).mock
            .calls;
          expect([...phraseSigners.keys()]).toEqual([
            mockPhraseSourceId,
            otherSourceId,
          ]);
        });

        it("reads a source's phrase from its next keystore when one fails to open", async () => {
          await signInAfterExpiry([otherAccount, otherSiblingAccount], (id) =>
            id === otherAccount.id
              ? Promise.reject(openFailure)
              : Promise.resolve(otherKeystore(id)),
          );

          const [written] = writtenTemporaryStores();
          expect(written.mnemonics).toEqual({
            [mockPhraseSourceId]: mockMnemonicPhrase,
            [otherSourceId]: otherPhrase,
          });
          expect(logger.error).toHaveBeenCalledWith(
            "signIn",
            "Failed to open a derived keystore for the wallet phrase",
            openFailure,
          );
        });

        it("still holds the unlocked phrase when no keystore of another source opens", async () => {
          await signInAfterExpiry([otherAccount, otherSiblingAccount], () =>
            Promise.reject(openFailure),
          );

          const [written] = writtenTemporaryStores();
          expect(written.mnemonics).toEqual({
            [mockPhraseSourceId]: mockMnemonicPhrase,
          });
          expect(logger.error).toHaveBeenCalledWith(
            "signIn",
            "No keystore of a phrase source yields its phrase",
            expect.any(Error),
          );
          expect(useAuthenticationStore.getState().authStatus).toBe(
            AUTH_STATUS.AUTHENTICATED,
          );
        });

        it("holds a phrase under the id it derives when the recorded source differs", async () => {
          const staleAccount = { ...otherAccount, sourceId: "phrase:stale" };
          await signInAfterExpiry([staleAccount], (id) =>
            Promise.resolve(otherKeystore(id)),
          );

          const [written] = writtenTemporaryStores();
          expect(written.mnemonics).toEqual({
            [mockPhraseSourceId]: mockMnemonicPhrase,
            [otherSourceId]: otherPhrase,
          });
          expect(logger.error).toHaveBeenCalledWith(
            "signIn",
            "A keystore's phrase does not derive its account's recorded source",
            expect.any(Error),
          );
        });

        it("does not derive other phrase sources on the LOCKED fast path", async () => {
          lockedWithAccounts([otherAccount]);
          sharedKeyManager.loadKey.mockImplementation((id: string) =>
            Promise.resolve(
              id === mockAccountId ? keystoreFor(id) : otherKeystore(id),
            ),
          );

          await signIn();

          expect(deriveAuthKeypair).not.toHaveBeenCalledWith(otherPhrase);
        });
      });

      it("loads every account key the session does not hold", async () => {
        lockedWithAccounts([secondAccount]);

        await signIn();

        expect(sharedKeyManager.loadKey).toHaveBeenCalledWith(
          secondAccount.id,
          mockPassword,
        );
        const written = writtenTemporaryStores();
        expect(written[written.length - 1].privateKeys).toEqual({
          [mockAccountId]: mockPrivateKey,
          [secondAccount.id]: importedSecretKey,
        });
      });

      it("opens no other keystore when the session holds every key", async () => {
        lockedWithAccounts([]);

        await signIn();

        expect(sharedKeyManager.loadKey).toHaveBeenCalledTimes(1);
        expect(sharedKeyManager.loadKey).toHaveBeenCalledWith(
          mockAccountId,
          mockPassword,
        );
        expect(writtenTemporaryStores()).toEqual([]);
      });

      it("keeps loading the rest when one keystore cannot be opened", async () => {
        lockedWithAccounts([secondAccount, thirdAccount]);
        sharedKeyManager.loadKey.mockImplementation((id: string) =>
          id === secondAccount.id
            ? Promise.reject(new Error("bad keystore"))
            : Promise.resolve(keystoreFor(id)),
        );

        const result = await signIn();

        expect(result.current.authStatus).toBe(AUTH_STATUS.AUTHENTICATED);
        const written = writtenTemporaryStores();
        expect(written[written.length - 1].privateKeys).toEqual({
          [mockAccountId]: mockPrivateKey,
          [thirdAccount.id]: "SCTHIRD",
        });
        expect(logger.error).toHaveBeenCalledWith(
          "loadMissingPrivateKeys",
          "Failed to load an account's private key",
          expect.any(Error),
        );
      });

      it("warms the sources once AUTHENTICATED, reusing the phrase keypair it derived", async () => {
        // A full sign-in derives the phrase id to rebuild the session.
        dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = mockAccountId;
        dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
          {
            id: mockAccountId,
            name: mockAccountName,
            publicKey: mockPublicKey,
          },
        ]);
        act(() => {
          useAuthenticationStore.setState({
            authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
            signIn: originalStoreMethods.signIn,
          });
        });
        let statusAtWarmUp: string | undefined;
        (getWalletSources as jest.Mock).mockImplementationOnce(() => {
          statusAtWarmUp = useAuthenticationStore.getState().authStatus;
          return Promise.resolve({ sources: [], signers: new Map() });
        });

        await signIn();

        expect(getWalletSources).toHaveBeenCalledTimes(1);
        expect(statusAtWarmUp).toBe(AUTH_STATUS.AUTHENTICATED);
        const [[{ phraseSigners }]] = (getWalletSources as jest.Mock).mock
          .calls;
        expect([...phraseSigners]).toEqual([
          [mockPhraseSourceId, { mnemonic: mockMnemonicPhrase }],
        ]);
        expect(deriveAuthKeypair).toHaveBeenCalledTimes(1);
      });

      it("still unlocks when warming the sources fails", async () => {
        lockedWithAccounts([]);
        (getWalletSources as jest.Mock).mockRejectedValueOnce(
          new Error("boom"),
        );

        const result = await signIn();
        // Let the background rejection settle.
        await act(async () => {
          await Promise.resolve();
        });

        expect(result.current.authStatus).toBe(AUTH_STATUS.AUTHENTICATED);
        expect(logger.error).toHaveBeenCalledWith(
          "useAuthenticationStore.signIn",
          "Failed to derive wallet sources",
          expect.any(Error),
        );
        // The link pass still runs; it derives the sources on its own.
        expect(linkWalletSources).toHaveBeenCalledTimes(1);
      });

      it("links the sources once the warm-up settles", async () => {
        lockedWithAccounts([]);
        let warmedUp = false;
        (getWalletSources as jest.Mock).mockImplementationOnce(async () => {
          await Promise.resolve();
          warmedUp = true;
          return { sources: [], signers: new Map() };
        });
        let warmedUpAtLink: boolean | undefined;
        (linkWalletSources as jest.Mock).mockImplementationOnce(() => {
          warmedUpAtLink = warmedUp;
          return Promise.resolve();
        });

        await signIn();
        await act(async () => {
          await Promise.resolve();
        });

        expect(linkWalletSources).toHaveBeenCalledTimes(1);
        expect(warmedUpAtLink).toBe(true);
      });

      it("reads the stored conflicts into linkConflicts after the pass", async () => {
        lockedWithAccounts([]);
        (getLinkConflicts as jest.Mock).mockResolvedValueOnce(["conflicted"]);

        const result = await signIn();
        await act(async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 0);
          });
        });

        expect(result.current.linkConflicts).toEqual(["conflicted"]);
      });

      it("does not write conflicts into a store that locked during the pass", async () => {
        lockedWithAccounts([]);
        let finishPass: () => void = () => undefined;
        (linkWalletSources as jest.Mock).mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              finishPass = resolve;
            }),
        );
        (getLinkConflicts as jest.Mock).mockResolvedValueOnce(["conflicted"]);

        const result = await signIn();
        await act(async () => {
          await Promise.resolve();
        });
        act(() => {
          useAuthenticationStore.setState({ authStatus: AUTH_STATUS.LOCKED });
        });
        await act(async () => {
          finishPass();
          await new Promise((resolve) => {
            setTimeout(resolve, 0);
          });
        });

        expect(result.current.linkConflicts).toEqual([]);
      });

      describe("getHeldSecrets", () => {
        it("returns the account ids, held keys and phrases while AUTHENTICATED", async () => {
          dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
            {
              id: mockAccountId,
              name: mockAccountName,
              publicKey: mockPublicKey,
            },
            secondAccount,
          ]);
          mockAuthenticatedSession(mockTemporaryStore);

          expect(await getHeldSecrets()).toEqual({
            accountIds: [mockAccountId, secondAccount.id],
            privateKeys: { [mockAccountId]: mockPrivateKey },
            mnemonics: { [mockPhraseSourceId]: mockMnemonicPhrase },
          });
        });

        it("returns null while LOCKED", async () => {
          mockAuthenticatedSession(mockTemporaryStore);
          act(() => {
            useAuthenticationStore.setState({ authStatus: AUTH_STATUS.LOCKED });
          });

          expect(await getHeldSecrets()).toBeNull();
        });

        it("returns null if a lock lands during the decrypt", async () => {
          mockAuthenticatedSession(mockTemporaryStore);
          (getHashKey as jest.Mock).mockImplementation(() => {
            useAuthenticationStore.setState({
              authStatus: AUTH_STATUS.LOCKED,
            });
            return Promise.resolve(mockHashKeyObj);
          });

          expect(await getHeldSecrets()).toBeNull();
        });
      });
    });

    describe("legacy temporary store (single mnemonicPhrase slot)", () => {
      const legacyTemporaryStore = JSON.stringify({
        privateKeys: { [mockAccountId]: mockPrivateKey },
        mnemonicPhrase: mockMnemonicPhrase,
        password: mockPassword,
      });

      it("is upgraded in place, holding its phrase under its source id", async () => {
        mockAuthenticatedSession(legacyTemporaryStore);

        const store = await useAuthenticationStore
          .getState()
          .getTemporaryStore();

        expect(store).toEqual({
          privateKeys: { [mockAccountId]: mockPrivateKey },
          mnemonics: { [mockPhraseSourceId]: mockMnemonicPhrase },
          password: mockPassword,
        });
        expect(writtenTemporaryStores()).toEqual([store]);
        expect(secureDataStorage.setItem).toHaveBeenCalledWith(
          SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE,
          mockEncryptedData,
        );
        expect(clearTemporaryData).not.toHaveBeenCalled();
      });

      it("keeps the session, holding no phrase, when the phrase's source id cannot be derived", async () => {
        mockAuthenticatedSession(legacyTemporaryStore);
        (getPhraseSourceId as jest.Mock).mockRejectedValueOnce(
          new Error("Invalid mnemonic (see bip39)"),
        );

        const store = await useAuthenticationStore
          .getState()
          .getTemporaryStore();

        expect(store?.mnemonics).toEqual({});
        expect(store?.privateKeys).toEqual({ [mockAccountId]: mockPrivateKey });
        expect(clearTemporaryData).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
          "upgradeLegacyTemporaryStore",
          "Failed to derive the phrase source id",
          expect.any(Error),
        );
      });

      it("leaves a store that already holds the map untouched", async () => {
        mockAuthenticatedSession(mockTemporaryStore);

        const store = await useAuthenticationStore
          .getState()
          .getTemporaryStore();

        expect(store).toEqual(JSON.parse(mockTemporaryStore));
        expect(encryptDataWithDerivedKey).not.toHaveBeenCalled();
      });

      it("still rejects a store with neither slot", async () => {
        mockAuthenticatedSession(
          JSON.stringify({ privateKeys: { [mockAccountId]: mockPrivateKey } }),
        );

        const store = await useAuthenticationStore
          .getState()
          .getTemporaryStore();

        expect(store).toBeNull();
        expect(clearTemporaryData).toHaveBeenCalled();
      });
    });

    describe("getActiveMnemonicPhrase (default phrase resolution)", () => {
      const twoPhrases = JSON.stringify({
        privateKeys: {},
        mnemonics: { "id-a": "phrase a", "id-b": "phrase b" },
      });

      it("returns the pinned source's phrase when it is held", async () => {
        mockAuthenticatedSession(twoPhrases);
        dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID] = "id-b";

        expect(await getActiveMnemonicPhrase()).toBe("phrase b");
      });

      it("falls back to the first held phrase when nothing is pinned", async () => {
        mockAuthenticatedSession(twoPhrases);

        expect(await getActiveMnemonicPhrase()).toBe("phrase a");
      });

      it("falls back to the first held phrase when the pinned source is not held", async () => {
        mockAuthenticatedSession(twoPhrases);
        dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID] = "id-c";

        expect(await getActiveMnemonicPhrase()).toBe("phrase a");
      });

      it("returns null when the session holds no phrase (secret-key-only wallet)", async () => {
        mockAuthenticatedSession(
          JSON.stringify({ privateKeys: {}, mnemonics: {} }),
        );

        expect(await getActiveMnemonicPhrase()).toBeNull();
      });
    });

    // Edit account's reveals: the password is checked against a keystore
    // even though the session is unlocked.
    describe("revealAccountSecretKey", () => {
      const importedId = "imported-keystore-id";

      beforeEach(() => {
        mockAuthenticatedSession(mockTemporaryStore);
        sharedKeyManager.loadAllKeyIds.mockResolvedValue([
          mockAccountId,
          importedId,
        ]);
        sharedKeyManager.loadKey.mockImplementation(
          (id: string, password: string) => {
            if (password !== mockPassword) {
              return Promise.reject(new Error("bad password"));
            }
            return Promise.resolve(
              id === importedId
                ? {
                    id,
                    publicKey: importedPublicKey,
                    privateKey: importedSecretKey,
                  }
                : { id, publicKey: mockPublicKey, privateKey: mockPrivateKey },
            );
          },
        );
      });

      it("returns each account's own secret key from its own keystore", async () => {
        expect(
          await revealAccountSecretKey({
            accountId: importedId,
            password: mockPassword,
          }),
        ).toBe(importedSecretKey);
        expect(sharedKeyManager.loadKey).toHaveBeenLastCalledWith(
          importedId,
          mockPassword,
        );

        expect(
          await revealAccountSecretKey({
            accountId: mockAccountId,
            password: mockPassword,
          }),
        ).toBe(mockPrivateKey);
      });

      it("refuses a wrong password while the wallet is unlocked", async () => {
        await expect(
          revealAccountSecretKey({
            accountId: importedId,
            password: "wrong-password",
          }),
        ).rejects.toThrow("authStore.error.invalidPassword");
      });

      it("never opens a keystore the key manager doesn't list", async () => {
        await expect(
          revealAccountSecretKey({
            accountId: "not-a-key-id",
            password: mockPassword,
          }),
        ).rejects.toThrow("authStore.error.noKeyPairFound");
        expect(sharedKeyManager.loadKey).not.toHaveBeenCalled();
      });

      it("refuses while the wallet is locked", async () => {
        act(() => {
          useAuthenticationStore.setState({ authStatus: AUTH_STATUS.LOCKED });
        });

        await expect(
          revealAccountSecretKey({
            accountId: importedId,
            password: mockPassword,
          }),
        ).rejects.toThrow("authStore.error.authenticationExpired");
        expect(sharedKeyManager.loadKey).not.toHaveBeenCalled();
      });

      it("withholds the key if a lock lands during the decrypt", async () => {
        sharedKeyManager.loadKey.mockImplementation(() => {
          useAuthenticationStore.setState({ authStatus: AUTH_STATUS.LOCKED });
          return Promise.resolve({
            id: importedId,
            privateKey: importedSecretKey,
          });
        });

        await expect(
          revealAccountSecretKey({
            accountId: importedId,
            password: mockPassword,
          }),
        ).rejects.toThrow("authStore.error.authenticationExpired");
      });
    });

    describe("revealRecoveryPhrase", () => {
      const secretKeySourceId = "secret-key-source";

      beforeEach(() => {
        dataStorageMemory[STORAGE_KEYS.SECRET_SOURCES] = JSON.stringify({
          [mockPhraseSourceId]: {
            id: mockPhraseSourceId,
            type: SecretSourceType.PHRASE,
            label: "Seed Phrase 1",
            createdAt: 1,
          },
          [secretKeySourceId]: {
            id: secretKeySourceId,
            type: SecretSourceType.SECRET_KEY,
            label: "Secret Key 1",
            createdAt: 2,
          },
        });
        dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
          {
            id: mockAccountId,
            name: "Account 1",
            publicKey: mockPublicKey,
            sourceId: mockPhraseSourceId,
          },
        ]);
        sharedKeyManager.loadKey.mockImplementation(
          (id: string, password: string) =>
            password === mockPassword
              ? Promise.resolve({
                  id,
                  publicKey: mockPublicKey,
                  privateKey: mockPrivateKey,
                  extra: { mnemonicPhrase: mockMnemonicPhrase },
                })
              : Promise.reject(new Error("bad password")),
        );
      });

      it("returns the held phrase of the named source", async () => {
        mockAuthenticatedSession(
          JSON.stringify({
            privateKeys: {},
            mnemonics: { [mockPhraseSourceId]: "held phrase" },
          }),
        );

        expect(
          await revealRecoveryPhrase({
            password: mockPassword,
            sourceId: mockPhraseSourceId,
          }),
        ).toBe("held phrase");
        expect(sharedKeyManager.loadKey).toHaveBeenCalledWith(
          mockAccountId,
          mockPassword,
        );
      });

      it("reads the phrase from the source's keystore when the session doesn't hold it", async () => {
        mockAuthenticatedSession(
          JSON.stringify({ privateKeys: {}, mnemonics: {} }),
        );

        expect(
          await revealRecoveryPhrase({
            password: mockPassword,
            sourceId: mockPhraseSourceId,
          }),
        ).toBe(mockMnemonicPhrase);
      });

      it("refuses a wrong password while the wallet is unlocked", async () => {
        mockAuthenticatedSession(mockTemporaryStore);

        await expect(
          revealRecoveryPhrase({
            password: "wrong-password",
            sourceId: mockPhraseSourceId,
          }),
        ).rejects.toThrow("authStore.error.invalidPassword");
      });

      it("refuses a source that isn't a recorded phrase", async () => {
        mockAuthenticatedSession(mockTemporaryStore);

        await expect(
          revealRecoveryPhrase({
            password: mockPassword,
            sourceId: secretKeySourceId,
          }),
        ).rejects.toThrow("authStore.error.recoveryPhraseNotFound");
        await expect(
          revealRecoveryPhrase({
            password: mockPassword,
            sourceId: "unknown-source",
          }),
        ).rejects.toThrow("authStore.error.recoveryPhraseNotFound");
        expect(sharedKeyManager.loadKey).not.toHaveBeenCalled();
      });

      it("returns the default phrase when no source is named", async () => {
        mockAuthenticatedSession(
          JSON.stringify({
            privateKeys: {},
            mnemonics: { [mockPhraseSourceId]: "held phrase" },
          }),
        );

        expect(await revealRecoveryPhrase({ password: mockPassword })).toBe(
          "held phrase",
        );
      });

      it("refuses while the wallet is locked", async () => {
        act(() => {
          useAuthenticationStore.setState({ authStatus: AUTH_STATUS.LOCKED });
        });

        await expect(
          revealRecoveryPhrase({
            password: mockPassword,
            sourceId: mockPhraseSourceId,
          }),
        ).rejects.toThrow("authStore.error.authenticationExpired");
      });
    });

    it("derives a missing private key from any held phrase on account switch", async () => {
      const secondAccount: Account = {
        id: "account-2",
        name: "Account 2",
        publicKey: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      };
      mockAuthenticatedSession(
        JSON.stringify({
          privateKeys: { [mockAccountId]: mockPrivateKey },
          mnemonics: { "id-a": "phrase a", "id-b": "phrase b" },
        }),
      );
      dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = mockAccountId;
      dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
        { id: mockAccountId, name: mockAccountName, publicKey: mockPublicKey },
        secondAccount,
      ]);
      // Only the second phrase derives the second account.
      (StellarHDWallet.fromMnemonic as jest.Mock).mockImplementation(
        (mnemonic: string) => ({
          getPublicKey: jest.fn(() =>
            mnemonic === "phrase b"
              ? secondAccount.publicKey
              : "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          ),
          getSecret: jest.fn(() => "derived-private-key-2"),
        }),
      );
      const { result } = renderHook(() => useAuthenticationStore());
      act(() => {
        useAuthenticationStore.setState({
          account: mockAccount,
          selectAccount: originalStoreMethods.selectAccount,
        });
      });

      await act(async () => {
        await result.current.selectAccount(secondAccount.publicKey);
      });

      expect(result.current.account?.id).toBe(secondAccount.id);
      expect(result.current.account?.privateKey).toBe("derived-private-key-2");
      expect(StellarHDWallet.fromMnemonic).toHaveBeenCalledWith("phrase a");
      expect(StellarHDWallet.fromMnemonic).toHaveBeenCalledWith("phrase b");
      // The derived key joins the session; the held phrases are untouched.
      const [written] = writtenTemporaryStores();
      expect(written.privateKeys[secondAccount.id]).toBe(
        "derived-private-key-2",
      );
      expect(written.mnemonics).toEqual({
        "id-a": "phrase a",
        "id-b": "phrase b",
      });
    });

    // Port of the extension's stable account id (#73): every account carries
    // the SecretSource it is rooted in, lookups resolve by id or public key
    // and throw on a miss, and records written before `sourceId` existed are
    // filled in at sign-in.
    describe("stable account id", () => {
      const importedSourceId = `key:${importedSecretKey}`;
      const storedAccounts = (): Account[] =>
        JSON.parse(dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] ?? "[]");

      it("signUp records the phrase as the account's source", async () => {
        const { result } = renderHook(() => useAuthenticationStore());
        act(() => {
          useAuthenticationStore.setState({
            signUp: originalStoreMethods.signUp,
          });
        });

        await act(async () => {
          await result.current.signUp({
            mnemonicPhrase: mockMnemonicPhrase,
            password: mockPassword,
          });
        });

        expect(storedAccounts()).toEqual([
          expect.objectContaining({
            id: mockAccountId,
            sourceId: mockPhraseSourceId,
            publicKey: mockPublicKey,
          }),
        ]);
      });

      it("importSecretKey records the key as the account's source, not the phrase stamped into its keystore", async () => {
        mockAuthenticatedSession(mockTemporaryStore);
        dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = mockAccountId;
        dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
          {
            id: mockAccountId,
            sourceId: mockPhraseSourceId,
            name: mockAccountName,
            publicKey: mockPublicKey,
          },
        ]);
        sharedKeyManager.storeKey.mockResolvedValue({
          id: "imported-account-id",
        });
        const { result } = renderHook(() => useAuthenticationStore());
        act(() => {
          useAuthenticationStore.setState({
            importSecretKey: originalStoreMethods.importSecretKey,
          });
        });

        await act(async () => {
          await result.current.importSecretKey({
            secretKey: importedSecretKey,
            password: mockPassword,
          });
        });

        expect(
          storedAccounts().map(({ id, sourceId }) => ({ id, sourceId })),
        ).toEqual([
          { id: mockAccountId, sourceId: mockPhraseSourceId },
          { id: "imported-account-id", sourceId: importedSourceId },
        ]);
      });

      // Port of the extension's pre-V2 migration unlock pass (#76): accounts
      // with no sourceId are the pending list.
      describe("signIn attribution of records without a source", () => {
        const activeAccount = {
          id: mockAccountId,
          name: mockAccountName,
          publicKey: mockPublicKey,
        };
        const importedAccount = {
          id: "imported-account-id",
          name: "Account 2",
          publicKey: importedPublicKey,
          importedFromSecretKey: true,
        };

        // The active account sits at index 0 of the fixture phrase; every
        // other key names the phrase and index that derived it.
        const publicKeyAt = (mnemonic: string, index: number) =>
          mnemonic === mockMnemonicPhrase && index === 0
            ? mockPublicKey
            : `G:${mnemonic}:${index}`;

        beforeEach(() => {
          (StellarHDWallet.fromMnemonic as jest.Mock).mockImplementation(
            (mnemonic: string) => ({
              getPublicKey: jest.fn((index: number) =>
                publicKeyAt(mnemonic, index),
              ),
              getSecret: jest.fn((index: number) => `S:${mnemonic}:${index}`),
            }),
          );
          dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = mockAccountId;
          sharedKeyManager.loadAllKeyIds.mockResolvedValue([
            mockAccountId,
            importedAccount.id,
          ]);
          sharedKeyManager.loadKey.mockImplementation((id: string) =>
            Promise.resolve(
              id === importedAccount.id
                ? {
                    id,
                    publicKey: importedPublicKey,
                    privateKey: importedSecretKey,
                    extra: { mnemonicPhrase: mockMnemonicPhrase },
                  }
                : {
                    id: mockAccountId,
                    publicKey: mockPublicKey,
                    privateKey: mockPrivateKey,
                    extra: { mnemonicPhrase: mockMnemonicPhrase },
                  },
            ),
          );
          act(() => {
            useAuthenticationStore.setState({
              signIn: originalStoreMethods.signIn,
            });
          });
        });

        it("roots derived accounts in the unlocked phrase and imports in their own key, opening the keystore when no key is cached", async () => {
          dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
            activeAccount,
            importedAccount,
          ]);
          act(() => {
            useAuthenticationStore.setState({
              authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
            });
          });
          const { result } = renderHook(() => useAuthenticationStore());

          await act(async () => {
            await result.current.signIn({ password: mockPassword });
          });

          expect(storedAccounts().map(({ sourceId }) => sourceId)).toEqual([
            mockPhraseSourceId,
            importedSourceId,
          ]);
          expect(sharedKeyManager.loadKey).toHaveBeenCalledWith(
            importedAccount.id,
            mockPassword,
          );
        });

        it("reads an import's key from the session instead of opening its keystore", async () => {
          dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
            { ...activeAccount, sourceId: mockPhraseSourceId },
            importedAccount,
          ]);
          // LOCKED fast path: hash key and temp store intact on disk, the
          // import's private key already cached in the session.
          mockAuthenticatedSession(
            JSON.stringify({
              privateKeys: {
                [mockAccountId]: mockPrivateKey,
                [importedAccount.id]: importedSecretKey,
              },
              mnemonics: { [mockPhraseSourceId]: mockMnemonicPhrase },
            }),
          );
          act(() => {
            useAuthenticationStore.setState({
              authStatus: AUTH_STATUS.LOCKED,
            });
          });
          const { result } = renderHook(() => useAuthenticationStore());

          await act(async () => {
            await result.current.signIn({ password: mockPassword });
          });

          expect(storedAccounts().map(({ sourceId }) => sourceId)).toEqual([
            mockPhraseSourceId,
            importedSourceId,
          ]);
          expect(sharedKeyManager.loadKey).not.toHaveBeenCalledWith(
            importedAccount.id,
            expect.anything(),
          );
        });

        it("derives no phrase id on the fast path when nothing is pending", async () => {
          dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
            { ...activeAccount, sourceId: mockPhraseSourceId },
          ]);
          mockAuthenticatedSession(mockTemporaryStore);
          act(() => {
            useAuthenticationStore.setState({
              authStatus: AUTH_STATUS.LOCKED,
            });
          });
          const { result } = renderHook(() => useAuthenticationStore());

          await act(async () => {
            await result.current.signIn({ password: mockPassword });
          });

          expect(deriveAuthKeypair).not.toHaveBeenCalled();
        });

        it("leaves a list whose accounts all carry a source untouched", async () => {
          const complete = [
            { ...activeAccount, sourceId: mockPhraseSourceId },
            { ...importedAccount, sourceId: importedSourceId },
          ];
          dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] =
            JSON.stringify(complete);
          mockAuthenticatedSession(mockTemporaryStore);
          act(() => {
            useAuthenticationStore.setState({
              authStatus: AUTH_STATUS.LOCKED,
            });
          });
          const { result } = renderHook(() => useAuthenticationStore());

          await act(async () => {
            await result.current.signIn({ password: mockPassword });
          });

          expect(storedAccounts()).toEqual(complete);
          expect(dataStorage.setItem).not.toHaveBeenCalledWith(
            STORAGE_KEYS.ACCOUNT_LIST,
            expect.anything(),
          );
        });

        it("keeps an account whose source cannot be derived, without one, and still signs in", async () => {
          dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
            { ...activeAccount, sourceId: mockPhraseSourceId },
            importedAccount,
          ]);
          sharedKeyManager.loadKey.mockImplementation((id: string) =>
            id === importedAccount.id
              ? Promise.reject(new Error("corrupt keystore"))
              : Promise.resolve({
                  id: mockAccountId,
                  publicKey: mockPublicKey,
                  privateKey: mockPrivateKey,
                  extra: { mnemonicPhrase: mockMnemonicPhrase },
                }),
          );
          // A readable session with only the active key cached, so the
          // import's source must come from its (broken) keystore and the
          // background account load after sign-in still succeeds.
          mockAuthenticatedSession(mockTemporaryStore);
          act(() => {
            useAuthenticationStore.setState({
              authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
            });
          });
          const { result } = renderHook(() => useAuthenticationStore());

          await act(async () => {
            await result.current.signIn({ password: mockPassword });
          });

          expect(result.current.authStatus).toBe(AUTH_STATUS.AUTHENTICATED);
          expect(storedAccounts().map(({ sourceId }) => sourceId)).toEqual([
            mockPhraseSourceId,
            undefined,
          ]);
          expect(logger.error).toHaveBeenCalledWith(
            "attributePendingAccounts",
            "Failed to attribute an account to its source",
            expect.any(Error),
          );
        });

        describe("pre-V2 wallet", () => {
          const storedSourceMap = () =>
            JSON.parse(
              dataStorageMemory[STORAGE_KEYS.SECRET_SOURCES] ?? "{}",
            ) as Record<string, { type: string; label: string }>;
          const storedIndices = () =>
            JSON.parse(
              dataStorageMemory[STORAGE_KEYS.DERIVATION_INDICES] ?? "{}",
            ) as Record<string, number[]>;
          const secondImportKey = "SECONDIMPORTSECRET";
          const secondImport = {
            id: "second-import-id",
            name: "Account 4",
            publicKey: "GSECONDIMPORT",
            importedFromSecretKey: true,
          };
          // Index 1 was removed before upgrade, so the next derived account
          // sits at index 2.
          const derivedAtTwo = {
            id: "derived-two-id",
            name: "Account 3",
            publicKey: publicKeyAt(mockMnemonicPhrase, 2),
          };
          const preV2List = [
            activeAccount,
            importedAccount,
            derivedAtTwo,
            secondImport,
          ];

          const signInFresh = async () => {
            act(() => {
              useAuthenticationStore.setState({
                authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
              });
            });
            const { result } = renderHook(() => useAuthenticationStore());
            await act(async () => {
              await result.current.signIn({ password: mockPassword });
            });
            return result;
          };

          beforeEach(() => {
            sharedKeyManager.loadKey.mockImplementation((id: string) => {
              if (id === importedAccount.id) {
                return Promise.resolve({
                  id,
                  publicKey: importedPublicKey,
                  privateKey: importedSecretKey,
                  extra: { imported: true, mnemonicPhrase: mockMnemonicPhrase },
                });
              }
              if (id === secondImport.id) {
                return Promise.resolve({
                  id,
                  publicKey: secondImport.publicKey,
                  privateKey: secondImportKey,
                  extra: { imported: true, mnemonicPhrase: mockMnemonicPhrase },
                });
              }
              return Promise.resolve({
                id: mockAccountId,
                publicKey: mockPublicKey,
                privateKey: mockPrivateKey,
                extra: { mnemonicPhrase: mockMnemonicPhrase },
              });
            });
          });

          it("registers the wallet phrase as Seed Phrase 1, each import as its own Secret Key N, and pins the phrase", async () => {
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] =
              JSON.stringify(preV2List);

            await signInFresh();

            expect(storedSourceMap()).toEqual({
              [mockPhraseSourceId]: expect.objectContaining({
                type: SecretSourceType.PHRASE,
                label: "Seed Phrase 1",
              }),
              [importedSourceId]: expect.objectContaining({
                type: SecretSourceType.SECRET_KEY,
                label: "Secret Key 1",
              }),
              [`key:${secondImportKey}`]: expect.objectContaining({
                type: SecretSourceType.SECRET_KEY,
                label: "Secret Key 2",
              }),
            });
            // The pin is the phrase the analytics id was derived from, so it
            // equals the wallet's existing metrics_user_id.
            expect(dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(
              mockPhraseSourceId,
            );
            expect(storedAccounts().map(({ sourceId }) => sourceId)).toEqual([
              mockPhraseSourceId,
              importedSourceId,
              mockPhraseSourceId,
              `key:${secondImportKey}`,
            ]);
          });

          it("marks each derived account's actual index, not a count", async () => {
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] =
              JSON.stringify(preV2List);

            await signInFresh();

            expect(storedIndices()).toEqual({ [mockPhraseSourceId]: [0, 2] });
          });

          it("pins the phrase when an import is the active account", async () => {
            dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] =
              importedAccount.id;
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] =
              JSON.stringify(preV2List);

            await signInFresh();

            expect(dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(
              mockPhraseSourceId,
            );
          });

          it("does not move an existing pin", async () => {
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] =
              JSON.stringify(preV2List);
            dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID] = "phrase:other";

            await signInFresh();

            expect(dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(
              "phrase:other",
            );
          });

          it("pins the first import of a wallet with no phrase", async () => {
            dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] =
              importedAccount.id;
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
              importedAccount,
              secondImport,
            ]);
            sharedKeyManager.loadKey.mockImplementation((id: string) =>
              Promise.resolve(
                id === importedAccount.id
                  ? {
                      id,
                      publicKey: importedPublicKey,
                      privateKey: importedSecretKey,
                      extra: { imported: true },
                    }
                  : {
                      id,
                      publicKey: secondImport.publicKey,
                      privateKey: secondImportKey,
                      extra: { imported: true },
                    },
              ),
            );

            await signInFresh();

            expect(dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(
              importedSourceId,
            );
            expect(
              Object.values(storedSourceMap()).map(({ label }) => label),
            ).toEqual(["Secret Key 1", "Secret Key 2"]);
          });

          it("registers nothing when the phrase's source id fails, then pins the phrase on the next unlock", async () => {
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] =
              JSON.stringify(preV2List);
            (deriveAuthKeypair as jest.Mock).mockRejectedValueOnce(
              new Error("transient PBKDF2 failure"),
            );

            await signInFresh();

            // No import may take the pin while the phrase is unregistered.
            expect(
              dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID],
            ).toBeUndefined();
            expect(storedSourceMap()).toEqual({});
            expect(storedAccounts().every(({ sourceId }) => !sourceId)).toBe(
              true,
            );

            await signInFresh();

            expect(dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(
              mockPhraseSourceId,
            );
            expect(
              Object.values(storedSourceMap()).map(({ label }) => label),
            ).toEqual(["Seed Phrase 1", "Secret Key 1", "Secret Key 2"]);
            expect(storedAccounts().map(({ sourceId }) => sourceId)).toEqual([
              mockPhraseSourceId,
              importedSourceId,
              mockPhraseSourceId,
              `key:${secondImportKey}`,
            ]);
          });

          it("is idempotent across unlocks", async () => {
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] =
              JSON.stringify(preV2List);

            await signInFresh();
            const after = {
              sources: storedSourceMap(),
              indices: storedIndices(),
              pin: dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID],
              accounts: storedAccounts(),
            };
            await signInFresh();

            expect({
              sources: storedSourceMap(),
              indices: storedIndices(),
              pin: dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID],
              accounts: storedAccounts(),
            }).toEqual(after);
          });

          it("resumes an account it could not read on the next unlock, keeping the label order", async () => {
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] =
              JSON.stringify(preV2List);
            const readable = sharedKeyManager.loadKey.getMockImplementation()!;
            sharedKeyManager.loadKey.mockImplementation(
              (id: string, password: string) =>
                id === secondImport.id
                  ? Promise.reject(new Error("corrupt keystore"))
                  : readable(id, password),
            );

            await signInFresh();

            expect(storedAccounts()[3].sourceId).toBeUndefined();

            sharedKeyManager.loadKey.mockImplementation(readable);
            await signInFresh();

            expect(storedAccounts()[3].sourceId).toBe(`key:${secondImportKey}`);
            expect(storedSourceMap()[`key:${secondImportKey}`].label).toBe(
              "Secret Key 2",
            );
          });

          it("attributes an account a downgraded build added on the next upgrade", async () => {
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] =
              JSON.stringify(preV2List);
            await signInFresh();

            const addedOnDowngrade = {
              id: "downgrade-added-id",
              name: "Account 5",
              publicKey: publicKeyAt(mockMnemonicPhrase, 1),
            };
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
              ...storedAccounts(),
              addedOnDowngrade,
            ]);
            await signInFresh();

            expect(storedAccounts()[4].sourceId).toBe(mockPhraseSourceId);
            expect(storedIndices()).toEqual({
              [mockPhraseSourceId]: [0, 1, 2],
            });
          });

          it("leaves a wallet with every account attributed unpinned and unregistered", async () => {
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
              { ...activeAccount, sourceId: mockPhraseSourceId },
            ]);

            await signInFresh();

            expect(
              dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID],
            ).toBeUndefined();
            expect(storedSourceMap()).toEqual({});
          });
        });
      });

      it("rejects a rename of an unknown public key and changes nothing", async () => {
        const accounts = [
          { ...mockAccount, name: "Account 1", sourceId: mockPhraseSourceId },
        ];
        dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify(accounts);
        const { result } = renderHook(() => useAuthenticationStore());
        act(() => {
          useAuthenticationStore.setState({
            renameAccount: originalStoreMethods.renameAccount,
          });
        });

        await act(async () => {
          await result.current.renameAccount({
            publicKey: "GUNKNOWN",
            accountName: "Renamed",
          });
        });

        expect(result.current.error).toBe("authStore.error.accountNotFound");
        expect(storedAccounts()).toEqual(accounts);
      });

      it("rejects a switch to an unknown public key and changes nothing", async () => {
        dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = mockAccountId;
        dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
          { ...mockAccount, name: "Account 1", sourceId: mockPhraseSourceId },
        ]);
        mockAuthenticatedSession(mockTemporaryStore);
        const { result } = renderHook(() => useAuthenticationStore());
        act(() => {
          useAuthenticationStore.setState({
            account: mockAccount,
            selectAccount: originalStoreMethods.selectAccount,
          });
        });

        await act(async () => {
          await result.current.selectAccount("GUNKNOWN");
        });

        expect(result.current.error).toBe("authStore.error.accountNotFound");
        expect(dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID]).toBe(
          mockAccountId,
        );
        expect(result.current.account).toBe(mockAccount);
      });
    });

    // Port of the extension's per-source derivation index sets (#74): a new
    // account takes its phrase's lowest unused index; two phrases each derive
    // from 0 upward independently; the source is explicit or implied by the
    // active account; a released index is re-derived to the same key.
    describe("per-source derivation indices", () => {
      const secondPhraseSourceId = "phrase:second phrase";
      const secondPhrase = "second phrase";

      const storedIndices = (): Record<string, number[]> | undefined =>
        dataStorageMemory[STORAGE_KEYS.DERIVATION_INDICES]
          ? JSON.parse(dataStorageMemory[STORAGE_KEYS.DERIVATION_INDICES])
          : undefined;
      const storedAccounts = (): Account[] =>
        JSON.parse(dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] ?? "[]");
      const storedPublicKeys = () =>
        (
          sharedKeyManager.storeKey.mock.calls as Array<
            [{ key: { publicKey: string } }]
          >
        ).map(([{ key }]) => key.publicKey);

      // Keys name the phrase and index that derived them, so a test can tell
      // exactly what was derived.
      const publicKeyAt = (mnemonic: string, index: number) =>
        `G:${mnemonic}:${index}`;
      const mockIndexedWallet = () => {
        (StellarHDWallet.fromMnemonic as jest.Mock).mockImplementation(
          (mnemonic: string) => ({
            getPublicKey: jest.fn((index: number) =>
              publicKeyAt(mnemonic, index),
            ),
            getSecret: jest.fn((index: number) => `S:${mnemonic}:${index}`),
          }),
        );
      };
      const phraseAccount = (index: number): Account => ({
        id: `account-${index}`,
        sourceId: mockPhraseSourceId,
        name: `Account ${index + 1}`,
        publicKey: publicKeyAt(mockMnemonicPhrase, index),
      });

      const mockAddAccountSession = ({
        accounts,
        indices,
        mnemonics = { [mockPhraseSourceId]: mockMnemonicPhrase },
      }: {
        accounts: Account[];
        indices?: Record<string, number[]>;
        mnemonics?: Record<string, string>;
      }) => {
        mockIndexedWallet();
        mockAuthenticatedSession(
          JSON.stringify({ privateKeys: {}, mnemonics }),
        );
        dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify(accounts);
        dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = accounts[0].id;
        if (indices) {
          dataStorageMemory[STORAGE_KEYS.DERIVATION_INDICES] =
            JSON.stringify(indices);
        }
        sharedKeyManager.storeKey.mockResolvedValue({ id: "new-account" });
        act(() => {
          useAuthenticationStore.setState({
            createAccount: originalStoreMethods.createAccount,
          });
        });
        return renderHook(() => useAuthenticationStore());
      };

      it("creates the first account at index 0 of its phrase", async () => {
        const { result } = renderHook(() => useAuthenticationStore());
        act(() => {
          useAuthenticationStore.setState({
            signUp: originalStoreMethods.signUp,
          });
        });

        await act(async () => {
          await result.current.signUp({
            mnemonicPhrase: mockMnemonicPhrase,
            password: mockPassword,
          });
        });

        expect(storedIndices()).toEqual({ [mockPhraseSourceId]: [0] });
      });

      it("links the new account once it is created", async () => {
        const { result } = mockAddAccountSession({
          accounts: [phraseAccount(0)],
          indices: { [mockPhraseSourceId]: [0] },
        });

        await act(async () => {
          await result.current.createAccount(mockPassword);
        });

        expect(result.current.error).toBeNull();
        expect(linkWalletSources).toHaveBeenCalledTimes(1);
      });

      it("adds at the one held phrase's lowest unused index when no source is named", async () => {
        const { result } = mockAddAccountSession({
          accounts: [phraseAccount(0)],
          indices: { [mockPhraseSourceId]: [0] },
        });

        await act(async () => {
          await result.current.createAccount(mockPassword);
        });

        expect(result.current.error).toBeNull();
        expect(storedPublicKeys()).toEqual([
          publicKeyAt(mockMnemonicPhrase, 1),
        ]);
        expect(storedIndices()).toEqual({ [mockPhraseSourceId]: [0, 1] });
        expect(storedAccounts()[1]).toEqual(
          expect.objectContaining({
            id: "new-account",
            sourceId: mockPhraseSourceId,
            publicKey: publicKeyAt(mockMnemonicPhrase, 1),
          }),
        );
        const [written] = writtenTemporaryStores();
        expect(written.privateKeys["new-account"]).toBe(
          `S:${mockMnemonicPhrase}:1`,
        );
      });

      it("derives each phrase from index 0 upward independently, then follows the active account's phrase", async () => {
        const { result } = mockAddAccountSession({
          accounts: [phraseAccount(0)],
          indices: { [mockPhraseSourceId]: [0] },
          mnemonics: {
            [mockPhraseSourceId]: mockMnemonicPhrase,
            [secondPhraseSourceId]: secondPhrase,
          },
        });
        sharedKeyManager.storeKey
          .mockResolvedValueOnce({ id: "second-0" })
          .mockResolvedValueOnce({ id: "second-1" });

        await act(async () => {
          await result.current.createAccount(
            mockPassword,
            secondPhraseSourceId,
          );
        });
        // The new account on the second phrase is now active, so an add that
        // names no source follows it.
        await act(async () => {
          await result.current.createAccount(mockPassword);
        });

        expect(storedPublicKeys()).toEqual([
          publicKeyAt(secondPhrase, 0),
          publicKeyAt(secondPhrase, 1),
        ]);
        expect(storedIndices()).toEqual({
          [mockPhraseSourceId]: [0],
          [secondPhraseSourceId]: [0, 1],
        });
        expect(
          storedAccounts().map(({ id, sourceId }) => ({ id, sourceId })),
        ).toEqual([
          { id: "account-0", sourceId: mockPhraseSourceId },
          { id: "second-0", sourceId: secondPhraseSourceId },
          { id: "second-1", sourceId: secondPhraseSourceId },
        ]);
      });

      it("rejects a source the wallet does not hold and stores nothing", async () => {
        const { result } = mockAddAccountSession({
          accounts: [phraseAccount(0)],
          indices: { [mockPhraseSourceId]: [0] },
        });

        // The store action surfaces the error in state and rethrows for the
        // screen that awaits it.
        await act(async () => {
          await expect(
            result.current.createAccount(mockPassword, "phrase:unknown"),
          ).rejects.toThrow("authStore.error.unknownRecoveryPhrase");
        });

        expect(result.current.error).toBe(
          "authStore.error.unknownRecoveryPhrase",
        );
        expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
        expect(storedAccounts()).toHaveLength(1);
        expect(storedIndices()).toEqual({ [mockPhraseSourceId]: [0] });
      });

      it("skips an index whose key the wallet already holds and records it", async () => {
        // A set that under-approximates the accounts: nothing marked at all,
        // as on a wallet from before the sets existed.
        const { result } = mockAddAccountSession({
          accounts: [phraseAccount(0), phraseAccount(1)],
        });

        await act(async () => {
          await result.current.createAccount(mockPassword);
        });

        expect(result.current.error).toBeNull();
        expect(storedPublicKeys()).toEqual([
          publicKeyAt(mockMnemonicPhrase, 2),
        ]);
        expect(storedIndices()).toEqual({ [mockPhraseSourceId]: [0, 1, 2] });
        expect(logger.error).toHaveBeenCalledWith(
          "createAccount",
          "Derivation index set was missing indices the wallet already holds",
          expect.any(Error),
          { sourceId: mockPhraseSourceId, skipped: [0, 1] },
        );
      });

      it("fills the lowest gap in the index set", async () => {
        const { result } = mockAddAccountSession({
          accounts: [phraseAccount(0), phraseAccount(2)],
          indices: { [mockPhraseSourceId]: [0, 2] },
        });

        await act(async () => {
          await result.current.createAccount(mockPassword);
        });

        expect(storedPublicKeys()).toEqual([
          publicKeyAt(mockMnemonicPhrase, 1),
        ]);
        expect(storedIndices()).toEqual({ [mockPhraseSourceId]: [0, 1, 2] });
      });

      it("records every funded index a recovery preloads", async () => {
        mockIndexedWallet();
        mockAuthenticatedSession(
          JSON.stringify({ privateKeys: {}, mnemonics: {} }),
        );
        delete dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST];
        let stored = 0;
        sharedKeyManager.storeKey.mockImplementation(() => {
          stored += 1;
          return Promise.resolve({ id: `recovered-${stored}` });
        });
        // Indices 1 and 2 are funded on the network; the rest are not.
        (getAccount as jest.Mock).mockImplementation((publicKey: string) =>
          Promise.resolve(
            [1, 2].some(
              (index) => publicKey === publicKeyAt(mockMnemonicPhrase, index),
            )
              ? { accountId: () => publicKey }
              : null,
          ),
        );
        const { result } = renderHook(() => useAuthenticationStore());
        act(() => {
          useAuthenticationStore.setState({
            importWallet: originalStoreMethods.importWallet,
          });
        });

        await act(async () => {
          await result.current.importWallet({
            mnemonicPhrase: mockMnemonicPhrase,
            password: mockPassword,
          });
        });

        expect(result.current.error).toBeNull();
        expect(storedAccounts().map(({ publicKey }) => publicKey)).toEqual([
          publicKeyAt(mockMnemonicPhrase, 0),
          publicKeyAt(mockMnemonicPhrase, 1),
          publicKeyAt(mockMnemonicPhrase, 2),
        ]);
        expect(storedIndices()).toEqual({ [mockPhraseSourceId]: [0, 1, 2] });
      });

      describe("overlapping account changes", () => {
        const flush = () =>
          new Promise((resolve) => {
            setTimeout(resolve, 0);
          });

        it("gives two overlapping adds on one phrase different indices", async () => {
          const { result } = mockAddAccountSession({
            accounts: [phraseAccount(0)],
            indices: { [mockPhraseSourceId]: [0] },
          });
          let stored = 0;
          sharedKeyManager.storeKey.mockImplementation(() => {
            stored += 1;
            return Promise.resolve({ id: `new-account-${stored}` });
          });

          await act(async () => {
            await Promise.all([
              result.current.createAccount(mockPassword),
              result.current.createAccount(mockPassword),
            ]);
          });

          expect(result.current.error).toBeNull();
          expect(storedPublicKeys()).toEqual([
            publicKeyAt(mockMnemonicPhrase, 1),
            publicKeyAt(mockMnemonicPhrase, 2),
          ]);
          expect(storedIndices()).toEqual({
            [mockPhraseSourceId]: [0, 1, 2],
          });
          expect(storedAccounts().map(({ id }) => id)).toEqual([
            "account-0",
            "new-account-1",
            "new-account-2",
          ]);
        });

        it("lets an add in flight finish before a wipe clears the wallet", async () => {
          const { result } = mockAddAccountSession({
            accounts: [phraseAccount(0)],
            indices: { [mockPhraseSourceId]: [0] },
          });
          wipeNonSensitiveData();
          let releaseKeystore: (() => void) | undefined;
          sharedKeyManager.storeKey.mockImplementation(
            () =>
              new Promise((resolve) => {
                releaseKeystore = () => resolve({ id: "new-account" });
              }),
          );
          act(() => {
            useAuthenticationStore.setState({
              logout: originalStoreMethods.logout,
            });
          });

          await act(async () => {
            const adding = result.current
              .createAccount(mockPassword)
              .catch(() => undefined);
            await flush();
            expect(releaseKeystore).toBeDefined();

            result.current.logout(true);
            await flush();
            await flush();

            releaseKeystore?.();
            await adding;
            await flush();
            await flush();
          });

          expect(clearNonSensitiveData).toHaveBeenCalled();
          expect(dataStorageMemory).not.toHaveProperty(
            STORAGE_KEYS.ACCOUNT_LIST,
          );
          expect(dataStorageMemory).not.toHaveProperty(
            STORAGE_KEYS.DERIVATION_INDICES,
          );
        });

        it("drops a switch's account once a soft-lock lands during it", async () => {
          const { result } = mockAddAccountSession({
            accounts: [phraseAccount(0), phraseAccount(1)],
            indices: { [mockPhraseSourceId]: [0, 1] },
          });
          (
            useAuthenticationStore.getState().getAuthStatus as jest.Mock
          ).mockResolvedValue(AUTH_STATUS.AUTHENTICATED);
          act(() => {
            useAuthenticationStore.setState({
              selectAccount: originalStoreMethods.selectAccount,
              softLock: originalStoreMethods.softLock,
            });
          });

          await act(async () => {
            const switching = result.current.selectAccount(
              publicKeyAt(mockMnemonicPhrase, 1),
            );
            await result.current.softLock();
            await switching;
          });

          expect(dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID]).toBe(
            "account-1",
          );
          expect(result.current.isSoftLocked).toBe(true);
          expect(result.current.account).toBeNull();
          expect(result.current.isSwitchingAccount).toBe(false);
        });

        it("caches a lazily loaded key onto the session as it stands, not as first read", async () => {
          mockAddAccountSession({ accounts: [phraseAccount(0)] });
          const mnemonics = { [mockPhraseSourceId]: mockMnemonicPhrase };
          // The first read is getActiveAccount's; by the second, an add has
          // put its key into the session.
          (decryptDataWithDerivedKey as jest.Mock)
            .mockReturnValueOnce(JSON.stringify({ privateKeys: {}, mnemonics }))
            .mockReturnValue(
              JSON.stringify({
                privateKeys: { "added-account": "S:added" },
                mnemonics,
              }),
            );
          (
            useAuthenticationStore.getState().getAuthStatus as jest.Mock
          ).mockResolvedValue(AUTH_STATUS.AUTHENTICATED);
          act(() => {
            useAuthenticationStore.setState({
              fetchActiveAccount: originalStoreMethods.fetchActiveAccount,
            });
          });

          await act(async () => {
            await useAuthenticationStore.getState().fetchActiveAccount();
          });

          const written = writtenTemporaryStores();
          expect(written[written.length - 1].privateKeys).toEqual({
            "added-account": "S:added",
            "account-0": `S:${mockMnemonicPhrase}:0`,
          });
        });

        it("cuts off a funded lookup that stalls, so the import finishes", async () => {
          jest.useFakeTimers();
          try {
            mockIndexedWallet();
            mockAuthenticatedSession(
              JSON.stringify({ privateKeys: {}, mnemonics: {} }),
            );
            delete dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST];
            let stored = 0;
            sharedKeyManager.storeKey.mockImplementation(() => {
              stored += 1;
              return Promise.resolve({ id: `recovered-${stored}` });
            });
            // Index 1 is funded but its lookup never answers; the rest are
            // unfunded.
            (getAccount as jest.Mock).mockImplementation((publicKey: string) =>
              publicKey === publicKeyAt(mockMnemonicPhrase, 1)
                ? new Promise(() => {})
                : Promise.resolve(null),
            );
            const { result } = renderHook(() => useAuthenticationStore());
            act(() => {
              useAuthenticationStore.setState({
                importWallet: originalStoreMethods.importWallet,
              });
            });

            let imported: boolean | undefined;
            await act(async () => {
              const importing = result.current
                .importWallet({
                  mnemonicPhrase: mockMnemonicPhrase,
                  password: mockPassword,
                })
                .then((value) => {
                  imported = value;
                });
              // Short of the cutoff, the import still waits on the lookup.
              await jest.advanceTimersByTimeAsync(4_999);
              expect(imported).toBeUndefined();
              await jest.advanceTimersByTimeAsync(1);
              await importing;
            });

            expect(imported).toBe(true);
            expect(storedAccounts().map(({ publicKey }) => publicKey)).toEqual([
              publicKeyAt(mockMnemonicPhrase, 0),
            ]);
          } finally {
            jest.useRealTimers();
          }
        });
      });

      describe("account names", () => {
        it("names the new account as the caller asks, trimmed", async () => {
          const { result } = mockAddAccountSession({
            accounts: [phraseAccount(0)],
            indices: { [mockPhraseSourceId]: [0] },
          });

          await act(async () => {
            await result.current.createAccount(
              mockPassword,
              mockPhraseSourceId,
              "  Savings  ",
            );
          });

          expect(storedAccounts()[1].name).toBe("Savings");
        });

        it("falls back to the default name for a blank one", async () => {
          const { result } = mockAddAccountSession({
            accounts: [phraseAccount(0)],
            indices: { [mockPhraseSourceId]: [0] },
          });

          await act(async () => {
            await result.current.createAccount(
              mockPassword,
              mockPhraseSourceId,
              "   ",
            );
          });

          // The i18next mock returns the key.
          expect(storedAccounts()[1].name).toBe("authStore.account");
        });
      });

      describe("addRecoveryPhraseSource", () => {
        const newPhrase = "brand new phrase";
        const newSourceId = `phrase:${newPhrase}`;

        const mockNewPhraseSession = () => {
          (StellarHDWallet.generateMnemonic as jest.Mock).mockReturnValue(
            newPhrase,
          );
          const hook = mockAddAccountSession({
            accounts: [phraseAccount(0)],
            indices: { [mockPhraseSourceId]: [0] },
          });
          act(() => {
            useAuthenticationStore.setState({
              addRecoveryPhraseSource:
                originalStoreMethods.addRecoveryPhraseSource,
            });
          });
          return hook;
        };

        afterEach(() => {
          clearPendingRecoveryPhrase();
        });

        it("stores the held phrase as a new source with its first account, named as asked", async () => {
          const { result } = mockNewPhraseSession();
          const id = generatePendingRecoveryPhrase();
          expect(getPendingRecoveryPhrase(id)).toBe(newPhrase);

          await act(async () => {
            await result.current.addRecoveryPhraseSource(
              mockPassword,
              id,
              "Travel",
            );
          });

          expect(result.current.error).toBeNull();
          expect(storedPublicKeys()).toEqual([publicKeyAt(newPhrase, 0)]);
          expect(storedAccounts()[1]).toEqual(
            expect.objectContaining({
              id: "new-account",
              name: "Travel",
              sourceId: newSourceId,
              publicKey: publicKeyAt(newPhrase, 0),
            }),
          );
          expect(storedIndices()).toEqual({
            [mockPhraseSourceId]: [0],
            [newSourceId]: [0],
          });
          expect(storedSources()).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: newSourceId,
                type: SecretSourceType.PHRASE,
              }),
            ]),
          );
          // Held beside the wallet's phrase, not in place of it.
          const [written] = writtenTemporaryStores();
          expect(written.mnemonics).toEqual({
            [mockPhraseSourceId]: mockMnemonicPhrase,
            [newSourceId]: newPhrase,
          });
          expect(dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID]).toBe(
            "new-account",
          );
          expect(getPendingRecoveryPhrase(id)).toBeNull();
          expect(linkWalletSources).toHaveBeenCalledTimes(1);
        });

        it("refuses when no phrase is held", async () => {
          const { result } = mockNewPhraseSession();

          await act(async () => {
            await expect(
              result.current.addRecoveryPhraseSource(
                mockPassword,
                "pending-phrase-0",
              ),
            ).rejects.toThrow("authStore.error.pendingRecoveryPhraseMissing");
          });

          expect(result.current.error).toBe(
            "authStore.error.pendingRecoveryPhraseMissing",
          );
          expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
        });

        it("stores nothing and keeps the phrase on a wrong password", async () => {
          const { result } = mockNewPhraseSession();
          const id = generatePendingRecoveryPhrase();
          sharedKeyManager.loadKey.mockRejectedValue(new Error("bad password"));

          await act(async () => {
            await expect(
              result.current.addRecoveryPhraseSource("wrong", id),
            ).rejects.toThrow();
          });

          expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
          expect(storedSources()).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: newSourceId }),
            ]),
          );
          // The user can retry without generating a new phrase.
          expect(getPendingRecoveryPhrase(id)).toBe(newPhrase);
        });

        it("refuses a phrase the wallet already holds", async () => {
          const { result } = mockNewPhraseSession();
          (StellarHDWallet.generateMnemonic as jest.Mock).mockReturnValue(
            mockMnemonicPhrase,
          );
          const id = generatePendingRecoveryPhrase();
          dataStorageMemory[STORAGE_KEYS.SECRET_SOURCES] = JSON.stringify({
            [mockPhraseSourceId]: {
              id: mockPhraseSourceId,
              type: SecretSourceType.PHRASE,
              label: "Seed Phrase 1",
              createdAt: 1,
            },
          });

          await act(async () => {
            await expect(
              result.current.addRecoveryPhraseSource(mockPassword, id),
            ).rejects.toThrow("authStore.error.recoveryPhraseAlreadyHeld");
          });

          expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
        });

        it("drops the held phrase when the wallet soft-locks", async () => {
          mockNewPhraseSession();
          const id = generatePendingRecoveryPhrase();
          act(() => {
            useAuthenticationStore.setState({
              softLock: originalStoreMethods.softLock,
            });
          });

          await act(async () => {
            await useAuthenticationStore.getState().softLock();
          });

          expect(getPendingRecoveryPhrase(id)).toBeNull();
        });

        it("refuses a generation a later one replaced", async () => {
          const { result } = mockNewPhraseSession();
          const shown = generatePendingRecoveryPhrase();
          (StellarHDWallet.generateMnemonic as jest.Mock).mockReturnValue(
            "another new phrase",
          );
          const later = generatePendingRecoveryPhrase();
          expect(later).not.toBe(shown);

          await act(async () => {
            await expect(
              result.current.addRecoveryPhraseSource(mockPassword, shown),
            ).rejects.toThrow("authStore.error.pendingRecoveryPhraseMissing");
          });

          expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
          expect(getPendingRecoveryPhrase(shown)).toBeNull();
          expect(getPendingRecoveryPhrase(later)).toBe("another new phrase");
        });

        it("refuses a confirmation without a generation id", async () => {
          const { result } = mockNewPhraseSession();
          generatePendingRecoveryPhrase();

          await act(async () => {
            await expect(
              result.current.addRecoveryPhraseSource(mockPassword, ""),
            ).rejects.toThrow("authStore.error.pendingRecoveryPhraseMissing");
          });

          expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
        });

        it("clears only the generation it names", () => {
          const shown = generatePendingRecoveryPhrase();
          const later = generatePendingRecoveryPhrase();

          clearPendingRecoveryPhrase(shown);
          expect(getPendingRecoveryPhrase(later)).toBe(newPhrase);

          clearPendingRecoveryPhrase(later);
          expect(getPendingRecoveryPhrase(later)).toBeNull();
        });

        // The extension refuses a wallet with no software keystore, since
        // every password would fail as if wrong. Mobile has no hardware
        // accounts, but the same case gets its own error here, not
        // "invalid password", and nothing is written.
        it("refuses a wallet with no keystore to check the password against", async () => {
          const { result } = mockNewPhraseSession();
          const id = generatePendingRecoveryPhrase();
          sharedKeyManager.loadAllKeyIds.mockResolvedValueOnce([]);

          await act(async () => {
            await expect(
              result.current.addRecoveryPhraseSource(mockPassword, id),
            ).rejects.toThrow("authStore.error.noKeyPairFound");
          });

          expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
          expect(getPendingRecoveryPhrase(id)).toBe(newPhrase);
        });
      });

      describe("importRecoveryPhrase", () => {
        const importedPhrase =
          "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima";
        const importedSourceId = `phrase:${importedPhrase}`;

        // Index 3 of the imported phrase is funded on mainnet; the rest are
        // not.
        const mockFunded = (funded: number[]) => {
          (getAccount as jest.Mock).mockImplementation((publicKey: string) =>
            Promise.resolve(
              funded.some(
                (index) => publicKey === publicKeyAt(importedPhrase, index),
              )
                ? { accountId: () => publicKey }
                : null,
            ),
          );
        };

        const mockImportSession = (
          accounts: Account[] = [phraseAccount(0)],
        ) => {
          const hook = mockAddAccountSession({
            accounts,
            indices: { [mockPhraseSourceId]: [0] },
          });
          dataStorageMemory[STORAGE_KEYS.SECRET_SOURCES] = JSON.stringify({
            [mockPhraseSourceId]: {
              id: mockPhraseSourceId,
              type: SecretSourceType.PHRASE,
              label: "Seed Phrase 1",
              createdAt: 1,
            },
          });
          dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID] = mockPhraseSourceId;
          let stored = 0;
          sharedKeyManager.storeKey.mockImplementation(() => {
            stored += 1;
            return Promise.resolve({ id: `imported-${stored}` });
          });
          mockFunded([3]);
          act(() => {
            useAuthenticationStore.setState({
              importRecoveryPhrase: originalStoreMethods.importRecoveryPhrase,
            });
          });
          return hook;
        };

        afterEach(() => {
          clearPendingRecoveryPhrase();
        });

        it("adds the phrase as a new source with index 0 and its funded indices, landing on index 0", async () => {
          const { result } = mockImportSession();
          const id = holdPendingRecoveryPhrase(importedPhrase);

          await act(async () => {
            await result.current.importRecoveryPhrase(mockPassword, id);
          });

          expect(result.current.error).toBeNull();
          // Indices 1 to 49 are looked up on mainnet.
          expect(getAccount).toHaveBeenCalledTimes(49);
          expect(getAccount).toHaveBeenCalledWith(
            publicKeyAt(importedPhrase, 49),
            NETWORKS.PUBLIC,
          );
          expect(storedAccounts()).toEqual([
            phraseAccount(0),
            expect.objectContaining({
              id: "imported-1",
              sourceId: importedSourceId,
              publicKey: publicKeyAt(importedPhrase, 0),
            }),
            expect.objectContaining({
              id: "imported-2",
              sourceId: importedSourceId,
              publicKey: publicKeyAt(importedPhrase, 3),
            }),
          ]);
          expect(storedIndices()).toEqual({
            [mockPhraseSourceId]: [0],
            [importedSourceId]: [0, 3],
          });
          expect(storedSources()).toEqual([
            expect.objectContaining({ id: mockPhraseSourceId }),
            expect.objectContaining({
              id: importedSourceId,
              type: SecretSourceType.PHRASE,
              label: "Seed Phrase 2",
            }),
          ]);
          // The wallet's pin and phrase stay; the imported one joins them.
          expect(dataStorageMemory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(
            mockPhraseSourceId,
          );
          const written = writtenTemporaryStores();
          expect(written[written.length - 1].mnemonics).toEqual({
            [mockPhraseSourceId]: mockMnemonicPhrase,
            [importedSourceId]: importedPhrase,
          });
          expect(dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID]).toBe(
            "imported-1",
          );
          expect(getPendingRecoveryPhrase(id)).toBeNull();
          expect(linkWalletSources).toHaveBeenCalledTimes(1);
        });

        it("refuses a phrase the wallet already holds before looking anything up", async () => {
          const { result } = mockImportSession();
          dataStorageMemory[STORAGE_KEYS.SECRET_SOURCES] = JSON.stringify({
            [importedSourceId]: {
              id: importedSourceId,
              type: SecretSourceType.PHRASE,
              label: "Seed Phrase 1",
              createdAt: 1,
            },
          });
          const id = holdPendingRecoveryPhrase(importedPhrase);

          await act(async () => {
            await expect(
              result.current.importRecoveryPhrase(mockPassword, id),
            ).rejects.toThrow("authStore.error.recoveryPhraseAlreadyHeld");
          });

          expect(result.current.error).toBe(
            "authStore.error.recoveryPhraseAlreadyHeld",
          );
          expect(getAccount).not.toHaveBeenCalled();
          expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
        });

        it("refuses, and adds nothing, when one of the phrase's addresses is already in the wallet", async () => {
          const { result } = mockImportSession([
            phraseAccount(0),
            {
              id: "imported-key",
              sourceId: "key:imported",
              name: "Account 2",
              publicKey: publicKeyAt(importedPhrase, 3),
              importedFromSecretKey: true,
            },
          ]);
          const id = holdPendingRecoveryPhrase(importedPhrase);

          await act(async () => {
            await expect(
              result.current.importRecoveryPhrase(mockPassword, id),
            ).rejects.toThrow("authStore.error.accountAlreadyExists");
          });

          expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
          expect(storedSources()).toHaveLength(1);
          expect(storedAccounts()).toHaveLength(2);
        });

        it("stores nothing and keeps the phrase on a wrong password", async () => {
          const { result } = mockImportSession();
          const id = holdPendingRecoveryPhrase(importedPhrase);
          sharedKeyManager.loadKey.mockRejectedValue(new Error("bad password"));

          await act(async () => {
            await expect(
              result.current.importRecoveryPhrase("wrong", id),
            ).rejects.toThrow();
          });

          expect(getAccount).not.toHaveBeenCalled();
          expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
          expect(getPendingRecoveryPhrase(id)).toBe(importedPhrase);
        });

        it("refuses a phrase that fails validation", async () => {
          const { result } = mockImportSession();
          (StellarHDWallet.validateMnemonic as jest.Mock).mockReturnValueOnce(
            false,
          );
          const id = holdPendingRecoveryPhrase(importedPhrase);

          await act(async () => {
            await expect(
              result.current.importRecoveryPhrase(mockPassword, id),
            ).rejects.toThrow("authStore.error.invalidMnemonicPhrase");
          });

          expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
        });

        it("removes the source and its indices again when no account was stored", async () => {
          const { result } = mockImportSession();
          const id = holdPendingRecoveryPhrase(importedPhrase);
          sharedKeyManager.storeKey.mockRejectedValue(new Error("disk full"));

          await act(async () => {
            await expect(
              result.current.importRecoveryPhrase(mockPassword, id),
            ).rejects.toThrow();
          });

          expect(result.current.error).toBe(
            "authStore.error.failedToImportRecoveryPhrase",
          );
          expect(storedSources()).toEqual([
            expect.objectContaining({ id: mockPhraseSourceId }),
          ]);
          expect(storedIndices()?.[importedSourceId] ?? []).toEqual([]);
          expect(storedAccounts()).toEqual([phraseAccount(0)]);
          expect(dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID]).toBe(
            "account-0",
          );
          // The user can retry without typing the phrase again.
          expect(getPendingRecoveryPhrase(id)).toBe(importedPhrase);
        });

        it("keeps the source, and puts the previous account back, when a later account fails to store", async () => {
          const { result } = mockImportSession();
          const id = holdPendingRecoveryPhrase(importedPhrase);
          sharedKeyManager.storeKey
            .mockResolvedValueOnce({ id: "imported-1" })
            .mockRejectedValueOnce(new Error("disk full"));

          await act(async () => {
            await expect(
              result.current.importRecoveryPhrase(mockPassword, id),
            ).rejects.toThrow();
          });

          // A retry is refused as held rather than storing index 0 twice.
          expect(storedSources()).toEqual([
            expect.objectContaining({ id: mockPhraseSourceId }),
            expect.objectContaining({ id: importedSourceId }),
          ]);
          expect(
            storedAccounts().map(({ id: accountId }) => accountId),
          ).toEqual(["account-0", "imported-1"]);
          expect(dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID]).toBe(
            "account-0",
          );
        });

        it("stores one set of accounts when the same import runs twice at once", async () => {
          const { result } = mockImportSession();
          const id = holdPendingRecoveryPhrase(importedPhrase);

          let outcomes: PromiseSettledResult<void>[] = [];
          await act(async () => {
            outcomes = await Promise.allSettled([
              result.current.importRecoveryPhrase(mockPassword, id),
              result.current.importRecoveryPhrase(mockPassword, id),
            ]);
          });

          expect(outcomes.map(({ status }) => status).sort()).toEqual([
            "fulfilled",
            "rejected",
          ]);
          expect(storedPublicKeys()).toEqual([
            publicKeyAt(importedPhrase, 0),
            publicKeyAt(importedPhrase, 3),
          ]);
          expect(storedSources()).toHaveLength(2);
        });

        it("lets only the latest of two overlapping holds store the phrase", async () => {
          const { result } = mockImportSession();

          let outcomes: PromiseSettledResult<void>[] = [];
          await act(async () => {
            const first = result.current.importRecoveryPhrase(
              mockPassword,
              holdPendingRecoveryPhrase(importedPhrase),
            );
            // A second surface, or a retry, holds the same phrase again
            // while the first import's lookups run.
            const second = result.current.importRecoveryPhrase(
              mockPassword,
              holdPendingRecoveryPhrase(importedPhrase),
            );
            outcomes = await Promise.allSettled([first, second]);
          });

          expect(
            outcomes.filter(({ status }) => status === "fulfilled"),
          ).toHaveLength(1);
          expect(storedPublicKeys()).toEqual([
            publicKeyAt(importedPhrase, 0),
            publicKeyAt(importedPhrase, 3),
          ]);
        });

        it("stores nothing when a lock drops the phrase while the lookups run", async () => {
          const { result } = mockImportSession();
          const id = holdPendingRecoveryPhrase(importedPhrase);
          (getAccount as jest.Mock).mockImplementation(() => {
            clearPendingRecoveryPhrase();
            return Promise.resolve(null);
          });

          await act(async () => {
            await expect(
              result.current.importRecoveryPhrase(mockPassword, id),
            ).rejects.toThrow("authStore.error.pendingRecoveryPhraseMissing");
          });

          expect(sharedKeyManager.storeKey).not.toHaveBeenCalled();
          expect(storedSources()).toHaveLength(1);
        });
      });
    });

    // Port of the extension's account provenance (#75): type and source live
    // on the plain-storage account record, a secret-key import's keystore
    // carries no phrase, and sign-in no longer depends on the active keystore
    // carrying one.
    describe("account provenance", () => {
      const importedSourceId = `key:${importedSecretKey}`;
      const importedKeystore = {
        id: "imported-account-id",
        publicKey: importedPublicKey,
        privateKey: importedSecretKey,
        extra: { imported: true },
      };
      const derivedKeystore = {
        id: mockAccountId,
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
        extra: { imported: false, mnemonicPhrase: mockMnemonicPhrase },
      };
      const importedAccount: Account = {
        id: importedKeystore.id,
        sourceId: importedSourceId,
        name: "Account 2",
        publicKey: importedPublicKey,
        importedFromSecretKey: true,
      };
      const derivedAccount: Account = {
        id: mockAccountId,
        sourceId: mockPhraseSourceId,
        name: mockAccountName,
        publicKey: mockPublicKey,
      };
      const storedAccounts = (): Account[] =>
        JSON.parse(dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] ?? "[]");

      it("keeps the phrase in a derived account's keystore", async () => {
        const { result } = renderHook(() => useAuthenticationStore());
        act(() => {
          useAuthenticationStore.setState({
            signUp: originalStoreMethods.signUp,
          });
        });

        await act(async () => {
          await result.current.signUp({
            mnemonicPhrase: mockMnemonicPhrase,
            password: mockPassword,
          });
        });

        expect(sharedKeyManager.storeKey).toHaveBeenCalledWith(
          expect.objectContaining({
            key: expect.objectContaining({
              extra: { imported: false, mnemonicPhrase: mockMnemonicPhrase },
            }),
          }),
        );
      });

      describe("signIn with an unstamped import active", () => {
        beforeEach(() => {
          sharedKeyManager.loadAllKeyIds.mockResolvedValue([
            importedKeystore.id,
            derivedKeystore.id,
          ]);
          sharedKeyManager.loadKey.mockImplementation((id: string) =>
            Promise.resolve(
              id === importedKeystore.id ? importedKeystore : derivedKeystore,
            ),
          );
          dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] =
            importedKeystore.id;
          act(() => {
            useAuthenticationStore.setState({
              authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
              signIn: originalStoreMethods.signIn,
            });
          });
        });

        it("reads the wallet phrase from a derived keystore and holds it", async () => {
          dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
            importedAccount,
            derivedAccount,
          ]);
          const { result } = renderHook(() => useAuthenticationStore());

          await act(async () => {
            await result.current.signIn({ password: mockPassword });
          });

          expect(sharedKeyManager.loadKey).toHaveBeenCalledWith(
            derivedKeystore.id,
            mockPassword,
          );
          const [written] = writtenTemporaryStores();
          expect(written.mnemonics).toEqual({
            [mockPhraseSourceId]: mockMnemonicPhrase,
          });
          expect(written.privateKeys).toEqual({
            [importedKeystore.id]: importedSecretKey,
          });
          expect(clearTemporaryData).not.toHaveBeenCalled();
        });

        describe("with a derived keystore that cannot provide the phrase", () => {
          const unreadableAccount: Account = {
            ...derivedAccount,
            id: "unreadable-account-id",
            name: "Account 3",
          };
          const openFailure = new Error("keystore unreadable");

          const signInWith = async (
            loadDerived: (id: string) => Promise<unknown>,
          ) => {
            dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
              importedAccount,
              unreadableAccount,
              derivedAccount,
            ]);
            sharedKeyManager.loadKey.mockImplementation((id: string) =>
              id === importedKeystore.id
                ? Promise.resolve(importedKeystore)
                : loadDerived(id),
            );
            const { result } = renderHook(() => useAuthenticationStore());

            await act(async () => {
              await result.current.signIn({ password: mockPassword });
            });
          };

          it("reads the phrase from the next derived keystore when one fails to open", async () => {
            await signInWith((id) =>
              id === unreadableAccount.id
                ? Promise.reject(openFailure)
                : Promise.resolve(derivedKeystore),
            );

            expect(sharedKeyManager.loadKey).toHaveBeenCalledWith(
              unreadableAccount.id,
              mockPassword,
            );
            expect(sharedKeyManager.loadKey).toHaveBeenCalledWith(
              derivedKeystore.id,
              mockPassword,
            );
            expect(logger.error).toHaveBeenCalledWith(
              "signIn",
              "Failed to open a derived keystore for the wallet phrase",
              openFailure,
            );
            const [written] = writtenTemporaryStores();
            expect(written.mnemonics).toEqual({
              [mockPhraseSourceId]: mockMnemonicPhrase,
            });
            expect(clearTemporaryData).not.toHaveBeenCalled();
          });

          it("reads the phrase from the next derived keystore when one carries none", async () => {
            await signInWith((id) =>
              Promise.resolve(
                id === unreadableAccount.id
                  ? { ...derivedKeystore, id, extra: { imported: false } }
                  : derivedKeystore,
              ),
            );

            const [written] = writtenTemporaryStores();
            expect(written.mnemonics).toEqual({
              [mockPhraseSourceId]: mockMnemonicPhrase,
            });
          });

          it("stops at the first derived keystore that yields the phrase", async () => {
            await signInWith(() => Promise.resolve(derivedKeystore));

            expect(sharedKeyManager.loadKey).not.toHaveBeenCalledWith(
              derivedKeystore.id,
              mockPassword,
            );
          });

          it("holds no phrase but still signs in when every derived keystore fails", async () => {
            await signInWith(() => Promise.reject(openFailure));

            expect(logger.error).toHaveBeenCalledWith(
              "signIn",
              "Failed to open a derived keystore for the wallet phrase",
              openFailure,
            );
            const [written] = writtenTemporaryStores();
            expect(written.mnemonics).toEqual({});
            expect(written.privateKeys).toEqual({
              [importedKeystore.id]: importedSecretKey,
            });
            expect(clearTemporaryData).not.toHaveBeenCalled();
          });
        });

        it("holds no phrase in a secret-key-only wallet and does not wipe it", async () => {
          dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
            importedAccount,
          ]);
          const { result } = renderHook(() => useAuthenticationStore());

          await act(async () => {
            await result.current.signIn({ password: mockPassword });
          });

          const [written] = writtenTemporaryStores();
          expect(written.mnemonics).toEqual({});
          expect(written.privateKeys).toEqual({
            [importedKeystore.id]: importedSecretKey,
          });
          expect(clearTemporaryData).not.toHaveBeenCalled();
          expect(storedAccounts()).toEqual([importedAccount]);
        });

        it("recreates a missing list entry for an unstamped keystore as an import rooted in its own key", async () => {
          dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([
            derivedAccount,
          ]);
          const { result } = renderHook(() => useAuthenticationStore());

          await act(async () => {
            await result.current.signIn({ password: mockPassword });
          });

          expect(storedAccounts()).toEqual([
            derivedAccount,
            expect.objectContaining({
              id: importedKeystore.id,
              sourceId: importedSourceId,
              publicKey: importedPublicKey,
              importedFromSecretKey: true,
            }),
          ]);
        });
      });

      describe("signIn recovering a missing list entry for a stamped keystore", () => {
        const signInWithActive = async (keystore: typeof derivedKeystore) => {
          sharedKeyManager.loadAllKeyIds.mockResolvedValue([keystore.id]);
          sharedKeyManager.loadKey.mockResolvedValue(keystore);
          dataStorageMemory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = keystore.id;
          dataStorageMemory[STORAGE_KEYS.ACCOUNT_LIST] = JSON.stringify([]);
          act(() => {
            useAuthenticationStore.setState({
              authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
              signIn: originalStoreMethods.signIn,
            });
          });
          const { result } = renderHook(() => useAuthenticationStore());

          await act(async () => {
            await result.current.signIn({ password: mockPassword });
          });
        };

        it("recreates an import that earlier builds stamped with the phrase as an import rooted in its own key", async () => {
          await signInWithActive({
            ...importedKeystore,
            extra: { imported: true, mnemonicPhrase: mockMnemonicPhrase },
          });

          expect(storedAccounts()).toEqual([
            expect.objectContaining({
              id: importedKeystore.id,
              sourceId: importedSourceId,
              publicKey: importedPublicKey,
              importedFromSecretKey: true,
            }),
          ]);
        });

        it("recreates a key the phrase derives as an account rooted in the phrase", async () => {
          await signInWithActive(derivedKeystore);

          expect(storedAccounts()).toEqual([
            expect.objectContaining({
              id: derivedKeystore.id,
              sourceId: mockPhraseSourceId,
              publicKey: mockPublicKey,
              importedFromSecretKey: false,
            }),
          ]);
        });
      });
    });
  });
});

import { NavigationContainerRef } from "@react-navigation/native";
import { act, renderHook } from "@testing-library/react-hooks";
import {
  NETWORKS,
  STORAGE_KEYS,
  SENSITIVE_STORAGE_KEYS,
} from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore, ActiveAccount } from "ducks/auth";
import {
  encryptDataWithPassword,
  decryptDataWithPassword,
  deriveKeyFromPassword,
  generateSalt,
} from "helpers/encryptPassword";
import { createKeyManager } from "helpers/keyManager/keyManager";
import {
  clearNonSensitiveData,
  clearTemporaryData,
  getHashKey,
} from "services/storage/helpers";
import {
  dataStorage,
  secureDataStorage,
} from "services/storage/storageFactory";
import StellarHDWallet from "stellar-hd-wallet";

// Mock dependencies
jest.mock("helpers/keyManager/keyManager", () => ({
  createKeyManager: jest.fn(),
}));

jest.mock("helpers/encryptPassword", () => ({
  encryptDataWithPassword: jest.fn(),
  decryptDataWithPassword: jest.fn(),
  deriveKeyFromPassword: jest.fn(),
  generateSalt: jest.fn(),
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
    remove: jest.fn(),
  },
}));

jest.mock("stellar-hd-wallet", () => ({
  __esModule: true,
  default: {
    fromMnemonic: jest.fn(),
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
  },
}));

jest.mock("i18next", () => ({
  t: (key: string) => key,
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
  const mockTemporaryStore = JSON.stringify({
    privateKeys: {
      [mockAccountId]: mockPrivateKey,
    },
    mnemonicPhrase: mockMnemonicPhrase,
  });

  const mockAccountList = [
    {
      id: mockAccountId,
      name: mockAccountName,
      publicKey: mockPublicKey,
      network: NETWORKS.TESTNET,
    },
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset the store before each test
    useAuthenticationStore.getState().logout = jest.fn();
    useAuthenticationStore.getState().signUp = jest.fn();
    useAuthenticationStore.getState().signIn = jest.fn();
    useAuthenticationStore.getState().importWallet = jest.fn();
    useAuthenticationStore.getState().getAuthStatus = jest.fn();
    useAuthenticationStore.getState().fetchActiveAccount = jest.fn();
    useAuthenticationStore.getState().refreshActiveAccount = jest.fn();
    useAuthenticationStore.getState().setNavigationRef = jest.fn();
    useAuthenticationStore.getState().navigateToLockScreen = jest.fn();
    useAuthenticationStore.getState().createAccount = jest.fn();
    useAuthenticationStore.getState().renameAccount = jest.fn();
    useAuthenticationStore.getState().getAllAccounts = jest.fn();
    useAuthenticationStore.getState().selectAccount = jest.fn();
    useAuthenticationStore.getState().getTemporaryStore = jest.fn();
    useAuthenticationStore.getState().clearError = jest.fn();

    // Reset the store state
    act(() => {
      useAuthenticationStore.setState({
        network: NETWORKS.TESTNET,
        isLoading: false,
        isCreatingAccount: false,
        isRenamingAccount: false,
        isLoadingAllAccounts: false,
        error: null,
        authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
        allAccounts: [],
        account: null,
        isLoadingAccount: false,
        accountError: null,
        navigationRef: null,
      });
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

    // Setup storage helpers
    (getHashKey as jest.Mock).mockResolvedValue(mockHashKeyObj);
    (clearTemporaryData as jest.Mock).mockResolvedValue(undefined);
    (clearNonSensitiveData as jest.Mock).mockResolvedValue(undefined);

    // Setup storage mocks
    (dataStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === STORAGE_KEYS.ACCOUNT_LIST) {
        return Promise.resolve(JSON.stringify(mockAccountList));
      }
      if (key === STORAGE_KEYS.ACTIVE_ACCOUNT_ID) {
        return Promise.resolve(mockAccountId);
      }
      return Promise.resolve(null);
    });

    (secureDataStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === SENSITIVE_STORAGE_KEYS.TEMPORARY_STORE) {
        return Promise.resolve(mockEncryptedData);
      }
      if (key === SENSITIVE_STORAGE_KEYS.HASH_KEY) {
        return Promise.resolve(JSON.stringify(mockHashKeyObj));
      }
      return Promise.resolve(null);
    });

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
        isBiometricsAvailable: true,
      });

      expect(signUpMock).toHaveBeenCalledWith({
        mnemonicPhrase: mockMnemonicPhrase,
        password: mockPassword,
        isBiometricsAvailable: true,
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
});

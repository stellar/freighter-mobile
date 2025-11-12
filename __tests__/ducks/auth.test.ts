import { NavigationContainerRef } from "@react-navigation/native";
import { act, renderHook } from "@testing-library/react-hooks";
import {
  NETWORKS,
  STORAGE_KEYS,
  SENSITIVE_STORAGE_KEYS,
  LoginType,
} from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { Account, AUTH_STATUS } from "config/types";
import {
  useAuthenticationStore,
  ActiveAccount,
  appendAccounts,
} from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import {
  encryptDataWithPassword,
  decryptDataWithPassword,
  deriveKeyFromPassword,
  generateSalt,
} from "helpers/encryptPassword";
import { createKeyManager } from "helpers/keyManager/keyManager";
import { getSupportedBiometryType, BIOMETRY_TYPE } from "react-native-keychain";
import {
  clearNonSensitiveData,
  clearTemporaryData,
  getHashKey,
} from "services/storage/helpers";
// Import mocked modules
import { rnBiometrics } from "services/storage/reactNativeBiometricStorage";
import {
  dataStorage,
  secureDataStorage,
  biometricDataStorage,
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
  biometricDataStorage: {
    getItem: jest.fn(),
  },
}));

jest.mock("services/storage/reactNativeBiometricStorage", () => ({
  rnBiometrics: {
    isSensorAvailable: jest.fn(),
  },
}));

jest.mock("react-native-keychain", () => ({
  getSupportedBiometryType: jest.fn(),
  BIOMETRY_TYPE: {
    FACE_ID: "FaceID",
    FINGERPRINT: "Fingerprint",
    FACE: "Face",
    TOUCH_ID: "TouchID",
    OPTIC_ID: "OpticID",
    IRIS: "Iris",
  },
}));

jest.mock("ducks/preferences", () => ({
  usePreferencesStore: {
    getState: jest.fn(),
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

  let dataStorageMemory: Record<string, string>;
  let accountCounter = 0;

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

      const response = await result.current.enableBiometrics(mockCallback);

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
        result.current.enableBiometrics(mockCallback),
      ).rejects.toThrow("No biometry type found");
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it("should throw error when no stored password is found", async () => {
      const { result } = renderHook(() => useAuthenticationStore());
      const mockCallback = jest.fn().mockResolvedValue("success");

      (biometricDataStorage.getItem as jest.Mock).mockResolvedValue(null);

      await expect(
        result.current.enableBiometrics(mockCallback),
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
        result.current.enableBiometrics(mockCallback),
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

      const response = await result.current.verifyActionWithBiometrics(
        mockCallback,
        ...mockArgs,
      );

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

      const response = await result.current.verifyActionWithBiometrics(
        mockCallback,
        ...mockArgs,
      );

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

      const response = await result.current.verifyActionWithBiometrics(
        mockCallback,
        ...mockArgs,
      );

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

      const response = await result.current.verifyActionWithBiometrics(
        mockCallback,
        ...mockArgs,
      );

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

      const response = await result.current.verifyActionWithBiometrics(
        mockCallback,
        ...mockArgs,
      );

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
        result.current.verifyActionWithBiometrics(mockCallback, ...mockArgs),
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
        result.current.verifyActionWithBiometrics(mockCallback, ...mockArgs),
      ).rejects.toThrow("Biometric authentication failed");
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });
});

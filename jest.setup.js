/* eslint-disable @fnando/consistent-import/consistent-import */
/* eslint-disable import/extensions */
import mockClipboard from "@react-native-clipboard/clipboard/jest/clipboard-mock.js";
import mockRNDeviceInfo from "react-native-device-info/jest/react-native-device-info-mock";
import mockGestureHandler from "react-native-gesture-handler/jestSetup";
import { TextEncoder, TextDecoder } from "util";

// Ensure TextEncoder/TextDecoder are available for libs that expect Web APIs
// Node >= 11 provides these in 'util', but they may not be on the global in Jest
// Keep assignments idempotent to avoid warnings across workers
if (typeof global.TextEncoder === "undefined") {
  // @ts-expect-error: global typing varies in Jest env
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  // @ts-expect-error: global typing varies in Jest env
  global.TextDecoder = TextDecoder;
}

// Polyfill TextEncoder for Node.js environment
global.TextEncoder = require("util").TextEncoder;

// Create a direct mock for the specific functions from react-native-responsive-screen
// This ensures these functions are defined before any module imports them
global.heightPercentageToDP = jest.fn((height) => height);
global.widthPercentageToDP = jest.fn((width) => width);

// Mock the module itself
jest.mock("react-native-responsive-screen", () => ({
  heightPercentageToDP: global.heightPercentageToDP,
  widthPercentageToDP: global.widthPercentageToDP,
}));

// Mock dimensions helper explicitly
jest.mock("helpers/dimensions", () => ({
  pxValue: (value) => value,
  px: (value) => `${value}px`,
  fsValue: (value) => value,
  fs: (value) => `${value}px`,
  deviceAspectRatio: 0.5,
  toPercent: (percentNumber) => `${percentNumber}%`,
  calculateEdgeSpacing: (baseSpacing, options) => {
    const { multiplier = 1, toNumber = false } = options || {};
    const scaledValue = baseSpacing * multiplier;
    return toNumber ? scaledValue : `${scaledValue}px`;
  },
}));

// Mock react-native
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.Dimensions = {
    get: jest.fn().mockReturnValue({ width: 400, height: 800 }),
  };
  return RN;
});

// Mock navigation
jest.mock("@react-navigation/native", () => {
  const originalModule = jest.requireActual("@react-navigation/native");

  // Create a mockRef that can be called with generics
  const mockRef = {
    current: null,
    navigate: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    goBack: jest.fn(),
    getRootState: jest.fn().mockReturnValue({}),
    isFocused: jest.fn().mockReturnValue(true),
    canGoBack: jest.fn().mockReturnValue(false),
    isReady: jest.fn().mockReturnValue(true),
  };

  // Mock createNavigationContainerRef as a function that can accept generics
  const createNavigationContainerRef = function () {
    return mockRef;
  };

  // Make sure createNavigationContainerRef is available
  createNavigationContainerRef.mockRef = mockRef;

  return {
    __esModule: true,
    ...originalModule,
    useNavigation: jest.fn().mockReturnValue({
      navigate: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
    }),
    createNavigationContainerRef,
  };
});

// Mock NetInfo
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true }),
  ),
}));

// Mock safe area context
jest.mock("react-native-safe-area-context", () => {
  const inset = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  return {
    SafeAreaProvider: jest.fn(({ children }) => children),
    SafeAreaView: jest.fn(({ children }) => children),
    useSafeAreaInsets: jest.fn(() => inset),
  };
});

jest.mock("@react-native-clipboard/clipboard", () => mockClipboard);

jest.mock("@stablelib/base64", () => ({
  encode: jest.fn((input) => `mock-base64(${input})`),
  decode: jest.fn((input) => new Uint8Array([1, 2, 3])), // Mock decoded Uint8Array
}));

jest.mock("@stablelib/utf8", () => ({
  encode: jest.fn(
    (input) => new Uint8Array(input.split("").map((c) => c.charCodeAt(0))),
  ),
  decode: jest.fn((input) => "mock-decoded-text"),
}));

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("react-native-scrypt", () => {
  return jest.fn(() => Promise.resolve("a1b2c3d4")); // Mocked hex string
});

jest.mock("tweetnacl", () => {
  const secretbox = {
    keyLength: 32,
    nonceLength: 24,
    open: jest.fn(() => new Uint8Array([77, 111, 99, 107])),
  };

  return {
    secretbox,
    randomBytes: jest.fn((length) => new Uint8Array(length).fill(1)),
  };
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("helpers/localeUtils", () => ({
  getDeviceLanguage: jest.fn().mockReturnValue("en"),
  getDeviceLocale: jest.fn().mockReturnValue("en-US"),
  isSupportedLocale: jest.fn().mockReturnValue(true),
}));

// Mock stellarExpert service to avoid import issues
jest.mock("services/stellarExpert", () => ({
  searchToken: jest.fn(async () => ({
    _embedded: {
      records: [],
    },
  })),
}));

// Mock react-native-bootsplash
jest.mock("react-native-bootsplash", () => ({
  hide: jest.fn(),
  show: jest.fn(),
  getVisibilityStatus: jest.fn(() => Promise.resolve("hidden")),
}));

jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => ({
    Navigator: jest.fn(({ children }) => children),
    Screen: jest.fn(),
    Group: jest.fn(),
  }),
}));

jest.mock("@react-navigation/bottom-tabs", () => ({
  createBottomTabNavigator: () => ({
    Navigator: jest.fn(({ children }) => children),
    Screen: jest.fn(),
    Group: jest.fn(),
  }),
}));

jest.mock("react-native-device-info", () => mockRNDeviceInfo);

jest.mock("react-native-gesture-handler", () => mockGestureHandler);

jest.mock("@gorhom/bottom-sheet", () => {
  const mockBottomSheet = {
    present: jest.fn(),
    dismiss: jest.fn(),
    snapToIndex: jest.fn(),
    expand: jest.fn(),
    collapse: jest.fn(),
    close: jest.fn(),
  };

  return {
    __esModule: true,
    ...jest.requireActual("@gorhom/bottom-sheet"),
    useBottomSheetModal: () => mockBottomSheet,
    useBottomSheet: () => mockBottomSheet,
  };
});

jest.mock("react-native-vision-camera", () => ({
  Camera: "Camera",
  useCameraDevice: () => null,
  useCodeScanner: () => ({}),
  useCameraPermission: () => ({
    hasPermission: false,
    requestPermission: jest.fn(),
  }),
}));

jest.mock("ducks/walletKit", () => ({
  WalletKitEventTypes: {
    SESSION_PROPOSAL: "SESSION_PROPOSAL",
    SESSION_REQUEST: "SESSION_REQUEST",
    NONE: "NONE",
  },
  StellarRpcMethods: {
    SIGN_XDR: "SIGN_XDR",
    SIGN_AND_SUBMIT_XDR: "SIGN_AND_SUBMIT_XDR",
  },
  StellarRpcChains: {
    PUBLIC: "PUBLIC",
    TESTNET: "TESTNET",
  },
  StellarRpcEvents: {
    ACCOUNT_CHANGED: "ACCOUNT_CHANGED",
  },
  useWalletKitStore: () => ({
    event: {},
    activeSessions: [],
    setEvent: jest.fn(),
    clearEvent: jest.fn(),
    fetchActiveSessions: jest.fn(),
    disconnectAllSessions: jest.fn(),
  }),
}));

jest.mock("services/analytics", () => ({
  analytics: {
    track: jest.fn(),
    trackAppOpened: jest.fn(),
    setAnalyticsEnabled: jest.fn(),
    identifyUser: jest.fn(),
    trackReAuthSuccess: jest.fn(),
    trackReAuthFail: jest.fn(),
    trackSignedTransaction: jest.fn(),
    trackSimulationError: jest.fn(),
    trackCopyPublicKey: jest.fn(),
    trackSendPaymentSuccess: jest.fn(),
    trackSendPaymentPathPaymentSuccess: jest.fn(),
    trackSwapSuccess: jest.fn(),
    trackTransactionError: jest.fn(),
    trackSendPaymentSetMax: jest.fn(),
    trackSendPaymentTypeSelected: jest.fn(),
    trackCopyBackupPhrase: jest.fn(),
    trackQRScanSuccess: jest.fn(),
    trackQRScanError: jest.fn(),
    getAnalyticsDebugInfo: jest.fn(() => ({
      isEnabled: false,
      userId: null,
      hasInitialized: false,
      environment: "test",
      amplitudeKey: "test-key...",
      recentEvents: [],
    })),
    clearRecentEvents: jest.fn(),
  },
  TransactionType: {
    Classic: "classic",
    Soroban: "soroban",
  },
}));

jest.mock("services/analytics/core", () => ({
  initAnalytics: jest.fn(),
  setAnalyticsEnabled: jest.fn(),
  track: jest.fn(),
  flushEvents: jest.fn(),
  trackAppOpened: jest.fn(),
  flushOnBackground: jest.fn(),
  isInitialized: jest.fn(() => false),
}));

jest.mock("services/analytics/user", () => ({
  identifyUser: jest.fn(),
  getUserId: jest.fn(() => Promise.resolve("test-user-id")),
}));

jest.mock("services/analytics/debug", () => ({
  getAnalyticsDebugInfo: jest.fn(() => ({
    isEnabled: false,
    userId: null,
    hasInitialized: false,
    environment: "test",
    amplitudeKey: "test-key...",
    recentEvents: [],
  })),
  clearRecentEvents: jest.fn(),
  logAnalyticsDebugInfo: jest.fn(),
  addToRecentEvents: jest.fn(),
}));

jest.mock("react-native-permissions", () => ({
  PERMISSIONS: {
    IOS: {
      APP_TRACKING_TRANSPARENCY: "app-tracking-transparency",
    },
    ANDROID: {
      READ_MEDIA_IMAGES: "android.permission.READ_MEDIA_IMAGES",
      READ_MEDIA_VIDEO: "android.permission.READ_MEDIA_VIDEO",
      READ_EXTERNAL_STORAGE: "android.permission.READ_EXTERNAL_STORAGE",
    },
  },
  RESULTS: {
    GRANTED: "granted",
    DENIED: "denied",
    BLOCKED: "blocked",
    UNAVAILABLE: "unavailable",
  },
  check: jest.fn(() => Promise.resolve("granted")),
  request: jest.fn(() => Promise.resolve("granted")),
  checkMultiple: jest.fn(() =>
    Promise.resolve(["granted", "granted", "granted"]),
  ),
  requestMultiple: jest.fn(() =>
    Promise.resolve(["granted", "granted", "granted"]),
  ),
  openSettings: jest.fn(() => Promise.resolve()),
}));

jest.mock("@react-native-camera-roll/camera-roll", () => ({
  CameraRoll: {
    saveAsset: jest.fn(() => Promise.resolve()),
    getPhotos: jest.fn(() => Promise.resolve({ edges: [] })),
    deletePhotos: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@dr.pogodin/react-native-fs", () => ({
  DocumentDirectoryPath: "/mock/documents/path",
  downloadFile: jest.fn(() => ({
    promise: Promise.resolve({ statusCode: 200 }),
  })),
  exists: jest.fn(() => Promise.resolve(true)),
  unlink: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-biometrics
jest.mock("react-native-biometrics", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    isSensorAvailable: jest.fn(() => Promise.resolve(true)),
    simplePrompt: jest.fn(() => Promise.resolve({ success: true })),
    createKeys: jest.fn(() =>
      Promise.resolve({ publicKey: "mock-public-key" }),
    ),
    deleteKeys: jest.fn(() => Promise.resolve()),
    createSignature: jest.fn(() =>
      Promise.resolve({ signature: "mock-signature" }),
    ),
    biometricKeysExist: jest.fn(() => Promise.resolve(true)),
  })),
}));

// Mock the useBiometrics hook

jest.mock("react-native-keychain", () => ({
  BIOMETRY_TYPE: {
    FACE_ID: "FaceID",
    TOUCH_ID: "TouchID",
    FINGERPRINT: "Fingerprint",
    FACE: "Face",
    IRIS: "Iris",
    NONE: "None",
  },
  ACCESSIBLE: {
    ALWAYS_THIS_DEVICE_ONLY: "AccessibleAlwaysThisDeviceOnly",
    ALWAYS: "AccessibleAlways",
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly",
    WHEN_UNLOCKED: "AccessibleWhenUnlocked",
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:
      "AccessibleAfterFirstUnlockThisDeviceOnly",
    AFTER_FIRST_UNLOCK: "AccessibleAfterFirstUnlock",
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY:
      "AccessibleWhenPasscodeSetThisDeviceOnly",
    WHEN_PASSCODE_SET: "AccessibleWhenPasscodeSet",
  },
  ACCESS_CONTROL: {
    USER_PRESENCE: "UserPresence",
    BIOMETRY_ANY: "BiometryAny",
    BIOMETRY_CURRENT_SET: "BiometryCurrentSet",
    DEVICE_PASSCODE: "DevicePasscode",
    WATCH: "Watch",
    OR: "Or",
    AND: "And",
  },
  AUTHENTICATION_TYPE: {
    BIOMETRICS: "AuthenticationWithBiometrics",
    DEVICE_PASSCODE_OR_BIOMETRICS:
      "AuthenticationWithDevicePasscodeOrBiometrics",
    DEVICE_PASSCODE: "AuthenticationWithDevicePasscode",
  },
  SECURITY_LEVEL: {
    ANY: "SecurityLevelAny",
    SECURE_SOFTWARE: "SecurityLevelSecureSoftware",
    SECURE_HARDWARE: "SecurityLevelSecureHardware",
  },
  getSupportedBiometryType: jest.fn(() => Promise.resolve("FaceID")),
  getInternetCredentials: jest.fn(() => Promise.resolve(null)),
  setInternetCredentials: jest.fn(() => Promise.resolve()),
  resetInternetCredentials: jest.fn(() => Promise.resolve()),
  getGenericPassword: jest.fn(() => Promise.resolve(null)),
  setGenericPassword: jest.fn(() => Promise.resolve()),
  resetGenericPassword: jest.fn(() => Promise.resolve()),
  hasGenericPassword: jest.fn(() => Promise.resolve(false)),
  getAllGenericPasswordServices: jest.fn(() => Promise.resolve([])),
  getAllInternetCredentials: jest.fn(() => Promise.resolve([])),
  canImplyAuthentication: jest.fn(() => Promise.resolve(false)),
  getSecurityLevel: jest.fn(() => Promise.resolve("SecurityLevelAny")),
  getAvailableBiometryType: jest.fn(() => Promise.resolve("FaceID")),
  isSensorAvailable: jest.fn(() => Promise.resolve(true)),
}));
// Mock react-native-fast-opencv
jest.mock("react-native-fast-opencv", () => ({
  BorderTypes: {
    BORDER_DEFAULT: 0,
  },
  DataTypes: {
    CV_8U: 0,
  },
  ObjectType: {
    Mat: "Mat",
    Size: "Size",
    Point: "Point",
  },
  OpenCV: {
    base64ToMat: jest.fn((base64) => ({
      // Mock Mat object
      empty: jest.fn(() => false),
    })),
    createObject: jest.fn((type, ...args) => ({
      type,
      args,
    })),
    invoke: jest.fn((method, ...args) => {
      // Mock OpenCV method invocation
      if (method === "GaussianBlur") {
        return true;
      }
      return true;
    }),
    toJSValue: jest.fn((obj) => ({
      base64: "mock-blurred-base64-data",
    })),
    clearBuffers: jest.fn(),
  },
}));

// Mock Sentry for Jest tests
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setContext: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setExtra: jest.fn(),
  wrap: jest.fn((component) => component), // Return component as-is for testing
}));

// Mock react-native-localize
const mockGetNumberFormatSettings = jest.fn(() => ({
  decimalSeparator: ".",
  groupingSeparator: ",",
}));

jest.mock("react-native-localize", () => ({
  getNumberFormatSettings: mockGetNumberFormatSettings,
  getLocales: jest.fn(() => [
    {
      countryCode: "US",
      languageTag: "en-US",
      languageCode: "en",
      isRTL: false,
    },
  ]),
  getCurrencies: jest.fn(() => ["USD"]),
  getTimeZone: jest.fn(() => "America/New_York"),
  uses24HourClock: jest.fn(() => false),
  usesMetricSystem: jest.fn(() => false),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Export the mock function so tests can modify it
global.mockGetNumberFormatSettings = mockGetNumberFormatSettings;

// Mock helpers/getEnvConfig to avoid async initialization issues in tests
jest.mock("helpers/getEnvConfig", () => {
  const { BackendEnvironment } = jest.requireActual("config/backendConfig");

  return {
    EnvConfig: {
      AMPLITUDE_API_KEY: "mock-amplitude-key",
      AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY: "mock-experiment-key",
      SENTRY_DSN: "mock-sentry-dsn",
      WALLET_KIT_PROJECT_ID: "mock-wallet-kit-project-id",
      WALLET_KIT_MT_URL: "https://mock-wallet-kit.example.com",
      WALLET_KIT_MT_ICON: "https://mock-icon.example.com/icon.png",
      WALLET_KIT_MT_NAME: "Mock Freighter Wallet",
      WALLET_KIT_MT_DESCRIPTION: "Mock wallet description",
      WALLET_KIT_MT_REDIRECT_NATIVE: "mockfreighter://",
      ANDROID_DEBUG_KEYSTORE_PASSWORD: "mock-debug-password",
      ANDROID_DEBUG_KEYSTORE_ALIAS: "mock-debug-alias",
      ANDROID_DEV_KEYSTORE_PASSWORD: "mock-dev-password",
      ANDROID_DEV_KEYSTORE_ALIAS: "mock-dev-alias",
      ANDROID_PROD_KEYSTORE_PASSWORD: "mock-prod-password",
      ANDROID_PROD_KEYSTORE_ALIAS: "mock-prod-alias",
    },
    BackendEnvConfig: {
      FREIGHTER_BACKEND_V1_URL:
        "https://mock-backend-v1-dev.example.com/api/v1",
      FREIGHTER_BACKEND_V2_URL:
        "https://mock-backend-v2-dev.example.com/api/v1",
    },
    BackendEnvironment,
  };
});

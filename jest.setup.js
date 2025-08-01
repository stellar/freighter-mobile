/* eslint-disable @fnando/consistent-import/consistent-import */
/* eslint-disable import/extensions */
import mockClipboard from "@react-native-clipboard/clipboard/jest/clipboard-mock.js";
import mockRNDeviceInfo from "react-native-device-info/jest/react-native-device-info-mock";
import mockGestureHandler from "react-native-gesture-handler/jestSetup";

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

jest.mock("helpers/getOsLanguage", () =>
  jest.fn().mockImplementationOnce(() => "en"),
);

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
  },
}));

/* eslint-disable @fnando/consistent-import/consistent-import */
/* eslint-disable import/extensions */
import mockClipboard from "@react-native-clipboard/clipboard/jest/clipboard-mock.js";

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

// Mock react-native-responsive-screen
jest.mock("react-native-responsive-screen", () => ({
  widthPercentageToDP: jest.fn((width) => width),
  heightPercentageToDP: jest.fn((height) => height),
}));

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

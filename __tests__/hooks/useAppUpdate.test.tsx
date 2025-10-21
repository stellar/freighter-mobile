import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, waitFor } from "@testing-library/react-native";
import { logger } from "config/logger";
import { isDev } from "helpers/isEnv";
import { getDeviceLanguage } from "helpers/localeUtils";
import { useAppUpdate } from "hooks/useAppUpdate";
import { Linking } from "react-native";

// Mock the dependencies
const mockUseRemoteConfigStore = jest.fn();
const mockUseDebugStore = jest.fn();
const mockUseAppTranslation = jest.fn();
const mockUseToast = jest.fn();

jest.mock("ducks/remoteConfig", () => ({
  useRemoteConfigStore: () => mockUseRemoteConfigStore(),
}));

jest.mock("ducks/debug", () => ({
  useDebugStore: () => mockUseDebugStore(),
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => mockUseAppTranslation(),
}));

jest.mock("providers/ToastProvider", () => ({
  useToast: () => mockUseToast(),
}));

jest.mock("react-native-device-info", () => ({
  getVersion: () => "1.6.23",
  getBundleId: () => "com.freighter.mobile",
}));

jest.mock("helpers/device", () => ({
  isIOS: false,
}));

jest.mock("helpers/isEnv", () => ({
  isDev: jest.fn(() => false),
}));

jest.mock("react-native", () => ({
  Linking: {
    openURL: jest.fn(),
  },
}));

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock("helpers/localeUtils", () => ({
  getDeviceLanguage: jest.fn(() => "en"),
}));

jest.mock("i18next", () => ({
  t: jest.fn((key: string) => key),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe("useAppUpdate", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mocks
    mockUseRemoteConfigStore.mockReturnValue({
      required_app_version: "1.6.24", // Required version above current
      latest_app_version: "1.6.25",
      app_update_banner_text: {
        enabled: true,
        payload: {
          en: "Update available in English",
          pt: "Atualização disponível em Português",
        },
      },
      isInitialized: true,
    });

    mockUseDebugStore.mockReturnValue({
      overriddenAppVersion: null,
    });

    mockUseAppTranslation.mockReturnValue({
      t: (key: string) => key,
      i18n: {
        language: "en",
      },
    });

    mockUseToast.mockReturnValue({
      showToast: jest.fn(),
    });

    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
    (logger.error as jest.Mock).mockImplementation(() => {});
  });

  it("should return correct values when remote config is initialized", async () => {
    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.currentVersion).toBe("1.6.23");
    expect(result.current.requiredVersion).toBe("1.6.24");
    expect(result.current.latestVersion).toBe("1.6.25");
    expect(result.current.updateMessage).toBe("Update available in English");
    expect(result.current.showFullScreenUpdateNotice).toBe(true); // Current (1.6.23) < Required (1.6.24)

    // Wait for async storage loading to complete
    await waitFor(() => {
      expect(result.current.showBannerUpdateNotice).toBe(false); // Banner should not show when full-screen is showing
    });

    expect(typeof result.current.openAppStore).toBe("function");
  });

  it("should return fallback message when update text is disabled", () => {
    mockUseRemoteConfigStore.mockReturnValue({
      required_app_version: "1.6.23",
      latest_app_version: "1.6.24",
      app_update_banner_text: {
        enabled: false,
        payload: null,
      },
      isInitialized: true,
    });

    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.updateMessage).toBe("appUpdate.defaultMessage");
  });

  it("should return fallback message when no payload is provided", () => {
    mockUseRemoteConfigStore.mockReturnValue({
      required_app_version: "1.6.23",
      latest_app_version: "1.6.24",
      app_update_banner_text: {
        enabled: true,
        payload: null,
      },
      isInitialized: true,
    });

    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.updateMessage).toBe("appUpdate.defaultMessage");
  });

  it("should use Portuguese text when language is pt", () => {
    // Mock getDeviceLanguage to return Portuguese
    (getDeviceLanguage as jest.Mock).mockReturnValue("pt");

    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.updateMessage).toBe(
      "Atualização disponível em Português",
    );
  });

  it("should fallback to English when current language is not available", () => {
    // Mock getDeviceLanguage to return French (not available in payload)
    (getDeviceLanguage as jest.Mock).mockReturnValue("fr");

    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.updateMessage).toBe("Update available in English");
  });

  it("should not show updates when remote config is not initialized", async () => {
    mockUseRemoteConfigStore.mockReturnValue({
      required_app_version: "1.6.23",
      latest_app_version: "1.6.24",
      app_update_banner_text: {
        enabled: true,
        payload: {
          en: "Update available",
        },
      },
      isInitialized: false,
    });

    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.showFullScreenUpdateNotice).toBe(false);

    await waitFor(() => {
      expect(result.current.showBannerUpdateNotice).toBe(false);
    });
  });

  it("should trigger forced update when current version is below required", async () => {
    // Test forced update when current version is below required version
    // Current: 1.6.23, Required: 1.6.24 - should trigger forced update
    mockUseRemoteConfigStore.mockReturnValue({
      required_app_version: "1.6.24", // Required version above current
      latest_app_version: "1.6.25",
      app_update_banner_text: {
        enabled: true,
        payload: {
          en: "Required version update",
        },
      },
      isInitialized: true,
    });

    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.currentVersion).toBe("1.6.23");
    expect(result.current.requiredVersion).toBe("1.6.24");
    expect(result.current.latestVersion).toBe("1.6.25");
    expect(result.current.showFullScreenUpdateNotice).toBe(true); // Current (1.6.23) < Required (1.6.24)

    await waitFor(() => {
      expect(result.current.showBannerUpdateNotice).toBe(false); // Forced update takes precedence
    });

    expect(result.current.updateMessage).toBe("Required version update");
  });

  it("should not trigger update when versions are the same", async () => {
    // Test that no update is triggered when current and latest versions are the same
    // Current: 1.6.23, Latest: 1.6.23 - should not trigger update
    mockUseRemoteConfigStore.mockReturnValue({
      required_app_version: "1.6.23",
      latest_app_version: "1.6.23",
      app_update_banner_text: {
        enabled: true,
        payload: {
          en: "No update needed",
        },
      },
      isInitialized: true,
    });

    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.currentVersion).toBe("1.6.23");
    expect(result.current.latestVersion).toBe("1.6.23");
    expect(result.current.showFullScreenUpdateNotice).toBe(false); // Same versions - no update needed

    await waitFor(() => {
      expect(result.current.showBannerUpdateNotice).toBe(false);
    });
  });

  it("should trigger forced update when current version is below required", async () => {
    // Test forced update when current version is below required version
    // Current: 1.6.23, Required: 1.7.0, Latest: 1.7.24 - should trigger forced update
    mockUseRemoteConfigStore.mockReturnValue({
      required_app_version: "1.7.0", // Required version above current
      latest_app_version: "1.7.24",
      app_update_banner_text: {
        enabled: true,
        payload: {
          en: "Required version update",
        },
      },
      isInitialized: true,
    });

    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.currentVersion).toBe("1.6.23");
    expect(result.current.requiredVersion).toBe("1.7.0");
    expect(result.current.latestVersion).toBe("1.7.24");
    expect(result.current.showFullScreenUpdateNotice).toBe(true); // Current (1.6.23) < Required (1.7.0)

    await waitFor(() => {
      expect(result.current.showBannerUpdateNotice).toBe(false); // Forced update takes precedence
    });

    expect(result.current.updateMessage).toBe("Required version update");
  });

  it("should trigger forced update when current is below required and required equals latest", async () => {
    // Test forced update when current version is below required and required equals latest
    // Current: 1.6.23, Required: 1.6.24, Latest: 1.6.24 - should trigger forced update
    mockUseRemoteConfigStore.mockReturnValue({
      required_app_version: "1.6.24", // Required version above current
      latest_app_version: "1.6.24", // Same as required
      app_update_banner_text: {
        enabled: true,
        payload: {
          en: "Forced update required",
        },
      },
      isInitialized: true,
    });

    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.currentVersion).toBe("1.6.23");
    expect(result.current.requiredVersion).toBe("1.6.24");
    expect(result.current.latestVersion).toBe("1.6.24");
    expect(result.current.showFullScreenUpdateNotice).toBe(true); // Current (1.6.23) < Required (1.6.24)

    await waitFor(() => {
      expect(result.current.showBannerUpdateNotice).toBe(false); // Forced update takes precedence
    });

    expect(result.current.updateMessage).toBe("Forced update required");
  });

  it("should not trigger any update when current is above required and same protocol as latest", async () => {
    // Test no update when current version is above required and same protocol as latest
    // Current: 1.6.23, Required: 1.5.0, Latest: 1.6.23 - should not trigger any update
    mockUseRemoteConfigStore.mockReturnValue({
      required_app_version: "1.5.0", // Required version below current
      latest_app_version: "1.6.23", // Same protocol (23 vs 23) - no forced update
      app_update_banner_text: {
        enabled: true,
        payload: {
          en: "No update needed",
        },
      },
      isInitialized: true,
    });

    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.currentVersion).toBe("1.6.23");
    expect(result.current.requiredVersion).toBe("1.5.0");
    expect(result.current.latestVersion).toBe("1.6.23");
    expect(result.current.showFullScreenUpdateNotice).toBe(false); // current >= required

    await waitFor(() => {
      expect(result.current.showBannerUpdateNotice).toBe(false); // Same versions - no update needed
    });

    expect(result.current.updateMessage).toBe("No update needed");
  });

  it("should use overridden version in dev mode", () => {
    mockUseDebugStore.mockReturnValue({
      overriddenAppVersion: "1.6.20",
    });

    // Mock isDev to return true for this test
    (isDev as unknown as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useAppUpdate());

    expect(result.current.currentVersion).toBe("1.6.20");
  });

  it("should call openAppStore correctly", async () => {
    const { result } = renderHook(() => useAppUpdate());

    await result.current.openAppStore();

    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://play.google.com/store/apps/details?id=com.freighter.mobile",
    );
  });

  it("should handle openAppStore errors", async () => {
    const mockShowToast = jest.fn();
    mockUseToast.mockReturnValue({
      showToast: mockShowToast,
    });

    const error = new Error("Failed to open URL");
    (Linking.openURL as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useAppUpdate());

    await result.current.openAppStore();

    expect(logger.error).toHaveBeenCalledWith(
      "useAppUpdate",
      "Failed to open app store",
      error,
    );
    expect(mockShowToast).toHaveBeenCalledWith({
      variant: "error",
      title: "common.error",
      duration: 3000,
    });
  });

  it("should not show full-screen update when current version was dismissed", async () => {
    // Mock AsyncStorage to return the current version as dismissed
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("1.6.23"); // Current version

    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(result.current.showFullScreenUpdateNotice).toBe(false);
    });
  });

  it("should show full-screen update when different version was dismissed", async () => {
    // Mock AsyncStorage to return a different version as dismissed
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("1.6.22"); // Different version

    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(result.current.showFullScreenUpdateNotice).toBe(true);
    });
  });

  it("should store current version when dismissing full-screen update", async () => {
    const mockSetItem = AsyncStorage.setItem as jest.Mock;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(result.current.showFullScreenUpdateNotice).toBe(true);
    });

    await result.current.dismissFullScreenNotice();

    expect(mockSetItem).toHaveBeenCalledWith(
      "appUpdateDismissedRequiredVersion",
      "1.6.23", // Current version should be stored
    );
  });
});

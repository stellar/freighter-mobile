/* eslint-disable @fnando/consistent-import/consistent-import */
import { act, renderHook } from "@testing-library/react-hooks";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { getExperimentClient } from "services/analytics/core";

import { createMockExperimentClient } from "../../__mocks__/experimentClient";

jest.mock("services/analytics/core", () => ({
  getExperimentClient: jest.fn(),
  isInitialized: jest.fn(() => false),
  setAnalyticsEnabled: jest.fn(),
  getAnalyticsEnabled: jest.fn(() => false),
}));

jest.mock("config/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("helpers/device", () => ({
  isAndroid: false,
  isIOS: true,
}));

jest.mock("helpers/version", () => ({
  getAppVersion: jest.fn(() => "1.0.0"),
  getBuildNumber: jest.fn(() => "1"),
}));

jest.mock("react-native-device-info", () => ({
  getBundleId: jest.fn(() => "org.bundleid.test"),
  getVersion: jest.fn(() => "1.0.0"),
}));

const mockGetExperimentClient = getExperimentClient as jest.MockedFunction<
  typeof getExperimentClient
>;

describe("remoteConfig duck", () => {
  beforeEach(() => {
    act(() => {
      useRemoteConfigStore.setState({
        swap_enabled: false,
        discover_enabled: false,
        onramp_enabled: false,
        required_app_version: "0.0.0",
        latest_app_version: "1.0.0",
        app_update_banner_text: {
          enabled: false,
          payload: undefined,
        },
      });
    });

    jest.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() => useRemoteConfigStore());

      expect(result.current.swap_enabled).toBe(false);
      expect(result.current.discover_enabled).toBe(false);
      expect(result.current.onramp_enabled).toBe(false);
      expect(result.current.required_app_version).toBe("0.0.0");
      expect(result.current.latest_app_version).toBe("1.0.0");
      expect(result.current.app_update_banner_text).toEqual({
        enabled: false,
        payload: undefined,
      });
      expect(typeof result.current.fetchFeatureFlags).toBe("function");
      expect(typeof result.current.initFetchFeatureFlagsPoll).toBe("function");
    });
  });

  describe("fetchFeatureFlags", () => {
    it("should skip fetch when experiment client is not initialized", async () => {
      mockGetExperimentClient.mockReturnValue(null);

      const { result } = renderHook(() => useRemoteConfigStore());

      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      // State should remain unchanged
      expect(result.current.swap_enabled).toBe(false);
      expect(result.current.discover_enabled).toBe(false);
      expect(result.current.onramp_enabled).toBe(false);
    });

    it("should fetch with correct user properties", async () => {
      const mockClient = createMockExperimentClient();
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      expect(mockGetExperimentClient).toHaveBeenCalled();
      expect(mockClient.fetch).toHaveBeenCalledWith({
        user_properties: {
          "Bundle Id": "org.bundleid.test",
        },
      });
    });

    it("should update state when variant values are 'on'", async () => {
      const mockClient = createMockExperimentClient();
      mockClient.all.mockReturnValue({
        swap_enabled: { value: "on" },
        discover_enabled: { value: "on" },
        onramp_enabled: { value: "on" },
      });
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      expect(result.current.swap_enabled).toBe(true);
      expect(result.current.discover_enabled).toBe(true);
      expect(result.current.onramp_enabled).toBe(true);
    });

    it("should update state when variant values are 'off'", async () => {
      // First set all flags to true
      act(() => {
        useRemoteConfigStore.setState({
          swap_enabled: true,
          discover_enabled: true,
          onramp_enabled: true,
        });
      });

      const mockClient = createMockExperimentClient();
      mockClient.all.mockReturnValue({
        swap_enabled: { value: "off" },
        discover_enabled: { value: "off" },
        onramp_enabled: { value: "off" },
      });
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      expect(result.current.swap_enabled).toBe(false);
      expect(result.current.discover_enabled).toBe(false);
      expect(result.current.onramp_enabled).toBe(false);
    });

    it("should update only specific flags when variants are returned", async () => {
      const mockClient = createMockExperimentClient();
      mockClient.all.mockReturnValue({
        swap_enabled: { value: "on" },
        discover_enabled: { value: undefined },
        onramp_enabled: { value: undefined },
      });
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      expect(result.current.swap_enabled).toBe(true);
      expect(result.current.discover_enabled).toBe(false);
      expect(result.current.onramp_enabled).toBe(false);
    });

    it("should not update state when variants return undefined", async () => {
      const mockClient = createMockExperimentClient();
      mockClient.all.mockReturnValue({
        swap_enabled: { value: undefined },
        discover_enabled: { value: undefined },
        onramp_enabled: { value: undefined },
      });
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      // State should remain unchanged
      expect(result.current.swap_enabled).toBe(false);
      expect(result.current.discover_enabled).toBe(false);
      expect(result.current.onramp_enabled).toBe(false);
    });

    it("should handle fetch errors gracefully", async () => {
      const mockClient = createMockExperimentClient();
      mockClient.fetch.mockRejectedValue(new Error("Network error"));
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      // Should not throw
      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      // State should remain unchanged
      expect(result.current.swap_enabled).toBe(false);
      expect(result.current.discover_enabled).toBe(false);
      expect(result.current.onramp_enabled).toBe(false);
    });

    it("should handle variant errors gracefully", async () => {
      const mockClient = createMockExperimentClient();
      mockClient.all.mockImplementation(() => {
        throw new Error("Variant error");
      });
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      // Should not throw
      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      // State should remain unchanged
      expect(result.current.swap_enabled).toBe(false);
      expect(result.current.discover_enabled).toBe(false);
      expect(result.current.onramp_enabled).toBe(false);
    });

    it("should handle mixed variant responses", async () => {
      const mockClient = createMockExperimentClient();
      mockClient.all.mockReturnValue({
        swap_enabled: { value: "on" },
        discover_enabled: { value: undefined },
        onramp_enabled: { value: "off" },
      });
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      expect(result.current.swap_enabled).toBe(true);
      expect(result.current.discover_enabled).toBe(false);
      expect(result.current.onramp_enabled).toBe(false);
    });

    it("should preserve existing state when no updates are returned", async () => {
      // Set initial state
      act(() => {
        useRemoteConfigStore.setState({
          swap_enabled: true,
          discover_enabled: false,
          onramp_enabled: true,
        });
      });

      const mockClient = createMockExperimentClient();
      mockClient.all.mockReturnValue({
        swap_enabled: { value: undefined },
        discover_enabled: { value: undefined },
        onramp_enabled: { value: undefined },
      });
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      // State should remain as it was
      expect(result.current.swap_enabled).toBe(true);
      expect(result.current.discover_enabled).toBe(false);
      expect(result.current.onramp_enabled).toBe(true);
    });

    it("should handle string flags correctly", async () => {
      const mockClient = createMockExperimentClient();
      mockClient.all.mockReturnValue({
        required_app_version: { value: "1_2_3" },
        latest_app_version: { value: "2_0_0" },
      });
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      expect(result.current.required_app_version).toBe("1.2.3");
      expect(result.current.latest_app_version).toBe("2.0.0");
    });

    it("should handle complex flags correctly", async () => {
      const mockClient = createMockExperimentClient();
      mockClient.all.mockReturnValue({
        app_update_banner_text: {
          value: "on",
          payload: { en: "Update available", pt: "Atualização disponível" },
        },
      });
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      expect(result.current.app_update_banner_text).toEqual({
        enabled: true,
        payload: { en: "Update available", pt: "Atualização disponível" },
      });
    });

    it("should handle complex flags when disabled", async () => {
      const mockClient = createMockExperimentClient();
      mockClient.all.mockReturnValue({
        app_update_banner_text: {
          value: "off",
          payload: { en: "Update available", pt: "Atualização disponível" },
        },
      });
      mockGetExperimentClient.mockReturnValue(mockClient);

      const { result } = renderHook(() => useRemoteConfigStore());

      await act(async () => {
        await result.current.fetchFeatureFlags();
      });

      expect(result.current.app_update_banner_text).toEqual({
        enabled: false,
        payload: undefined,
      });
    });
  });
});

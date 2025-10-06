/* eslint-disable @fnando/consistent-import/consistent-import */
import { act, renderHook } from "@testing-library/react-hooks";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { Platform } from "react-native";
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
          platform: Platform.OS,
          version: "1.0.0",
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
  });
});

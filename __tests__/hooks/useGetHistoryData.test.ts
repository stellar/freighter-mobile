import { renderHook, waitFor, act } from "@testing-library/react-native";
import { PUBLIC_NETWORK_DETAILS } from "config/constants";
import { useGetHistoryData } from "hooks/useGetHistoryData";

jest.mock("services/backend");
jest.mock("ducks/balances", () => ({
  useBalancesStore: () => ({
    fetchAccountBalances: jest.fn(),
    getBalances: jest.fn(() => ({})),
  }),
}));

// Mock the history store with a mock implementation
const mockFetchAccountHistory = jest.fn().mockResolvedValue(undefined);
const mockStartPolling = jest.fn();
const mockStopPolling = jest.fn();
const mockClearRefreshAfterNavigation = jest.fn();

jest.mock("ducks/history", () => ({
  useHistoryStore: () => ({
    rawHistoryData: null,
    isLoading: false,
    error: null,
    shouldRefreshAfterNavigation: false,
    fetchAccountHistory: mockFetchAccountHistory,
    getFilteredHistoryData: jest.fn(() => null),
    startPolling: mockStartPolling,
    stopPolling: mockStopPolling,
    clearRefreshAfterNavigation: mockClearRefreshAfterNavigation,
  }),
}));

describe("useGetHistoryData - Hide create claimable balance spam", () => {
  const mockPublicKey =
    "GCKUVXILBNYS4FDNWCGCYSJBY2PBQ4KAW2M5CODRVJPUFM62IJFH67J2";

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchAccountHistory.mockClear();
    mockStartPolling.mockClear();
    mockStopPolling.mockClear();
    mockClearRefreshAfterNavigation.mockClear();
  });

  it("should call fetchAccountHistory with correct parameters", async () => {
    const { result } = renderHook(() =>
      useGetHistoryData({
        publicKey: mockPublicKey,
        networkDetails: PUBLIC_NETWORK_DETAILS,
        tokenId: undefined,
      }),
    );

    await act(async () => {
      await result.current.fetchData({ isRefresh: false });
    });

    expect(mockFetchAccountHistory).toHaveBeenCalledWith({
      publicKey: mockPublicKey,
      network: PUBLIC_NETWORK_DETAILS.network,
    });
  });

  // Polling is now handled centrally in TabNavigator, so these tests are no longer relevant

  it("should call fetchAccountHistory with tokenId when provided", async () => {
    const tokenId = "test-token-id";

    const { result } = renderHook(() =>
      useGetHistoryData({
        publicKey: mockPublicKey,
        networkDetails: PUBLIC_NETWORK_DETAILS,
        tokenId,
      }),
    );

    await act(async () => {
      await result.current.fetchData({ isRefresh: false });
    });

    expect(mockFetchAccountHistory).toHaveBeenCalledWith({
      publicKey: mockPublicKey,
      network: PUBLIC_NETWORK_DETAILS.network,
    });
  });

  // Polling is now handled centrally in TabNavigator, so this test is no longer relevant

  it("should handle background refresh correctly", async () => {
    const { result } = renderHook(() =>
      useGetHistoryData({
        publicKey: mockPublicKey,
        networkDetails: PUBLIC_NETWORK_DETAILS,
        tokenId: undefined,
      }),
    );

    // Test that fetchData can be called with isBackgroundRefresh
    await act(async () => {
      await result.current.fetchData({
        isRefresh: true,
        isBackgroundRefresh: true,
      });
    });

    expect(mockFetchAccountHistory).toHaveBeenCalledWith({
      publicKey: mockPublicKey,
      network: PUBLIC_NETWORK_DETAILS.network,
      isBackgroundRefresh: true,
    });
  });

  it("should handle refresh without background flag", async () => {
    const { result } = renderHook(() =>
      useGetHistoryData({
        publicKey: mockPublicKey,
        networkDetails: PUBLIC_NETWORK_DETAILS,
        tokenId: undefined,
      }),
    );

    await act(async () => {
      await result.current.fetchData({ isRefresh: true });
    });

    expect(mockFetchAccountHistory).toHaveBeenCalledWith({
      publicKey: mockPublicKey,
      network: PUBLIC_NETWORK_DETAILS.network,
      isBackgroundRefresh: false,
    });
  });

  it("should return correct loading states", async () => {
    const { result } = renderHook(() =>
      useGetHistoryData({
        publicKey: mockPublicKey,
        networkDetails: PUBLIC_NETWORK_DETAILS,
        tokenId: undefined,
      }),
    );

    // Wait for the initial mount to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.isNavigationRefresh).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.historyData).toBe(null);
  });

  it("should handle fetchData with different parameter combinations", async () => {
    const { result } = renderHook(() =>
      useGetHistoryData({
        publicKey: mockPublicKey,
        networkDetails: PUBLIC_NETWORK_DETAILS,
        tokenId: undefined,
      }),
    );

    // Test fetchData with no parameters
    await act(async () => {
      await result.current.fetchData();
    });

    expect(mockFetchAccountHistory).toHaveBeenCalledWith({
      publicKey: mockPublicKey,
      network: PUBLIC_NETWORK_DETAILS.network,
      isBackgroundRefresh: false,
    });

    // Test fetchData with only isRefresh
    await act(async () => {
      await result.current.fetchData({ isRefresh: true });
    });

    expect(mockFetchAccountHistory).toHaveBeenCalledWith({
      publicKey: mockPublicKey,
      network: PUBLIC_NETWORK_DETAILS.network,
      isBackgroundRefresh: false,
    });
  });
});

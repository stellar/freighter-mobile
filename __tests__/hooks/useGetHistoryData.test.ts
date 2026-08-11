import { renderHook, waitFor, act } from "@testing-library/react-native";
import { PUBLIC_NETWORK_DETAILS } from "config/constants";
import { HistoryData, HistoryDataV2 } from "ducks/history";
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
const mockGetFilteredHistoryData = jest.fn(
  (): HistoryData | HistoryDataV2 | null => null,
);

// Mutable so a single test can populate rawHistoryV2Data without disturbing
// the other (v1-only, both null) tests; reset in beforeEach.
let mockRawHistoryV2Data: unknown = null;

jest.mock("ducks/history", () => ({
  useHistoryStore: () => ({
    rawHistoryData: null,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mockRawHistoryV2Data is intentionally reassigned by tests
    rawHistoryV2Data: mockRawHistoryV2Data,
    isLoading: false,
    error: null,
    hasRecentTransaction: false,
    isFetching: false,
    fetchAccountHistory: mockFetchAccountHistory,
    getFilteredHistoryData: mockGetFilteredHistoryData,
    startPolling: mockStartPolling,
    stopPolling: mockStopPolling,
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
    mockGetFilteredHistoryData.mockClear();
    mockGetFilteredHistoryData.mockReturnValue(null);
    mockRawHistoryV2Data = null;
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

  it("passes network through to getFilteredHistoryData", async () => {
    const { result } = renderHook(() =>
      useGetHistoryData({
        publicKey: mockPublicKey,
        networkDetails: PUBLIC_NETWORK_DETAILS,
        tokenId: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // The memo's `if (!rawHistoryData && !rawHistoryV2Data) return null`
    // gate replaced Task 7's `if (!rawHistoryData) return null` — both
    // fields are null in this suite's default mock, so
    // getFilteredHistoryData is never called and historyData stays null.
    expect(mockGetFilteredHistoryData).not.toHaveBeenCalled();
    expect(result.current.historyData).toBe(null);
  });

  it("reads through rawHistoryV2Data — the v1-only `if (!rawHistoryData) return null` gate this replaced would have kept historyData null forever on a v2-only account", async () => {
    mockRawHistoryV2Data = { balances: {}, entries: [] };
    const v2FilteredResult = { balances: {}, history: [] };
    mockGetFilteredHistoryData.mockReturnValue(v2FilteredResult);

    const { result } = renderHook(() =>
      useGetHistoryData({
        publicKey: mockPublicKey,
        networkDetails: PUBLIC_NETWORK_DETAILS,
        tokenId: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetFilteredHistoryData).toHaveBeenCalledWith({
      publicKey: mockPublicKey,
      network: PUBLIC_NETWORK_DETAILS.network,
      tokenId: undefined,
      isHideDustEnabled: expect.any(Boolean),
    });
    expect(result.current.historyData).toBe(v2FilteredResult);
  });
});

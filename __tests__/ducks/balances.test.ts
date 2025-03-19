import { AssetType } from "@stellar/stellar-sdk";
import { act, renderHook } from "@testing-library/react-hooks";
import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import { NativeBalance, ClassicBalance, TokenPricesMap } from "config/types";
import { useBalancesStore } from "ducks/balances";
import { usePricesStore } from "ducks/prices";
import { fetchBalances } from "services/backend";

// Mock the fetchBalances service and usePricesStore
jest.mock("services/backend", () => ({
  fetchBalances: jest.fn(),
}));

jest.mock("ducks/prices", () => ({
  usePricesStore: {
    getState: jest.fn().mockReturnValue({
      fetchPricesForBalances: jest.fn(),
      prices: {},
      error: null,
      isLoading: false,
      lastUpdated: null,
    }),
  },
}));

describe("balances duck", () => {
  const mockFetchBalances = fetchBalances as jest.MockedFunction<
    typeof fetchBalances
  >;

  // Helper function to create a mock prices store state
  const createMockPricesStore = (
    overrides: Partial<{
      fetchPricesForBalances: jest.Mock;
      prices: TokenPricesMap;
      error: string | null;
      isLoading: boolean;
      lastUpdated: number | null;
    }> = {},
  ) => ({
    fetchPricesForBalances: jest.fn().mockResolvedValue(undefined),
    prices: {},
    error: null,
    isLoading: false,
    lastUpdated: null,
    ...overrides,
  });

  // Mock data
  const mockNativeBalance: NativeBalance = {
    token: {
      code: "XLM",
      type: "native" as const, // Fix the type issue
    },
    total: new BigNumber("100.5"),
    available: new BigNumber("100.5"),
    minimumBalance: new BigNumber("1"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
  };

  const mockAssetBalance: ClassicBalance = {
    token: {
      code: "USDC",
      issuer: {
        key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      },
      type: "credit_alphanum4" as AssetType,
    },
    total: new BigNumber("200"),
    available: new BigNumber("200"),
    limit: new BigNumber("1000"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
  };

  const mockBalances = {
    XLM: mockNativeBalance,
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":
      mockAssetBalance,
  };

  const mockPrices = {
    XLM: {
      currentPrice: new BigNumber("0.5"),
      percentagePriceChange24h: new BigNumber("0.02"),
    },
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN": {
      currentPrice: new BigNumber("1"),
      percentagePriceChange24h: new BigNumber("-0.01"),
    },
  };

  const mockParams = {
    publicKey: "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM",
    network: NETWORKS.TESTNET,
  };

  beforeEach(() => {
    // Reset the store before each test
    act(() => {
      useBalancesStore.setState({
        balances: {},
        pricedBalances: {},
        isLoading: false,
        error: null,
      });
    });

    // Reset the mocks
    mockFetchBalances.mockReset();
    (usePricesStore.getState as jest.Mock).mockReset();
  });

  describe("store state", () => {
    it("should have correct state values", () => {
      act(() => {
        useBalancesStore.setState({
          balances: mockBalances,
          pricedBalances: {},
          isLoading: true,
          error: "Test error",
        });
      });

      const { result } = renderHook(() => useBalancesStore());

      expect(result.current.balances).toEqual(mockBalances);
      expect(result.current.pricedBalances).toEqual({});
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe("Test error");
    });

    it("should have fetchAccountBalances function", async () => {
      const { result } = renderHook(() => useBalancesStore());

      expect(typeof result.current.fetchAccountBalances).toBe("function");

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(mockFetchBalances).toHaveBeenCalledWith(mockParams);
    });
  });

  describe("fetchAccountBalances", () => {
    it("should update isLoading state when fetching begins", async () => {
      mockFetchBalances.mockResolvedValueOnce({ balances: mockBalances });
      (usePricesStore.getState as jest.Mock).mockReturnValue(
        createMockPricesStore(),
      );

      const { result } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(mockFetchBalances).toHaveBeenCalledWith(mockParams);
    });

    it("should update balances and pricedBalances state on successful fetch", async () => {
      mockFetchBalances.mockResolvedValueOnce({ balances: mockBalances });
      (usePricesStore.getState as jest.Mock).mockReturnValue(
        createMockPricesStore({ prices: mockPrices }),
      );

      const { result } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(result.current.balances).toEqual(mockBalances);
      expect(result.current.pricedBalances).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch with contractIds", async () => {
      mockFetchBalances.mockResolvedValueOnce({ balances: mockBalances });
      (usePricesStore.getState as jest.Mock).mockReturnValue({
        fetchPricesForBalances: jest.fn().mockResolvedValue(undefined),
        prices: {},
        error: null,
        isLoading: false,
        lastUpdated: null,
      });

      const { result } = renderHook(() => useBalancesStore());
      const paramsWithContractIds = {
        ...mockParams,
        contractIds: ["contract1", "contract2"],
      };

      await act(async () => {
        await result.current.fetchAccountBalances(paramsWithContractIds);
      });

      expect(result.current.balances).toEqual(mockBalances);
      expect(mockFetchBalances).toHaveBeenCalledWith(paramsWithContractIds);
    });

    it("should handle empty balances response", async () => {
      mockFetchBalances.mockResolvedValueOnce({ balances: {} });
      (usePricesStore.getState as jest.Mock).mockReturnValue({
        fetchPricesForBalances: jest.fn().mockResolvedValue(undefined),
        prices: {},
        error: null,
        isLoading: false,
        lastUpdated: null,
      });

      const { result } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(result.current.balances).toEqual({});
      expect(result.current.pricedBalances).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should update error state when fetch fails with Error instance", async () => {
      const errorMessage = "Network error";
      mockFetchBalances.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(result.current.balances).toEqual({});
      expect(result.current.pricedBalances).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });

    it("should update error state when fetch fails with non-Error", async () => {
      mockFetchBalances.mockRejectedValueOnce("Some non-error rejection");

      const { result } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(result.current.balances).toEqual({});
      expect(result.current.pricedBalances).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("Failed to fetch balances");
    });

    it("should handle price fetch errors gracefully", async () => {
      mockFetchBalances.mockResolvedValueOnce({ balances: mockBalances });

      // Mock the prices store to simulate a failed token prices fetch
      (usePricesStore.getState as jest.Mock).mockReturnValue(
        createMockPricesStore({
          prices: {},
          error: "Failed to fetch token prices",
          isLoading: false,
          lastUpdated: null,
        }),
      );

      const { result } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      // Should still have balances even if price fetch failed
      expect(result.current.balances).toEqual(mockBalances);
      expect(result.current.pricedBalances).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Additional assertions for price fetch error case
      expect(result.current.pricedBalances.XLM).toBeDefined();
      expect(result.current.pricedBalances.XLM.currentPrice).toBeUndefined();
      expect(
        result.current.pricedBalances.XLM.percentagePriceChange24h,
      ).toBeUndefined();
    });
  });
});

import { act, renderHook } from "@testing-library/react-hooks";
import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import {
  Balance,
  NativeBalance,
  ClassicBalance,
  TokenPricesMap,
  TokenTypeWithCustomToken,
} from "config/types";
import { usePricesStore } from "ducks/prices";
import * as balancesHelpers from "helpers/balances";
import { fetchTokenPrices } from "services/backend";

// Mock the getTokenIdentifiersFromBalances helper and fetchTokenPrices service
jest.mock("helpers/balances", () => ({
  getTokenIdentifiersFromBalances: jest.fn(),
}));

jest.mock("services/backend", () => ({
  fetchTokenPrices: jest.fn(),
}));

// The store reads the use_token_prices_v2 flag to decide v1 vs v2. Default it
// to true (v2) for these tests; the value is forwarded to fetchTokenPrices.
jest.mock("ducks/remoteConfig", () => ({
  useRemoteConfigStore: {
    getState: () => ({ use_token_prices_v2: true }),
  },
}));

describe("prices duck", () => {
  const mockGetTokenIdentifiersFromBalances =
    balancesHelpers.getTokenIdentifiersFromBalances as jest.MockedFunction<
      typeof balancesHelpers.getTokenIdentifiersFromBalances
    >;
  const mockFetchTokenPrices = fetchTokenPrices as jest.MockedFunction<
    typeof fetchTokenPrices
  >;

  // Helper function to create mock balances
  const createMockBalances = () => {
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

    const mockTokenBalance: ClassicBalance = {
      token: {
        code: "USDC",
        issuer: {
          key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM12,
      },
      total: new BigNumber("200"),
      available: new BigNumber("200"),
      limit: new BigNumber("1000"),
      buyingLiabilities: "0",
      sellingLiabilities: "0",
    };

    // Define type to satisfy the linter
    type MockBalanceRecord = Record<string, Balance> & {
      native: NativeBalance;
    };

    return {
      mockNativeBalance,
      mockTokenBalance,
      mockBalances: {
        native: mockNativeBalance,
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":
          mockTokenBalance,
      } as MockBalanceRecord,
    };
  };

  // Helper function to create mock prices
  const createMockPrices = () => ({
    XLM: {
      currentPrice: new BigNumber("0.5"),
      percentagePriceChange24h: new BigNumber("0.02"),
    },
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN": {
      currentPrice: new BigNumber("1"),
      percentagePriceChange24h: new BigNumber("-0.01"),
    },
  });

  const { mockBalances } = createMockBalances();
  const mockPrices = createMockPrices();

  // Mock token identifiers
  const mockTokenIdentifiers = [
    "XLM",
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  ];

  const mockParams = {
    balances: mockBalances,
    publicKey: "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM",
    network: NETWORKS.TESTNET,
  };

  beforeEach(() => {
    // Reset the store before each test
    act(() => {
      usePricesStore.setState({
        prices: {},
        pricesNetwork: null,
        isLoading: false,
        error: null,
        lastUpdated: null,
      });
    });

    // Reset the mocks
    mockGetTokenIdentifiersFromBalances.mockReset();
    mockFetchTokenPrices.mockReset();

    // Setup default mock returns
    mockGetTokenIdentifiersFromBalances.mockReturnValue(mockTokenIdentifiers);
    mockFetchTokenPrices.mockResolvedValue(mockPrices);
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() => usePricesStore());

      expect(result.current.prices).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastUpdated).toBeNull();
    });
  });

  describe("fetchPricesForBalances", () => {
    it("should update isLoading state when fetching begins", async () => {
      const { result } = renderHook(() => usePricesStore());

      await act(async () => {
        await result.current.fetchPricesForBalances(mockParams);
      });

      expect(mockGetTokenIdentifiersFromBalances).toHaveBeenCalledWith(
        mockBalances,
      );
      expect(mockFetchTokenPrices).toHaveBeenCalledWith({
        tokens: mockTokenIdentifiers,
        network: NETWORKS.TESTNET,
        useV2: true,
      });
    });

    it("should update prices state on successful fetch", async () => {
      const { result } = renderHook(() => usePricesStore());

      await act(async () => {
        await result.current.fetchPricesForBalances(mockParams);
      });

      expect(result.current.prices).toEqual(mockPrices);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastUpdated).not.toBeNull();
      expect(typeof result.current.lastUpdated).toBe("number");
    });

    it("should merge with existing prices (preserves non-balance entries)", async () => {
      const { result } = renderHook(() => usePricesStore());

      // Pre-seed the store with a price for a non-balance token (e.g., a
      // trending token previously loaded via fetchPricesForTokenIds), already
      // on the same network the fetch will use so it merges (not cleared).
      act(() => {
        usePricesStore.setState({
          prices: {
            "AQUA:GBN...": {
              currentPrice: new BigNumber("0.003"),
              percentagePriceChange24h: new BigNumber("1.2"),
            },
          },
          pricesNetwork: NETWORKS.TESTNET,
        });
      });

      // Now fetch balance prices — these are different tokens.
      await act(async () => {
        await result.current.fetchPricesForBalances(mockParams);
      });

      // Both pre-seeded and freshly-fetched prices should be present.
      expect(result.current.prices["AQUA:GBN..."]).toBeDefined();
      expect(result.current.prices.XLM).toBeDefined();
    });

    it("drops prices from a different network before fetching", async () => {
      const { result } = renderHook(() => usePricesStore());

      // A non-held price cached for PUBLIC; the fetch below is for TESTNET.
      act(() => {
        usePricesStore.setState({
          prices: {
            "AQUA:GBN...": {
              currentPrice: new BigNumber("0.003"),
              percentagePriceChange24h: new BigNumber("1.2"),
            },
          },
          pricesNetwork: NETWORKS.PUBLIC,
        });
      });

      await act(async () => {
        await result.current.fetchPricesForBalances(mockParams); // TESTNET
      });

      // Stale PUBLIC price is gone; only the freshly-fetched TESTNET prices remain.
      expect(result.current.prices["AQUA:GBN..."]).toBeUndefined();
      expect(result.current.prices.XLM).toBeDefined();
      expect(result.current.pricesNetwork).toBe(NETWORKS.TESTNET);
    });

    it("discards an in-flight response when the network changed mid-fetch", async () => {
      const { result } = renderHook(() => usePricesStore());

      // Hold the fetch open so we can switch networks before it resolves.
      let resolveFetch: (value: typeof mockPrices) => void = () => {};
      mockFetchTokenPrices.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );

      let pending: Promise<void> = Promise.resolve();
      act(() => {
        pending = result.current.fetchPricesForBalances(mockParams); // TESTNET
      });

      // The user switches networks while the TESTNET fetch is still in flight.
      act(() => {
        usePricesStore.setState({ pricesNetwork: NETWORKS.PUBLIC });
      });

      await act(async () => {
        resolveFetch(mockPrices);
        await pending;
      });

      // The stale TESTNET response must not be merged into the PUBLIC cache.
      expect(result.current.prices).toEqual({});
    });

    it("should handle empty token list", async () => {
      mockGetTokenIdentifiersFromBalances.mockReturnValueOnce([]);

      const { result } = renderHook(() => usePricesStore());

      await act(async () => {
        await result.current.fetchPricesForBalances(mockParams);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.lastUpdated).not.toBeNull();
      expect(mockFetchTokenPrices).not.toHaveBeenCalled();
    });

    describe("error handling", () => {
      it("should update error state when fetch fails with Error instance", async () => {
        const errorMessage = "Network error";
        mockFetchTokenPrices.mockRejectedValueOnce(new Error(errorMessage));

        const { result } = renderHook(() => usePricesStore());

        await act(async () => {
          await result.current.fetchPricesForBalances(mockParams);
        });

        expect(result.current.prices).toEqual({});
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe(errorMessage);
        expect(result.current.lastUpdated).toBeNull();
      });

      it("should update error state when fetch fails with non-Error", async () => {
        mockFetchTokenPrices.mockRejectedValueOnce("Some non-error rejection");

        const { result } = renderHook(() => usePricesStore());

        await act(async () => {
          await result.current.fetchPricesForBalances(mockParams);
        });

        expect(result.current.prices).toEqual({});
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe("Failed to fetch token prices");
        expect(result.current.lastUpdated).toBeNull();
      });

      it("should preserve existing prices when fetch fails", async () => {
        // First set some prices, already on the network the fetch will use so a
        // transient failure preserves them (rather than the network-change clear).
        const mockLastUpdated = Date.now();
        act(() => {
          usePricesStore.setState({
            prices: mockPrices,
            pricesNetwork: NETWORKS.TESTNET,
            isLoading: false,
            error: null,
            lastUpdated: mockLastUpdated,
          });
        });

        // Then simulate a failed fetch
        mockFetchTokenPrices.mockRejectedValueOnce(new Error("Network error"));

        const { result } = renderHook(() => usePricesStore());

        await act(async () => {
          await result.current.fetchPricesForBalances(mockParams);
        });

        expect(result.current.prices).toEqual(mockPrices);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe("Network error");
        expect(result.current.lastUpdated).toBe(mockLastUpdated);
      });
    });
  });

  describe("fetchPricesForTokenIds", () => {
    const trendingIds = ["AQUA:GBNAQUA", "yXLM:GYXLM"];

    it("only fetches tokens not already in the map", async () => {
      const { result } = renderHook(() => usePricesStore());

      act(() => {
        usePricesStore.setState({
          prices: {
            "AQUA:GBNAQUA": {
              currentPrice: new BigNumber("0.003"),
              percentagePriceChange24h: new BigNumber("1.2"),
            },
          },
          pricesNetwork: NETWORKS.PUBLIC,
        });
      });

      await act(async () => {
        await result.current.fetchPricesForTokenIds({
          tokens: trendingIds,
          network: NETWORKS.PUBLIC,
        });
      });

      // Only the missing token is requested.
      expect(mockFetchTokenPrices).toHaveBeenCalledWith({
        tokens: ["yXLM:GYXLM"],
        network: NETWORKS.PUBLIC,
        useV2: true,
      });
    });

    it("does not fetch when all tokens are already loaded", async () => {
      const { result } = renderHook(() => usePricesStore());

      act(() => {
        usePricesStore.setState({
          prices: {
            "AQUA:GBNAQUA": {
              currentPrice: new BigNumber("0.003"),
              percentagePriceChange24h: new BigNumber("1.2"),
            },
            "yXLM:GYXLM": {
              currentPrice: new BigNumber("0.4"),
              percentagePriceChange24h: new BigNumber("0.5"),
            },
          },
          pricesNetwork: NETWORKS.PUBLIC,
        });
      });

      await act(async () => {
        await result.current.fetchPricesForTokenIds({
          tokens: trendingIds,
          network: NETWORKS.PUBLIC,
        });
      });

      expect(mockFetchTokenPrices).not.toHaveBeenCalled();
    });

    it("refetches already-loaded tokens when forceRefresh is true", async () => {
      const { result } = renderHook(() => usePricesStore());

      act(() => {
        usePricesStore.setState({
          prices: {
            "AQUA:GBNAQUA": {
              currentPrice: new BigNumber("0.003"),
              percentagePriceChange24h: new BigNumber("1.2"),
            },
            "yXLM:GYXLM": {
              currentPrice: new BigNumber("0.4"),
              percentagePriceChange24h: new BigNumber("0.5"),
            },
          },
          pricesNetwork: NETWORKS.PUBLIC,
        });
      });

      await act(async () => {
        await result.current.fetchPricesForTokenIds({
          tokens: trendingIds,
          network: NETWORKS.PUBLIC,
          forceRefresh: true,
        });
      });

      // forceRefresh bypasses the already-loaded skip → both tokens requested.
      expect(mockFetchTokenPrices).toHaveBeenCalledWith({
        tokens: trendingIds,
        network: NETWORKS.PUBLIC,
        useV2: true,
      });
    });

    it("refetches already-loaded tokens when the network changes", async () => {
      const { result } = renderHook(() => usePricesStore());

      // Cache is fully populated, but for a different network than the fetch.
      act(() => {
        usePricesStore.setState({
          prices: {
            "AQUA:GBNAQUA": {
              currentPrice: new BigNumber("0.003"),
              percentagePriceChange24h: new BigNumber("1.2"),
            },
            "yXLM:GYXLM": {
              currentPrice: new BigNumber("0.4"),
              percentagePriceChange24h: new BigNumber("0.5"),
            },
          },
          pricesNetwork: NETWORKS.PUBLIC,
        });
      });

      await act(async () => {
        await result.current.fetchPricesForTokenIds({
          tokens: trendingIds,
          network: NETWORKS.TESTNET,
        });
      });

      // Stale prices are network-scoped, so the network switch refetches every
      // requested token rather than treating them as already-loaded.
      expect(mockFetchTokenPrices).toHaveBeenCalledWith({
        tokens: trendingIds,
        network: NETWORKS.TESTNET,
        useV2: true,
      });
      expect(usePricesStore.getState().pricesNetwork).toBe(NETWORKS.TESTNET);
    });

    it("discards an in-flight response when the network changed mid-fetch", async () => {
      const { result } = renderHook(() => usePricesStore());

      let resolveFetch: (value: TokenPricesMap) => void = () => {};
      mockFetchTokenPrices.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );

      let pending: Promise<void> = Promise.resolve();
      act(() => {
        pending = result.current.fetchPricesForTokenIds({
          tokens: trendingIds,
          network: NETWORKS.PUBLIC,
        });
      });

      // Network moves on before the slow PUBLIC fetch resolves.
      act(() => {
        usePricesStore.setState({ pricesNetwork: NETWORKS.TESTNET });
      });

      await act(async () => {
        resolveFetch({
          "AQUA:GBNAQUA": {
            currentPrice: new BigNumber("1"),
            percentagePriceChange24h: new BigNumber("0"),
          },
        });
        await pending;
      });

      // The stale PUBLIC response must not be merged into the TESTNET cache.
      expect(result.current.prices["AQUA:GBNAQUA"]).toBeUndefined();
    });
  });

  describe("selector hooks", () => {
    it("should have correct state values", () => {
      const mockLastUpdated = Date.now();

      act(() => {
        usePricesStore.setState({
          prices: mockPrices,
          isLoading: true,
          error: "Test error",
          lastUpdated: mockLastUpdated,
        });
      });

      const { result } = renderHook(() => usePricesStore());

      expect(result.current.prices).toEqual(mockPrices);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe("Test error");
      expect(result.current.lastUpdated).toBe(mockLastUpdated);
    });

    it("should have fetchPricesForBalances function", async () => {
      const { result } = renderHook(() => usePricesStore());

      expect(typeof result.current.fetchPricesForBalances).toBe("function");

      await act(async () => {
        await result.current.fetchPricesForBalances(mockParams);
      });

      expect(mockGetTokenIdentifiersFromBalances).toHaveBeenCalledWith(
        mockBalances,
      );
      expect(mockFetchTokenPrices).toHaveBeenCalledWith({
        tokens: mockTokenIdentifiers,
        network: NETWORKS.TESTNET,
        useV2: true,
      });
    });
  });
});

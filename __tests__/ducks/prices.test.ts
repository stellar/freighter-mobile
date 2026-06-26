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
import { usePricesStore, usePricesForNetwork } from "ducks/prices";
import * as balancesHelpers from "helpers/balances";
import { fetchTokenPrices } from "services/backend";

// Mock the getTokenIdentifiersFromBalances helper and fetchTokenPrices service
jest.mock("helpers/balances", () => ({
  getTokenIdentifiersFromBalances: jest.fn(),
}));

jest.mock("services/backend", () => ({
  fetchTokenPrices: jest.fn(),
}));

describe("prices duck", () => {
  const mockGetTokenIdentifiersFromBalances =
    balancesHelpers.getTokenIdentifiersFromBalances as jest.MockedFunction<
      typeof balancesHelpers.getTokenIdentifiersFromBalances
    >;
  const mockFetchTokenPrices = fetchTokenPrices as jest.MockedFunction<
    typeof fetchTokenPrices
  >;

  const createMockBalances = () => {
    const mockNativeBalance: NativeBalance = {
      token: { code: "XLM", type: "native" as const },
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

    type MockBalanceRecord = Record<string, Balance> & {
      native: NativeBalance;
    };

    return {
      mockBalances: {
        native: mockNativeBalance,
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":
          mockTokenBalance,
      } as MockBalanceRecord,
    };
  };

  const createMockPrices = (): TokenPricesMap => ({
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

  const mockTokenIdentifiers = [
    "XLM",
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  ];

  const mockParams = {
    balances: mockBalances,
    publicKey: "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM",
    network: NETWORKS.TESTNET,
    useV2: true,
  };

  // Convenience: seed a network's cache as if it were fetched under `useV2`.
  const seedNetwork = (
    network: NETWORKS,
    prices: TokenPricesMap,
    useV2 = true,
  ) =>
    act(() => {
      usePricesStore.setState({
        pricesByNetwork: { [network]: prices },
        sourceByNetwork: { [network]: useV2 },
      });
    });

  beforeEach(() => {
    act(() => {
      usePricesStore.setState({
        pricesByNetwork: {},
        sourceByNetwork: {},
        isLoading: false,
        error: null,
        lastUpdated: null,
      });
    });

    mockGetTokenIdentifiersFromBalances.mockReset();
    mockFetchTokenPrices.mockReset();

    mockGetTokenIdentifiersFromBalances.mockReturnValue(mockTokenIdentifiers);
    mockFetchTokenPrices.mockResolvedValue(mockPrices);
  });

  describe("initial state", () => {
    it("starts empty", () => {
      const { result } = renderHook(() => usePricesStore());

      expect(result.current.pricesByNetwork).toEqual({});
      expect(result.current.sourceByNetwork).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastUpdated).toBeNull();
    });
  });

  describe("fetchPricesForBalances", () => {
    it("stores fetched prices under the requested network", async () => {
      const { result } = renderHook(() => usePricesStore());

      await act(async () => {
        await result.current.fetchPricesForBalances(mockParams); // TESTNET
      });

      expect(mockFetchTokenPrices).toHaveBeenCalledWith({
        tokens: mockTokenIdentifiers,
        network: NETWORKS.TESTNET,
        useV2: true,
      });
      expect(result.current.pricesByNetwork[NETWORKS.TESTNET]).toEqual(
        mockPrices,
      );
      expect(result.current.sourceByNetwork[NETWORKS.TESTNET]).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.lastUpdated).toBe("number");
    });

    it("merges within a network (preserves non-balance entries)", async () => {
      const { result } = renderHook(() => usePricesStore());

      seedNetwork(NETWORKS.TESTNET, {
        "AQUA:GBN...": {
          currentPrice: new BigNumber("0.003"),
          percentagePriceChange24h: new BigNumber("1.2"),
        },
      });

      await act(async () => {
        await result.current.fetchPricesForBalances(mockParams); // TESTNET
      });

      const testnet = result.current.pricesByNetwork[NETWORKS.TESTNET];
      expect(testnet["AQUA:GBN..."]).toBeDefined();
      expect(testnet.XLM).toBeDefined();
    });

    it("does not write fetched prices into another network's cache", async () => {
      const { result } = renderHook(() => usePricesStore());

      // Pre-existing PUBLIC cache must be untouched by a TESTNET fetch.
      seedNetwork(NETWORKS.PUBLIC, mockPrices);

      await act(async () => {
        await result.current.fetchPricesForBalances(mockParams); // TESTNET
      });

      expect(result.current.pricesByNetwork[NETWORKS.PUBLIC]).toEqual(
        mockPrices,
      );
      expect(result.current.pricesByNetwork[NETWORKS.TESTNET]).toEqual(
        mockPrices,
      );
    });

    it("handles an empty token list", async () => {
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
      it("sets error and keeps loading false on failure", async () => {
        mockFetchTokenPrices.mockRejectedValueOnce(new Error("Network error"));
        const { result } = renderHook(() => usePricesStore());

        await act(async () => {
          await result.current.fetchPricesForBalances(mockParams);
        });

        expect(result.current.error).toBe("Network error");
        expect(result.current.isLoading).toBe(false);
      });

      it("preserves already-cached prices for the network on failure", async () => {
        const { result } = renderHook(() => usePricesStore());
        // Same network + same endpoint as the failing fetch, so nothing clears.
        seedNetwork(NETWORKS.TESTNET, mockPrices, true);
        // Only XLM is held now, so the fetch tries to load XLM and fails.
        mockGetTokenIdentifiersFromBalances.mockReturnValueOnce(["NEW:GXYZ"]);
        mockFetchTokenPrices.mockRejectedValueOnce(new Error("Network error"));

        await act(async () => {
          await result.current.fetchPricesForBalances(mockParams);
        });

        expect(result.current.pricesByNetwork[NETWORKS.TESTNET]).toEqual(
          mockPrices,
        );
        expect(result.current.error).toBe("Network error");
      });
    });
  });

  describe("fetchPricesForTokenIds", () => {
    const trendingIds = ["AQUA:GBNAQUA", "yXLM:GYXLM"];

    it("only fetches tokens not already in the network cache", async () => {
      const { result } = renderHook(() => usePricesStore());
      seedNetwork(NETWORKS.PUBLIC, {
        "AQUA:GBNAQUA": {
          currentPrice: new BigNumber("0.003"),
          percentagePriceChange24h: new BigNumber("1.2"),
        },
      });

      await act(async () => {
        await result.current.fetchPricesForTokenIds({
          tokens: trendingIds,
          network: NETWORKS.PUBLIC,
          useV2: true,
        });
      });

      expect(mockFetchTokenPrices).toHaveBeenCalledWith({
        tokens: ["yXLM:GYXLM"],
        network: NETWORKS.PUBLIC,
        useV2: true,
      });
    });

    it("does not fetch when all tokens are already loaded for that network", async () => {
      const { result } = renderHook(() => usePricesStore());
      seedNetwork(NETWORKS.PUBLIC, {
        "AQUA:GBNAQUA": {
          currentPrice: new BigNumber("0.003"),
          percentagePriceChange24h: new BigNumber("1.2"),
        },
        "yXLM:GYXLM": {
          currentPrice: new BigNumber("0.4"),
          percentagePriceChange24h: new BigNumber("0.5"),
        },
      });

      await act(async () => {
        await result.current.fetchPricesForTokenIds({
          tokens: trendingIds,
          network: NETWORKS.PUBLIC,
          useV2: true,
        });
      });

      expect(mockFetchTokenPrices).not.toHaveBeenCalled();
    });

    it("treats a different network as uncached (no cross-network dedupe)", async () => {
      const { result } = renderHook(() => usePricesStore());
      // All ids cached for PUBLIC...
      seedNetwork(NETWORKS.PUBLIC, {
        "AQUA:GBNAQUA": {
          currentPrice: new BigNumber("0.003"),
          percentagePriceChange24h: new BigNumber("1.2"),
        },
        "yXLM:GYXLM": {
          currentPrice: new BigNumber("0.4"),
          percentagePriceChange24h: new BigNumber("0.5"),
        },
      });

      // ...but a TESTNET request must still fetch them (prices are per-network).
      await act(async () => {
        await result.current.fetchPricesForTokenIds({
          tokens: trendingIds,
          network: NETWORKS.TESTNET,
          useV2: true,
        });
      });

      expect(mockFetchTokenPrices).toHaveBeenCalledWith({
        tokens: trendingIds,
        network: NETWORKS.TESTNET,
        useV2: true,
      });
    });

    it("refetches already-loaded tokens when forceRefresh is true", async () => {
      const { result } = renderHook(() => usePricesStore());
      seedNetwork(NETWORKS.PUBLIC, {
        "AQUA:GBNAQUA": {
          currentPrice: new BigNumber("0.003"),
          percentagePriceChange24h: new BigNumber("1.2"),
        },
        "yXLM:GYXLM": {
          currentPrice: new BigNumber("0.4"),
          percentagePriceChange24h: new BigNumber("0.5"),
        },
      });

      await act(async () => {
        await result.current.fetchPricesForTokenIds({
          tokens: trendingIds,
          network: NETWORKS.PUBLIC,
          useV2: true,
          forceRefresh: true,
        });
      });

      expect(mockFetchTokenPrices).toHaveBeenCalledWith({
        tokens: trendingIds,
        network: NETWORKS.PUBLIC,
        useV2: true,
      });
    });

    it("refetches cached tokens from v1 when the rollback flag flips", async () => {
      const { result } = renderHook(() => usePricesStore());
      // Cache populated by v2 on PUBLIC.
      seedNetwork(
        NETWORKS.PUBLIC,
        {
          "AQUA:GBNAQUA": {
            currentPrice: new BigNumber("0.003"),
            percentagePriceChange24h: new BigNumber("1.2"),
          },
          "yXLM:GYXLM": {
            currentPrice: new BigNumber("0.4"),
            percentagePriceChange24h: new BigNumber("0.5"),
          },
        },
        true,
      );

      // Rolled back to v1 → caller passes useV2: false.
      await act(async () => {
        await result.current.fetchPricesForTokenIds({
          tokens: trendingIds,
          network: NETWORKS.PUBLIC,
          useV2: false,
        });
      });

      // The endpoint changed, so all ids are refetched (cache was dropped).
      expect(mockFetchTokenPrices).toHaveBeenCalledWith({
        tokens: trendingIds,
        network: NETWORKS.PUBLIC,
        useV2: false,
      });
      expect(result.current.sourceByNetwork[NETWORKS.PUBLIC]).toBe(false);
    });

    it("discards an in-flight response when the endpoint flips mid-fetch", async () => {
      const { result } = renderHook(() => usePricesStore());
      seedNetwork(NETWORKS.PUBLIC, {}, true);

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
          useV2: true,
        });
      });

      // A rollback to v1 lands before the v2 fetch resolves.
      act(() => {
        usePricesStore.setState({
          sourceByNetwork: { [NETWORKS.PUBLIC]: false },
        });
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

      // The stale v2 response must not be merged into the v1-flipped cache.
      expect(
        result.current.pricesByNetwork[NETWORKS.PUBLIC]["AQUA:GBNAQUA"],
      ).toBeUndefined();
    });
  });

  describe("usePricesForNetwork", () => {
    it("returns the requested network's prices", () => {
      seedNetwork(NETWORKS.PUBLIC, mockPrices);
      const { result } = renderHook(() => usePricesForNetwork(NETWORKS.PUBLIC));
      expect(result.current).toEqual(mockPrices);
    });

    it("returns a stable empty map for an uncached network", () => {
      const { result, rerender } = renderHook(() =>
        usePricesForNetwork(NETWORKS.FUTURENET),
      );
      const first = result.current;
      expect(first).toEqual({});
      rerender();
      // Same reference across renders → no spurious re-renders.
      expect(result.current).toBe(first);
    });
  });
});

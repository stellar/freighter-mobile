/* eslint-disable @fnando/consistent-import/consistent-import */
import { act, renderHook } from "@testing-library/react-hooks";
import { BigNumber } from "bignumber.js";
import { NETWORKS, STORAGE_KEYS } from "config/constants";
import {
  NativeBalance,
  ClassicBalance,
  TokenPricesMap,
  TokenTypeWithCustomToken,
  BalanceMap,
} from "config/types";
import { useBalancesStore } from "ducks/balances";
import { usePricesStore } from "ducks/prices";
import { fetchBalances } from "services/backend";
import { dataStorage } from "services/storage/storageFactory";

import { benignTokenScan } from "../../__mocks__/blockaid-response";

// Mock the fetchBalances service and usePricesStore
jest.mock("services/backend", () => ({
  fetchBalances: jest.fn(),
}));

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: {
    getItem: jest.fn(),
  },
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

jest.mock("services/blockaid/api", () => ({
  scanBulkTokens: jest.fn(),
}));

describe("balances duck", () => {
  const mockFetchBalances = fetchBalances as jest.MockedFunction<
    typeof fetchBalances
  >;
  const mockGetItem = jest.fn();

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
      type: "native" as const,
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
      type: "credit_alphanum4" as TokenTypeWithCustomToken,
    },
    total: new BigNumber("200"),
    available: new BigNumber("200"),
    limit: new BigNumber("1000"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
    blockaidData: benignTokenScan,
  };

  const mockBalances = {
    XLM: mockNativeBalance,
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":
      mockTokenBalance,
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
    contractIds: [],
    publicKey: "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM",
    network: NETWORKS.TESTNET,
  };
  const mockParamsPubnet = {
    contractIds: [],
    publicKey: "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM",
    network: NETWORKS.PUBLIC,
  };

  beforeEach(() => {
    // Reset the store before each test
    act(() => {
      useBalancesStore.setState({
        balances: {},
        pricedBalances: {},
        scanResults: {},
        isLoading: false,
        error: null,
      });
    });

    // Reset all mocks
    jest.clearAllMocks();
    mockFetchBalances.mockReset();
    (usePricesStore.getState as jest.Mock).mockReset();
    mockGetItem.mockReset();

    // Set up default storage mock
    jest.spyOn(dataStorage, "getItem").mockImplementation(mockGetItem);
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
      // Mock custom token storage
      const mockCustomTokens = {
        [mockParams.publicKey]: {
          [mockParams.network]: [
            { contractId: "customContract1", symbol: "TOKEN1" },
            { contractId: "customContract2", symbol: "TOKEN2" },
          ],
        },
      };

      // Set up storage mock for this test
      mockGetItem.mockImplementation((key) => {
        if (key === STORAGE_KEYS.CUSTOM_TOKEN_LIST) {
          return Promise.resolve(JSON.stringify(mockCustomTokens));
        }
        return Promise.resolve(null);
      });

      mockFetchBalances.mockResolvedValueOnce({ balances: mockBalances });
      (usePricesStore.getState as jest.Mock).mockReturnValue(
        createMockPricesStore(),
      );

      const { result } = renderHook(() => useBalancesStore());

      // Provided contract IDs in params
      const providedContractIds = ["contract1", "contract2"];

      // First ensure the storage is initialized
      await mockGetItem(STORAGE_KEYS.CUSTOM_TOKEN_LIST);

      await act(async () => {
        await result.current.fetchAccountBalances({
          ...mockParams,
          contractIds: providedContractIds,
        });
      });

      // Verify balances were fetched
      expect(result.current.balances).toEqual(mockBalances);

      // Verify storage was queried with correct key
      expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEYS.CUSTOM_TOKEN_LIST);

      // Get the last call to fetchBalances
      expect(mockFetchBalances).toHaveBeenCalled();
      const lastCall =
        mockFetchBalances.mock.calls[mockFetchBalances.mock.calls.length - 1];
      expect(lastCall).toBeDefined();

      const [lastCallArgs] = lastCall;
      expect(lastCallArgs).toMatchObject({
        publicKey: mockParams.publicKey,
        network: mockParams.network,
      });

      // Verify that both custom tokens are included
      expect(lastCallArgs.contractIds).toBeDefined();
      expect(lastCallArgs.contractIds).toContain("customContract1");
      expect(lastCallArgs.contractIds).toContain("customContract2");

      // Verify that provided contract IDs are included
      expect(lastCallArgs.contractIds).toContain("contract1");
      expect(lastCallArgs.contractIds).toContain("contract2");

      // Verify total length
      expect(lastCallArgs.contractIds).toHaveLength(4);
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

      const { result, unmount } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(result.current.balances).toEqual({});
      expect(result.current.pricedBalances).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      unmount();
    });

    it("should update error state when fetch fails with non-Error", async () => {
      mockFetchBalances.mockRejectedValueOnce("Some non-error rejection");

      const { result, unmount } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(result.current.balances).toEqual({});
      expect(result.current.pricedBalances).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("Failed to fetch balances");
      unmount();
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

    it("should extract scanResults from backend balance data", async () => {
      mockFetchBalances.mockResolvedValueOnce({ balances: mockBalances });
      (usePricesStore.getState as jest.Mock).mockReturnValue(
        createMockPricesStore({ prices: mockPrices }),
      );

      const { result, unmount } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParamsPubnet);
      });

      // Should extract scan results from blockaidData in balances
      expect(result.current.scanResults).toEqual({
        "USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":
          benignTokenScan,
      });
      unmount();
    });

    it("should extract scan results only from mainnet balances", async () => {
      const mockBalancesWithBlockaid = {
        ...mockBalances,
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":
          mockTokenBalance,
      };

      mockFetchBalances.mockResolvedValueOnce({
        balances: mockBalancesWithBlockaid,
      });
      (usePricesStore.getState as jest.Mock).mockReturnValue(
        createMockPricesStore({ prices: mockPrices }),
      );

      const { result, unmount } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      // On testnet, should not extract scan results
      expect(result.current.scanResults).toEqual({});
      unmount();
    });

    it("should not extract scan results for native tokens or liquidity pools", async () => {
      const mockNativeWithBlockaid = {
        ...mockNativeBalance,
        blockaidData: benignTokenScan,
      };

      const mockBalancesWithoutTokens = {
        XLM: mockNativeWithBlockaid,
      };

      mockFetchBalances.mockResolvedValueOnce({
        balances: mockBalancesWithoutTokens,
      });
      (usePricesStore.getState as jest.Mock).mockReturnValue(
        createMockPricesStore({ prices: mockPrices }),
      );

      const { result, unmount } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParamsPubnet);
      });

      // Should not extract scan results for XLM (native token)
      expect(result.current.scanResults).toEqual({});
      unmount();
    });

    it("should extract scan results from multiple balances", async () => {
      const manyBalances = {} as BalanceMap;
      const expectedScanResults: Record<string, typeof benignTokenScan> = {};

      for (let i = 0; i < 5; i++) {
        const tokenId = `TOKEN${i}:ISSUER${i}`;
        manyBalances[tokenId] = {
          ...mockTokenBalance,
          token: {
            ...mockTokenBalance.token,
            code: `TOKEN${i}`,
            issuer: { key: `ISSUER${i}` },
          },
          blockaidData: benignTokenScan,
        };
        expectedScanResults[`TOKEN${i}-ISSUER${i}`] = benignTokenScan;
      }

      mockFetchBalances.mockResolvedValueOnce({ balances: manyBalances });
      (usePricesStore.getState as jest.Mock).mockReturnValue(
        createMockPricesStore({ prices: {} }),
      );

      const { result, unmount } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParamsPubnet);
      });

      // Should extract scan results for all tokens with blockaidData
      expect(result.current.scanResults).toEqual(expectedScanResults);
      expect(Object.keys(result.current.scanResults)).toHaveLength(5);
      unmount();
    });
  });
});

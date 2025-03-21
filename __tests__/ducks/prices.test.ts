import { AssetType } from "@stellar/stellar-sdk";
import { act, renderHook } from "@testing-library/react-hooks";
import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import { Balance, NativeBalance, ClassicBalance } from "config/types";
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

    // Define type to satisfy the linter
    type MockBalanceRecord = Record<string, Balance> & {
      native: NativeBalance;
    };

    return {
      mockNativeBalance,
      mockAssetBalance,
      mockBalances: {
        native: mockNativeBalance,
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":
          mockAssetBalance,
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
    mockFetchTokenPrices.mockResolvedValue({ data: mockPrices });
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
        // First set some prices
        const mockLastUpdated = Date.now();
        act(() => {
          usePricesStore.setState({
            prices: mockPrices,
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
      });
    });
  });
});

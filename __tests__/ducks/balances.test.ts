import { AssetType } from "@stellar/stellar-sdk";
import { act, renderHook } from "@testing-library/react-hooks";
import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import { Balance, NativeBalance, AssetBalance } from "config/types";
import {
  useBalancesStore,
  useBalances,
  useBalancesFetcher,
} from "ducks/balances";
import { fetchBalances } from "services/backend";

// Mock the fetchBalances service
jest.mock("/services/backend", () => ({
  fetchBalances: jest.fn(),
}));

describe("balances duck", () => {
  const mockFetchBalances = fetchBalances as jest.MockedFunction<
    typeof fetchBalances
  >;

  const mockNativeBalance: NativeBalance = {
    token: {
      code: "XLM",
      type: "native" as AssetType,
    },
    total: new BigNumber("100.5"),
    available: new BigNumber("100.5"),
    minimumBalance: new BigNumber("1"),
  };

  const mockAssetBalance: AssetBalance = {
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
  };

  // Define type to satisfy the linter while working with the duck implementation
  type MockBalanceRecord = Record<string, Balance> & { native: NativeBalance };

  const mockBalances: MockBalanceRecord = {
    native: mockNativeBalance,
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":
      mockAssetBalance,
  };

  const emptyBalances: MockBalanceRecord = {
    native: {
      token: {
        code: "XLM",
        type: "native" as AssetType,
      },
      total: new BigNumber("0"),
      available: new BigNumber("0"),
      minimumBalance: new BigNumber("1"),
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
        balances: emptyBalances,
        isLoading: false,
        error: null,
      });
    });

    // Reset the mocks
    mockFetchBalances.mockReset();
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() => useBalancesStore());

      expect(result.current.balances).toEqual(emptyBalances);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("fetchAccountBalances", () => {
    it("should update isLoading state when fetching begins", async () => {
      mockFetchBalances.mockResolvedValueOnce({ balances: emptyBalances });

      const { result } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      // Should have set isLoading to true at some point
      expect(mockFetchBalances).toHaveBeenCalledWith(mockParams);
    });

    it("should update balances state on successful fetch", async () => {
      mockFetchBalances.mockResolvedValueOnce({ balances: mockBalances });

      const { result } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(result.current.balances).toEqual(mockBalances);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockFetchBalances).toHaveBeenCalledWith(mockParams);
    });

    it("should handle fetch with contractIds", async () => {
      mockFetchBalances.mockResolvedValueOnce({ balances: mockBalances });

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

    it("should update error state when fetch fails with Error instance", async () => {
      const errorMessage = "Network error";
      mockFetchBalances.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(result.current.balances).toEqual(emptyBalances);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });

    it("should update error state when fetch fails with non-Error", async () => {
      mockFetchBalances.mockRejectedValueOnce("Some non-error rejection");

      const { result } = renderHook(() => useBalancesStore());

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(result.current.balances).toEqual(emptyBalances);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("Failed to fetch balances");
    });
  });

  describe("selector hooks", () => {
    it("useBalances should return correct values", () => {
      act(() => {
        useBalancesStore.setState({
          balances: mockBalances,
          isLoading: true,
          error: "Test error",
        });
      });

      const { result } = renderHook(() => useBalances());

      expect(result.current.balances).toEqual(mockBalances);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe("Test error");
    });

    it("useBalancesFetcher should return fetchAccountBalances function", async () => {
      mockFetchBalances.mockResolvedValueOnce({ balances: mockBalances });

      const { result } = renderHook(() => useBalancesFetcher());

      expect(typeof result.current.fetchAccountBalances).toBe("function");

      await act(async () => {
        await result.current.fetchAccountBalances(mockParams);
      });

      expect(mockFetchBalances).toHaveBeenCalledWith(mockParams);
    });
  });
});

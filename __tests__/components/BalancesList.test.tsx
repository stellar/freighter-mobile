import { AssetType } from "@stellar/stellar-sdk";
import { act } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { BalancesList } from "components/BalancesList";
import { NETWORKS } from "config/constants";
import {
  Balance,
  BalanceMap,
  ClassicBalance,
  LiquidityPoolBalance,
  NativeBalance,
  PricedBalanceMap,
} from "config/types";
import { useBalancesStore } from "ducks/balances";
import { usePricesStore } from "ducks/prices";
import * as balancesHelpers from "helpers/balances";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock the stores
jest.mock("ducks/balances", () => ({
  useBalancesStore: jest.fn(),
}));

jest.mock("ducks/prices", () => ({
  usePricesStore: jest.fn(),
}));

// Mock React Navigation's useFocusEffect
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn((callback) => {
    // Execute the callback immediately to simulate focus
    callback();
    // Return a cleanup function
    return () => {};
  }),
}));

// Mock balances helpers
jest.mock("helpers/balances", () => ({
  isLiquidityPool: jest.fn(),
  getTokenIdentifiersFromBalances: jest.fn(),
  getLPShareCode: jest.fn(),
  getTokenIdentifier: jest.fn((token) => {
    if (token.type === "native") return "XLM";
    return `${token.code}:${token.issuer.key}`;
  }),
}));

// Mock debug to avoid console logs in tests
jest.mock("helpers/debug", () => ({
  debug: jest.fn(),
}));

// Mock formatAmount helpers
jest.mock("helpers/formatAmount", () => ({
  formatAssetAmount: jest.fn((amount) => amount.toString()),
  formatFiatAmount: jest.fn((amount) => `$${amount.toString()}`),
  formatPercentageAmount: jest.fn((amount) => {
    if (!amount) return "—";
    const isNegative = amount.isLessThan(0);
    return `${isNegative ? "-" : "+"}${amount.abs().toString()}%`;
  }),
}));

const mockUseBalancesStore = useBalancesStore as jest.MockedFunction<
  typeof useBalancesStore
>;
const mockUsePricesStore = usePricesStore as jest.MockedFunction<
  typeof usePricesStore
>;

// Type the mock functions properly
const mockIsLiquidityPool =
  balancesHelpers.isLiquidityPool as jest.MockedFunction<
    (balance: Balance) => balance is LiquidityPoolBalance
  >;

describe("BalancesList", () => {
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

    return {
      mockNativeBalance,
      mockAssetBalance,
      mockBalances: {
        XLM: mockNativeBalance,
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":
          mockAssetBalance,
      },
    };
  };

  // Helper function to create mock priced balances
  const createMockPricedBalances = (
    mockNativeBalance: NativeBalance,
    mockAssetBalance: ClassicBalance,
  ) => ({
    XLM: {
      ...mockNativeBalance,
      tokenCode: "XLM",
      displayName: "XLM",
      imageUrl: "",
      currentPrice: new BigNumber("0.5"),
      percentagePriceChange24h: new BigNumber("0.02"),
      fiatCode: "USD",
      fiatTotal: new BigNumber("50.25"),
    },
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN": {
      ...mockAssetBalance,
      tokenCode: "USDC",
      displayName: "USDC",
      imageUrl: "",
      currentPrice: new BigNumber("1"),
      percentagePriceChange24h: new BigNumber("-0.01"),
      fiatCode: "USD",
      fiatTotal: new BigNumber("200"),
    },
  });

  // Helper function to create mock store state
  const createMockStoreState = (
    overrides: Partial<{
      balances: BalanceMap;
      pricedBalances: PricedBalanceMap;
      isLoading: boolean;
      error: string | null;
      fetchAccountBalances: jest.Mock;
    }> = {},
  ) => ({
    balances: {},
    pricedBalances: {},
    isLoading: false,
    error: null,
    fetchAccountBalances: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const { mockBalances, mockNativeBalance, mockAssetBalance } =
    createMockBalances();
  const mockPricedBalances = createMockPricedBalances(
    mockNativeBalance,
    mockAssetBalance,
  );

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseBalancesStore.mockReturnValue(createMockStoreState());
    mockUsePricesStore.mockReturnValue({
      prices: {},
      isLoading: false,
      error: null,
      lastUpdated: null,
      fetchPricesForBalances: jest.fn().mockResolvedValue(undefined),
    });

    // Mock balance helpers defaults
    mockIsLiquidityPool.mockReturnValue(false);
    (
      balancesHelpers.getTokenIdentifiersFromBalances as jest.Mock
    ).mockReturnValue([]);
    (balancesHelpers.getLPShareCode as jest.Mock).mockReturnValue("");
  });

  describe("initial render", () => {
    it("should show loading state when fetching balances", () => {
      mockUseBalancesStore.mockReturnValue(
        createMockStoreState({ isLoading: true }),
      );

      const { getByTestId } = renderWithProviders(
        <BalancesList
          publicKey="GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG"
          network={NETWORKS.TESTNET}
        />,
      );
      expect(getByTestId("balances-list-spinner")).toBeVisible();
    });

    it("should show error state when there is an error loading balances", () => {
      mockUseBalancesStore.mockReturnValue(
        createMockStoreState({ error: "Failed to load balances" }),
      );

      const { getByText } = renderWithProviders(
        <BalancesList
          publicKey="GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG"
          network={NETWORKS.TESTNET}
        />,
      );
      expect(getByText("Error loading balances")).toBeTruthy();
    });

    it("should show empty state when no balances are found", () => {
      mockUseBalancesStore.mockReturnValue(createMockStoreState());

      const { getByText } = renderWithProviders(
        <BalancesList
          publicKey="GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG"
          network={NETWORKS.TESTNET}
        />,
      );
      expect(getByText("No balances found")).toBeTruthy();
    });

    it("should render the list of balances correctly", () => {
      mockUseBalancesStore.mockReturnValue(
        createMockStoreState({
          balances: mockBalances,
          pricedBalances: mockPricedBalances,
        }),
      );

      const { getByText, getByTestId } = renderWithProviders(
        <BalancesList
          publicKey="GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG"
          network={NETWORKS.TESTNET}
        />,
      );

      expect(getByTestId("balances-list")).toBeTruthy();
      expect(getByText("XLM")).toBeTruthy();
      expect(getByText("USDC")).toBeTruthy();
    });
  });

  describe("refresh behavior", () => {
    it("should handle refresh correctly", async () => {
      const mockFetchAccountBalances = jest.fn().mockResolvedValue(undefined);
      mockUseBalancesStore.mockReturnValue(
        createMockStoreState({
          balances: mockBalances,
          pricedBalances: mockPricedBalances,
          fetchAccountBalances: mockFetchAccountBalances,
        }),
      );

      const { getByTestId } = renderWithProviders(
        <BalancesList
          publicKey="GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG"
          network={NETWORKS.TESTNET}
        />,
      );
      const flatList = getByTestId("balances-list");

      // Trigger refresh by simulating the onRefresh event
      act(() => {
        const { refreshControl } = flatList.props;
        refreshControl.props.onRefresh();
      });

      // Add a small delay to allow the async operation to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      // Verify the mock was called with correct arguments
      expect(mockFetchAccountBalances).toHaveBeenCalledWith({
        publicKey: "GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG",
        network: NETWORKS.TESTNET,
      });
    });
  });

  describe("liquidity pool balances", () => {
    it("should handle liquidity pool balances correctly", () => {
      const mockLiquidityPoolBalance = {
        total: new BigNumber("1472.6043561"),
        limit: new BigNumber("100000"),
        liquidityPoolId:
          "4ac86c65b9f7b175ae0493da0d36cc5bc88b72677ca69fce8fe374233983d8e7",
        reserves: [
          {
            asset: "native",
            amount: "5061.4450626",
          },
          {
            asset:
              "USDC:GBUNQWSNHUCOCUDRESGNY5SIS2CXILTWHZV5VARUP47G44NRUOOEYICX",
            amount: "44166.9752644",
          },
        ],
        buyingLiabilities: "0",
        sellingLiabilities: "0",
      };

      const balancesWithLP = {
        ...mockBalances,
        "4ac86c65b9f7b175ae0493da0d36cc5bc88b72677ca69fce8fe374233983d8e7:lp":
          mockLiquidityPoolBalance,
      };

      const pricedBalancesWithLP = {
        ...mockPricedBalances,
        "4ac86c65b9f7b175ae0493da0d36cc5bc88b72677ca69fce8fe374233983d8e7:lp": {
          ...mockLiquidityPoolBalance,
          tokenCode: "XLM / USDC",
          displayName: "XLM / USDC",
          imageUrl: "",
          currentPrice: new BigNumber("1.5"),
          percentagePriceChange24h: new BigNumber("0.05"),
          fiatCode: "USD",
          fiatTotal: new BigNumber("2208.91"),
        },
      };

      // Setup mock helpers for LP
      mockIsLiquidityPool.mockImplementation(
        (balance) => "liquidityPoolId" in balance,
      );
      (balancesHelpers.getLPShareCode as jest.Mock).mockReturnValue(
        "XLM / USDC",
      );

      mockUseBalancesStore.mockReturnValue(
        createMockStoreState({
          balances: balancesWithLP,
          pricedBalances: pricedBalancesWithLP,
        }),
      );

      const { getByText } = renderWithProviders(
        <BalancesList
          publicKey="GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG"
          network={NETWORKS.TESTNET}
        />,
      );
      expect(getByText("XLM / USDC")).toBeTruthy();
    });
  });
});

import { AssetType } from "@stellar/stellar-sdk";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { BalancesList } from "components/BalancesList";
import { NETWORKS } from "config/constants";
import { AssetBalance, NativeBalance } from "config/types";
import { useBalances, useBalancesFetcher } from "ducks/balances";
import { usePrices, usePricesFetcher } from "ducks/prices";
import * as balancesHelpers from "helpers/balances";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Import the mocked functions for direct manipulation in tests

// Mock the hooks
jest.mock("ducks/balances", () => ({
  useBalancesFetcher: jest.fn(() => ({
    fetchAccountBalances: jest.fn().mockResolvedValue(undefined),
  })),
  useBalances: jest.fn(() => ({
    balances: {},
    isLoading: false,
    error: null,
  })),
}));

jest.mock("ducks/prices", () => ({
  usePricesFetcher: jest.fn(() => ({
    fetchPricesForBalances: jest.fn().mockResolvedValue(undefined),
  })),
  usePrices: jest.fn(() => ({
    prices: {},
    isLoading: false,
    error: null,
    lastUpdated: null,
  })),
}));

// Mock React Navigation's useFocusEffect
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn((callback) => {
    // Execute the callback once to simulate focus
    callback();
    return null;
  }),
}));

// Mock balances helpers
jest.mock("helpers/balances", () => ({
  isLiquidityPool: jest.fn(),
  getTokenPriceFromBalance: jest.fn(),
  getLPShareCode: jest.fn(),
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

const mockUseBalances = useBalances as jest.MockedFunction<typeof useBalances>;
const mockUseBalancesFetcher = useBalancesFetcher as jest.MockedFunction<
  typeof useBalancesFetcher
>;
const mockUsePrices = usePrices as jest.MockedFunction<typeof usePrices>;
const mockUsePricesFetcher = usePricesFetcher as jest.MockedFunction<
  typeof usePricesFetcher
>;

describe("BalancesList", () => {
  // Mock fetch functions
  const mockFetchAccountBalances = jest.fn().mockResolvedValue(undefined);
  const mockFetchPricesForBalances = jest.fn().mockResolvedValue(undefined);

  // Sample data for tests
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

  const mockBalances = {
    native: mockNativeBalance,
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

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseBalancesFetcher.mockReturnValue({
      fetchAccountBalances: mockFetchAccountBalances,
    });
    mockUsePricesFetcher.mockReturnValue({
      fetchPricesForBalances: mockFetchPricesForBalances,
    });

    mockUseBalances.mockReturnValue({
      balances: {},
      isLoading: false,
      error: null,
    });

    mockUsePrices.mockReturnValue({
      prices: {},
      isLoading: false,
      error: null,
      lastUpdated: null,
    });

    // Mock balance helpers defaults
    (balancesHelpers.isLiquidityPool as unknown as jest.Mock).mockReturnValue(
      false,
    );
    (balancesHelpers.getTokenPriceFromBalance as jest.Mock).mockReturnValue(
      null,
    );
    (balancesHelpers.getLPShareCode as jest.Mock).mockReturnValue("");
  });

  it("should show loading state when fetching balances", () => {
    // Mock loading state
    mockUseBalances.mockReturnValue({
      balances: {},
      isLoading: true,
      error: null,
    });

    const { getByText } = renderWithProviders(<BalancesList />);
    expect(getByText("Loading balances...")).toBeTruthy();
  });

  it("should show error state when there is an error loading balances", () => {
    // Mock error state
    mockUseBalances.mockReturnValue({
      balances: {},
      isLoading: false,
      error: "Failed to load balances",
    });

    const { getByText } = renderWithProviders(<BalancesList />);
    expect(getByText("Error loading balances")).toBeTruthy();
  });

  it("should show empty state when no balances are found", () => {
    // Mock empty balances
    mockUseBalances.mockReturnValue({
      balances: {},
      isLoading: false,
      error: null,
    });

    const { getByText } = renderWithProviders(<BalancesList />);
    expect(getByText("No balances found")).toBeTruthy();
  });

  it("should render the list of balances correctly", () => {
    // Setup mock balance helpers for specific balances
    (balancesHelpers.getTokenPriceFromBalance as jest.Mock).mockImplementation(
      (prices, balance) => {
        if (balance.token.code === "XLM") {
          return mockPrices.XLM;
        }
        if (balance.token.code === "USDC") {
          return mockPrices[
            "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
          ];
        }
        return null;
      },
    );

    // Mock balances
    mockUseBalances.mockReturnValue({
      balances: mockBalances,
      isLoading: false,
      error: null,
    });

    // Mock prices
    mockUsePrices.mockReturnValue({
      prices: mockPrices,
      isLoading: false,
      error: null,
      lastUpdated: Date.now(),
    });

    const { getByText, getByTestId } = renderWithProviders(<BalancesList />);

    // Verify the FlatList is rendered
    expect(getByTestId("balances-list")).toBeTruthy();

    // Check that both balances are rendered
    expect(getByText("XLM")).toBeTruthy();
    expect(getByText("USDC")).toBeTruthy();
  });

  it("should handle refresh correctly", async () => {
    // Mock balances with data
    mockUseBalances.mockReturnValue({
      balances: mockBalances,
      isLoading: false,
      error: null,
    });

    // Render component
    const { getByTestId } = renderWithProviders(<BalancesList />);

    // Get the FlatList
    const flatList = getByTestId("balances-list");

    // Simulate pull-to-refresh
    fireEvent(flatList, "refresh");

    // Verify that fetchAccountBalances was called
    await waitFor(() => {
      expect(mockFetchAccountBalances).toHaveBeenCalledWith({
        publicKey: "GBNMQBDE2BPGG7QMNZTKA5VMKMSUNBQMMADANNMPS6VNRUYIVAU5TJRQ",
        network: NETWORKS.TESTNET,
      });
    });
  });

  it("should fetch prices when balances are loaded", async () => {
    // Mock balances
    mockUseBalances.mockReturnValue({
      balances: mockBalances,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<BalancesList />);

    // Verify fetchPricesForBalances was called with the right parameters
    await waitFor(() => {
      expect(mockFetchPricesForBalances).toHaveBeenCalledWith({
        balances: mockBalances,
        publicKey: "GBNMQBDE2BPGG7QMNZTKA5VMKMSUNBQMMADANNMPS6VNRUYIVAU5TJRQ",
        network: NETWORKS.TESTNET,
      });
    });
  });

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
    };

    const balancesWithLP = {
      ...mockBalances,
      "4ac86c65b9f7b175ae0493da0d36cc5bc88b72677ca69fce8fe374233983d8e7:lp":
        mockLiquidityPoolBalance,
    };

    // Setup mock helpers for LP
    (
      balancesHelpers.isLiquidityPool as unknown as jest.Mock
    ).mockImplementation((balance) => "liquidityPoolId" in balance);
    (balancesHelpers.getLPShareCode as jest.Mock).mockReturnValue("XLM / USDC");

    // Mock balances with LP
    mockUseBalances.mockReturnValue({
      balances: balancesWithLP,
      isLoading: false,
      error: null,
    });

    const { getByText } = renderWithProviders(<BalancesList />);

    // Verify the LP is rendered with the correct share code
    expect(getByText("XLM / USDC")).toBeTruthy();
  });
});

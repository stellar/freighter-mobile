import { render } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { BalancesList } from "components/BalancesList";
import { NETWORKS } from "config/constants";
import { useBalancesList } from "hooks/useBalancesList";
import React from "react";

// Mock the stores
jest.mock("ducks/balances", () => ({
  useBalancesStore: jest.fn(() => ({
    fetchAccountBalances: jest.fn(),
    startPolling: jest.fn(),
    stopPolling: jest.fn(),
    pricedBalances: {},
    isLoading: false,
    error: null,
    isFunded: false,
  })),
}));

jest.mock("ducks/prices", () => ({
  usePricesStore: jest.fn(),
}));

jest.mock("ducks/transactionSettings", () => ({
  useTransactionSettingsStore: jest.fn(() => ({
    transactionFee: "0.00001",
  })),
}));

jest.mock("ducks/swapSettings", () => ({
  useSwapSettingsStore: jest.fn(() => ({
    swapFee: "0.00001",
  })),
}));

// Mock React Navigation's useFocusEffect
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn((callback) => {
    callback();
    return () => {};
  }),
  useNavigation: jest.fn(),
  createNavigationContainerRef: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
    isReady: jest.fn(() => true),
  })),
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
  calculateSpendableAmount: jest.fn(({ balance }) => balance.total),
}));

// Mock debug to avoid console logs in tests
jest.mock("helpers/debug", () => ({
  debug: jest.fn(),
}));

// Mock formatAmount helpers
jest.mock("helpers/formatAmount", () => ({
  formatTokenForDisplay: jest.fn((amount) => amount.toString()),
  formatFiatAmount: jest.fn((amount) => `$${amount.toString()}`),
  formatPercentageAmount: jest.fn((amount) => {
    if (!amount) return "—";
    const isNegative = amount.isLessThan(0);
    return `${isNegative ? "-" : "+"}${amount.abs().toString()}%`;
  }),
}));

// Mock the useBalancesList hook
jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(),
}));

// Mock the useAppTranslation hook
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the useGetActiveAccount hook
jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({
    account: {
      publicKey: "test-public-key",
      subentryCount: 0,
    },
  }),
}));

const testPublicKey =
  "GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG";

describe("BalancesList", () => {
  const mockBalanceItems = [
    {
      id: "XLM",
      token: {
        code: "XLM",
        type: "native",
      },
      total: "100.5",
      available: "100.5",
      minimumBalance: "1",
      buyingLiabilities: "0",
      sellingLiabilities: "0",
      tokenCode: "XLM",
      displayName: "XLM",
      imageUrl: "",
      currentPrice: new BigNumber("0.5"),
      percentagePriceChange24h: new BigNumber("0.02"),
      fiatCode: "USD",
      fiatTotal: "50.25",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useBalancesList as jest.Mock).mockReturnValue({
      balanceItems: mockBalanceItems,
      scanResults: {},
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    });
  });

  it("should show loading state when fetching balances", () => {
    (useBalancesList as jest.Mock).mockReturnValue({
      balanceItems: [],
      scanResults: {},
      isLoading: true,
      error: null,
      noBalances: true,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    });

    const { getByTestId } = render(
      <BalancesList publicKey={testPublicKey} network={NETWORKS.TESTNET} />,
    );
    expect(getByTestId("balances-list-spinner")).toBeTruthy();
  });

  it("should show error state when there is an error loading balances", () => {
    (useBalancesList as jest.Mock).mockReturnValue({
      balanceItems: [],
      scanResults: {},
      isLoading: false,
      error: "Failed to load balances",
      noBalances: true,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    });

    const { getByText } = render(
      <BalancesList publicKey={testPublicKey} network={NETWORKS.TESTNET} />,
    );
    expect(getByText("balancesList.error")).toBeTruthy();
  });

  it("should show empty state with Friendbot button on testnet", () => {
    (useBalancesList as jest.Mock).mockReturnValue({
      balanceItems: [],
      scanResults: {},
      isLoading: false,
      error: null,
      noBalances: true,
      isRefreshing: false,
      isFunded: false,
      handleRefresh: jest.fn(),
    });

    const { getByTestId } = render(
      <BalancesList publicKey={testPublicKey} network={NETWORKS.TESTNET} />,
    );
    expect(getByTestId("friendbot-button")).toBeTruthy();
  });

  it("should show empty state without Friendbot button on mainnet", () => {
    (useBalancesList as jest.Mock).mockReturnValue({
      balanceItems: [],
      isLoading: false,
      error: null,
      noBalances: true,
      isRefreshing: false,
      isFunded: false,
      handleRefresh: jest.fn(),
    });

    const { queryByTestId } = render(
      <BalancesList publicKey={testPublicKey} network={NETWORKS.PUBLIC} />,
    );
    expect(queryByTestId("friendbot-button")).toBeNull();
  });

  it("should render balance items correctly", () => {
    const { getByText, getByTestId } = render(
      <BalancesList publicKey={testPublicKey} network={NETWORKS.TESTNET} />,
    );

    expect(getByTestId("balances-list")).toBeTruthy();
    expect(getByText("XLM")).toBeTruthy();
  });

  it("should call useBalancesList with correct parameters", () => {
    render(
      <BalancesList publicKey={testPublicKey} network={NETWORKS.TESTNET} />,
    );

    expect(useBalancesList).toHaveBeenCalledWith({
      publicKey: testPublicKey,
      network: NETWORKS.TESTNET,
    });
  });
});

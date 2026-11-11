import { useNavigation } from "@react-navigation/native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { BalancesList } from "components/BalancesList";
import { getButtonColors } from "components/sds/Button/theme";
import { NETWORKS } from "config/constants";
import { ADD_FUNDS_ROUTES, ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { hostParentOf } from "helpers/testUtils";
import { useBalancesList } from "hooks/useBalancesList";
import React from "react";
import { StyleSheet } from "react-native";
import { ReactTestInstance } from "react-test-renderer";

// Mock react-i18next. The rest of it stays real: helpers/testUtils sets up
// i18n with its initReactI18next.
jest.mock("react-i18next", () => ({
  ...jest.requireActual("react-i18next"),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

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

// Mock debug to avoid console logs in tests
jest.mock("helpers/debug", () => ({
  debug: jest.fn(),
}));

// Use actual implementations for helpers
jest.mock("helpers/balances", () => jest.requireActual("helpers/balances"));
jest.mock("helpers/soroban", () => jest.requireActual("helpers/soroban"));
jest.mock("helpers/formatAmount", () =>
  jest.requireActual("helpers/formatAmount"),
);

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

  // Figma's unfunded Home (?node-id=372-11502): the Empty card, with the
  // screen's copy and no "Learn more" link.
  describe("unfunded card", () => {
    const unfunded = () =>
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

    const styleOf = (node: ReactTestInstance | null | undefined) =>
      StyleSheet.flatten(node?.props.style) ?? {};

    // Jest reports no device scheme, so the buttons take DEFAULT_COLOR_SCHEME.
    const { secondary } = getButtonColors(DEFAULT_COLOR_SCHEME);

    // Button secondary lg: a 48pt pill with 16pt sides, filled with
    // text.primary, as wide as its label. Figma's card draws a 40pt pill;
    // Cássio chose lg.
    const expectSecondaryLgPill = (button: ReactTestInstance) =>
      expect(styleOf(button)).toMatchObject({
        height: 48,
        paddingLeft: 16,
        paddingRight: 16,
        // The pill: Button rounds every corner by 100pt.
        borderTopLeftRadius: 100,
        borderTopRightRadius: 100,
        borderBottomRightRadius: 100,
        borderBottomLeftRadius: 100,
        backgroundColor: secondary.background,
        width: "auto",
      });

    beforeEach(unfunded);

    afterEach(() => {
      (useNavigation as jest.Mock).mockReset();
    });

    it("says to activate the wallet with 2 XLM, without a Learn more link", () => {
      render(
        <BalancesList publicKey={testPublicKey} network={NETWORKS.PUBLIC} />,
      );

      expect(
        screen.getByText("balancesList.unfundedAccount.title"),
      ).toBeTruthy();
      expect(
        screen.getByText("balancesList.unfundedAccount.description"),
      ).toBeTruthy();
      // No "Learn more" link, which the old copy ended with.
      expect(screen.queryByRole("link")).toBeNull();
    });

    // The tokens contents pad 24pt at the sides and 9pt on top, and Figma
    // has the card 16pt from the screen's edges and 8pt under the tab row.
    it("sits 16pt from the screen's edges and 8pt under the tab row, padded 24pt inside", () => {
      render(
        <BalancesList
          publicKey={testPublicKey}
          network={NETWORKS.PUBLIC}
          disableInnerScrolling
        />,
      );

      expect(
        styleOf(screen.getByTestId("unfunded-account-empty-state")),
      ).toMatchObject({
        marginHorizontal: -8,
        marginTop: -1,
        paddingHorizontal: 24,
        minHeight: 280,
      });
    });

    it("offers Add XLM on mainnet as a secondary lg pill, opening Add funds", () => {
      const navigate = jest.fn();
      (useNavigation as jest.Mock).mockReturnValue({ navigate });

      render(
        <BalancesList publicKey={testPublicKey} network={NETWORKS.PUBLIC} />,
      );

      const button = screen.getByTestId("unfunded-account-add-xlm-button");
      expectSecondaryLgPill(button);
      expect(
        screen.getByText("balancesList.unfundedAccount.fundAccountButton"),
      ).toBeTruthy();

      fireEvent.press(button);
      expect(navigate).toHaveBeenCalledWith(
        ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK,
        {
          screen: ADD_FUNDS_ROUTES.ADD_FUNDS_SCREEN,
          params: { isUnfunded: true },
        },
      );
    });

    it("offers Friendbot on testnet as the same pill, not full width", () => {
      render(
        <BalancesList publicKey={testPublicKey} network={NETWORKS.TESTNET} />,
      );

      expectSecondaryLgPill(screen.getByTestId("friendbot-button"));
      expect(
        screen.queryByTestId("unfunded-account-add-xlm-button"),
      ).toBeNull();
    });
  });

  it("should render balance items correctly", () => {
    const { getByText, getByTestId } = render(
      <BalancesList publicKey={testPublicKey} network={NETWORKS.TESTNET} />,
    );

    expect(getByTestId("balances-list")).toBeTruthy();
    expect(getByText("XLM")).toBeTruthy();
  });

  describe("row dividers", () => {
    // Any issuer will do: the rows only need distinct ids.
    const issuer = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

    const classicAsset = (code: string) => ({
      ...mockBalanceItems[0],
      id: `${code}:${issuer}`,
      token: { code, type: "credit_alphanum4", issuer: { key: issuer } },
      tokenCode: code,
      displayName: code,
    });

    const threeBalanceItems = [
      ...mockBalanceItems,
      classicAsset("USDC"),
      classicAsset("AQUA"),
    ];

    beforeEach(() => {
      (useBalancesList as jest.Mock).mockReturnValue({
        balanceItems: threeBalanceItems,
        scanResults: {},
        isLoading: false,
        error: null,
        noBalances: false,
        isRefreshing: false,
        isFunded: true,
        handleRefresh: jest.fn(),
      });
    });

    it("renders a divider under every row", () => {
      const { getAllByTestId } = render(
        <BalancesList
          publicKey={testPublicKey}
          network={NETWORKS.TESTNET}
          disableInnerScrolling
        />,
      );

      expect(getAllByTestId("token-row-divider")).toHaveLength(3);
    });

    it("leaves the last row undivided when asked, for Send's picker", () => {
      const { getAllByTestId } = render(
        <BalancesList
          publicKey={testPublicKey}
          network={NETWORKS.TESTNET}
          disableInnerScrolling
          showLastRowDivider={false}
        />,
      );

      expect(getAllByTestId("token-row-divider")).toHaveLength(2);
    });

    it("leaves the scrolling list's last row undivided when asked", () => {
      const { getAllByTestId } = render(
        <BalancesList
          publicKey={testPublicKey}
          network={NETWORKS.TESTNET}
          showLastRowDivider={false}
        />,
      );

      expect(getAllByTestId("token-row-divider")).toHaveLength(2);
    });

    it("renders a divider under every row of the scrolling list", () => {
      const { getAllByTestId } = render(
        <BalancesList publicKey={testPublicKey} network={NETWORKS.TESTNET} />,
      );

      expect(getAllByTestId("token-row-divider")).toHaveLength(3);
    });
  });

  // Home ends its token list with an inline Add token button. If the list
  // stretched down the screen, the button would sit at the bottom of it instead
  // of under the last row. So only the rows of a list that doesn't scroll
  // itself are as tall as they are; every view with nothing to list keeps
  // filling the space it is given, which is what keeps the spinner centred.
  // (Send's picker also embeds the list without scrolling, in a ScrollView with
  // nothing to stretch into, so it is laid out the same either way.)
  describe("fit in its parent", () => {
    const stretches = (node: ReactTestInstance | null | undefined) =>
      StyleSheet.flatten(node?.props.style)?.flexGrow === 1;

    const withState = (state: Record<string, unknown>) =>
      (useBalancesList as jest.Mock).mockReturnValue({
        balanceItems: [],
        scanResults: {},
        isLoading: false,
        error: null,
        noBalances: true,
        isRefreshing: false,
        isFunded: true,
        handleRefresh: jest.fn(),
        ...state,
      });

    it("sizes the rows of a non-scrolling list to their content", () => {
      render(
        <BalancesList
          publicKey={testPublicKey}
          network={NETWORKS.TESTNET}
          disableInnerScrolling
        />,
      );

      const wrapper = hostParentOf(
        screen.getAllByTestId("token-row-divider")[0],
      );

      expect(stretches(wrapper)).toBe(false);
    });

    // A FlatList needs a parent to scroll inside.
    it("still fills the parent of a scrolling list", () => {
      render(
        <BalancesList publicKey={testPublicKey} network={NETWORKS.TESTNET} />,
      );

      expect(stretches(hostParentOf(screen.getByTestId("balances-list")))).toBe(
        true,
      );
    });

    it.each([
      [
        "loading",
        { isLoading: true },
        () => screen.getByTestId("balances-list-spinner"),
        1,
      ],
      [
        "failed",
        { error: "Failed to load balances" },
        () => screen.getByText("balancesList.error"),
        2,
      ],
      [
        "unfunded",
        { isFunded: false },
        () => screen.getByTestId("unfunded-account-empty-state"),
        1,
      ],
    ])(
      "fills the space it is given while %s",
      (_name, state, find, levelsUp) => {
        withState(state);
        render(
          <BalancesList
            publicKey={testPublicKey}
            network={NETWORKS.PUBLIC}
            disableInnerScrolling
          />,
        );

        let wrapper: ReactTestInstance | null | undefined = find();
        for (let level = 0; level < levelsUp; level += 1) {
          wrapper = hostParentOf(wrapper);
        }

        expect(stretches(wrapper)).toBe(true);
      },
    );
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

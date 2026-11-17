import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, waitFor } from "@testing-library/react-native";
import { BaseLayout } from "components/layout/BaseLayout";
import TokenDetailsScreen from "components/screens/TokenDetailsScreen";
import { TokenChartSource } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { FormattedSearchTokenRecord } from "config/types";
import { useBalancesStore } from "ducks/balances";
import { usePriceHistoryStore } from "ducks/priceHistory";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { SectionList, View } from "react-native";
import { ReactTestInstance } from "react-test-renderer";
import { SecurityLevel } from "services/blockaid/constants";

jest.mock("components/screens/HistoryScreen/HistoryList", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SectionList: RNSectionList } = jest.requireActual("react-native");
  // A real SectionList so scroll-lock tests can read `scrollEnabled`, wrapped
  // in jest.fn so prop tests can read the call arguments.
  const MockHistoryList = jest.fn(
    ({
      ListHeaderComponent,
      scrollEnabled,
    }: {
      ListHeaderComponent?: React.ReactElement;
      scrollEnabled?: boolean;
    }) => (
      <RNSectionList
        testID="history-list"
        sections={[]}
        keyExtractor={(_item: unknown, index: number) => String(index)}
        renderItem={() => null}
        ListHeaderComponent={ListHeaderComponent}
        scrollEnabled={scrollEnabled}
      />
    ),
  );
  return MockHistoryList;
});

// Rendered lazily by the mocks below, so the hoisted factories may name it.
const mockStub = (testID: string) => <View testID={testID} />;

jest.mock("components/screens/TokenDetailsScreen/components", () => ({
  TokenBalanceHeader: () => mockStub("token-balance-header"),
  TokenBalanceDetails: () => mockStub("token-balance-details"),
  NonHeldTokenHeader: () => mockStub("non-held-token-header"),
}));

// Mock the chart section per existing practice (the screen test exercises
// layout/navigation, not the chart; the section has its own suite).
jest.mock(
  "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceHistorySection",
  () => ({
    __esModule: true,
    default: jest.fn(() => mockStub("token-price-history-section")),
  }),
);

jest.mock(
  "components/screens/TokenDetailsScreen/components/PriceHistory/TokenStatsSection",
  () => ({
    __esModule: true,
    default: () => mockStub("token-stats-section"),
  }),
);

jest.mock(
  "components/screens/TokenDetailsScreen/components/PriceHistory/AboutSection",
  () => ({
    __esModule: true,
    default: () => mockStub("about-section"),
  }),
);

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({
    account: {
      publicKey: "GACJYENHYW2LGHBNNGNZ4NCBGZYVTGTZM4CJLQIOQQ5IUZU3SYWOW5EK",
      accountName: "Test Account",
    },
  }),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    // Matches NETWORKS.PUBLIC — the scroll-lock test below inspects the
    // price-history duck under that same scope.
    network: "PUBLIC",
    setSignInMethod: jest.fn(),
  }),
  getLoginType: jest.fn((biometryType) => {
    if (!biometryType) return "password";
    if (biometryType === "FaceID" || biometryType === "Face") return "face";
    if (biometryType === "TouchID" || biometryType === "Fingerprint")
      return "fingerprint";
    return "password";
  }),
}));

const mockFetchData = jest.fn();
jest.mock("hooks/useGetHistoryData", () => ({
  useGetHistoryData: () => ({
    historyData: { history: [], balances: {} },
    fetchData: mockFetchData,
    isLoading: false,
    error: null,
    isRefreshing: false,
    isNavigationRefresh: false,
  }),
}));

jest.mock("hooks/useTokenDetails", () => ({
  __esModule: true,
  default: () => ({
    actualTokenDetails: {
      symbol: "XLM",
      name: "Stellar Lumens",
    },
    displayTitle: "Stellar Lumens (XLM)",
  }),
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string, params?: { tokenName?: string; tokenCode?: string }) => {
    const translations: Record<string, string> = {
      "tokenDetailsScreen.listHeader": `${params?.tokenName || "Token"} transaction history`,
      "tokenDetailsScreen.hideToken": `Hide ${params?.tokenCode}`,
      "hiddenTokens.hidden": `${params?.tokenCode} hidden`,
      "hiddenTokens.unhidden": `${params?.tokenCode} unhidden`,
      "manageTokenRightContent.copyAddress": "Copy address",
      "common.remove": "Remove",
    };
    return translations[key] || key;
  },
}));

jest.mock("hooks/useRightHeader", () => ({
  useRightHeaderMenu: jest.fn(),
  useRightHeaderButton: jest.fn(),
}));

type TokenDetailsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN
>;

const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();

const mockNavigation = {
  goBack: mockGoBack,
  setOptions: mockSetOptions,
} as unknown as TokenDetailsScreenProps["navigation"];

const mockRoute = {
  params: {
    tokenId: "native",
    tokenSymbol: "XLM",
  },
  key: "token-details",
  name: ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN,
} as unknown as TokenDetailsScreenProps["route"];

describe("TokenDetailsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePriceHistoryStore.setState({
      inspectedPoint: null,
      inspectingKey: null,
    });
  });

  it("displays token transaction history header", async () => {
    const { getByText } = renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(
        getByText("Stellar Lumens (XLM) transaction history"),
      ).toBeTruthy();
    });
  });

  it("sets up navigation header with correct title", () => {
    renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        headerTitle: "Stellar Lumens (XLM)",
      }),
    );
  });

  it.each([
    ["XLM", "native", true],
    [
      "a Soroban token",
      "TKN:CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      true,
    ],
    [
      "a liquidity pool share",
      "4ac86c65b9f7b175ae0493da0d36cc5bc88b72677ca69fce8fe374233983d8e7:lp",
      false,
    ],
  ])("offers Swap for %s: %s", (_, tokenId, shown) => {
    useRemoteConfigStore.setState({ swap_enabled: true });
    const route = {
      ...mockRoute,
      params: { tokenId, tokenSymbol: "TKN" },
    } as unknown as TokenDetailsScreenProps["route"];

    const screen = renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={route} />,
    );

    expect(!!screen.queryByText("tokenDetailsScreen.swap")).toBe(shown);
  });

  it("draws no divider under the Swap and Send buttons", () => {
    const screen = renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(screen.getByTestId("token-details-send-button")).toBeTruthy();
    expect(
      screen.UNSAFE_root.findAll(
        (node: ReactTestInstance) =>
          typeof node.type === "string" &&
          /\bborder-b\b/.test(String(node.props.className ?? "")),
      ),
    ).toHaveLength(0);
  });

  it("keeps the buttons the bottom inset plus 24pt above the screen's edge, as Figma does", () => {
    const screen = renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // BaseLayout's bottom inset is the safe-area inset plus 24pt.
    expect(screen.UNSAFE_getByType(BaseLayout).props.insets).toMatchObject({
      bottom: true,
    });
  });

  it("renders without crashing", () => {
    renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // The component should render successfully
    // Data loading is now handled by the store's polling mechanism
  });

  it("opts the history list into the skeleton loading placeholder", () => {
    renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={mockRoute} />,
    );
    const HistoryListMock = jest.requireMock(
      "components/screens/HistoryScreen/HistoryList",
    );
    const callArgs = HistoryListMock.mock.calls[0];
    expect(callArgs[0]).toMatchObject({ loadingPlaceholder: "skeleton" });
  });

  /* eslint-disable @typescript-eslint/naming-convention */
  it("locks the list's scroll while a drag-to-inspect is in progress", () => {
    const { UNSAFE_getByType } = renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const list = UNSAFE_getByType(SectionList);
    expect(list.props.scrollEnabled).toBe(true);

    act(() =>
      usePriceHistoryStore.getState().startInspectGesture({
        network: NETWORKS.PUBLIC,
        tokenId: "native",
      }),
    );
    expect(list.props.scrollEnabled).toBe(false);

    act(() =>
      usePriceHistoryStore
        .getState()
        .endInspectGesture({ network: NETWORKS.PUBLIC, tokenId: "native" }),
    );
    expect(list.props.scrollEnabled).toBe(true);
  });
  /* eslint-enable @typescript-eslint/naming-convention */
  it("offers neither Hide nor Remove for XLM, which pays every fee", () => {
    const { useRightHeaderMenu } = jest.requireMock("hooks/useRightHeader");

    renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const { actions } = useRightHeaderMenu.mock.calls.at(-1)[0];
    const titles = actions.map((a: { title: string }) => a.title);

    expect(titles).toEqual(["Copy address"]);
  });

  it("offers no Remove for LP shares, which can't be removed", () => {
    const { useRightHeaderMenu } = jest.requireMock("hooks/useRightHeader");
    const lpRoute = {
      params: {
        tokenId:
          "4ac86c65b9f7b175ae0493da0d36cc5bc88b72677ca69fce8fe374233983d8e7",
        tokenSymbol: "LP",
      },
      key: "token-details-lp",
      name: ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN,
    } as unknown as TokenDetailsScreenProps["route"];

    renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={lpRoute} />,
    );

    const { actions } = useRightHeaderMenu.mock.calls.at(-1)[0];
    const titles = actions.map((a: { title: string }) => a.title);

    expect(titles).not.toContain("Remove");
  });

  describe("Remove for contract tokens", () => {
    const contractId =
      "CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4";
    const kaleId = `KALE:${contractId}`;
    const kaleRoute = {
      params: { tokenId: kaleId, tokenSymbol: "KALE" },
      key: "token-details-kale",
      name: ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN,
    } as unknown as TokenDetailsScreenProps["route"];
    const kaleBalance = {
      id: kaleId,
      tokenCode: "KALE",
      tokenType: "custom_token",
      total: { isGreaterThan: () => true },
      token: { issuer: { key: contractId }, code: "KALE" },
    };

    const mockBalancesList = (localOnlyTokenIds: string[]) => {
      const { useBalancesList } = jest.requireMock("hooks/useBalancesList");
      useBalancesList.mockReturnValue({
        balanceItems: [kaleBalance],
        hiddenBalanceItems: [],
        scanResults: {},
        isLoading: false,
        error: null,
        noBalances: false,
        isRefreshing: false,
        isFunded: true,
        localOnlyTokenIds,
        handleRefresh: jest.fn(),
      });
      return useBalancesList;
    };

    const menuTitles = () => {
      const { useRightHeaderMenu } = jest.requireMock("hooks/useRightHeader");
      const { actions } = useRightHeaderMenu.mock.calls.at(-1)[0];
      return actions.map((a: { title: string }) => a.title);
    };

    afterEach(() => {
      const { useBalancesList } = jest.requireMock("hooks/useBalancesList");
      useBalancesList.mockReset();
      useBalancesList.mockReturnValue({
        balanceItems: [],
        hiddenBalanceItems: [],
        scanResults: {},
        isLoading: false,
        error: null,
        noBalances: true,
        isRefreshing: false,
        isFunded: false,
        localOnlyTokenIds: [],
        handleRefresh: jest.fn(),
      });
    });

    it("offers no Remove for a contract token the backend reports itself", () => {
      mockBalancesList([]);

      renderWithProviders(
        <TokenDetailsScreen navigation={mockNavigation} route={kaleRoute} />,
      );

      expect(menuTitles()).toEqual(["Copy address", "Hide KALE"]);
    });

    it("keeps Remove for a contract token the user added by hand", () => {
      mockBalancesList([contractId]);

      renderWithProviders(
        <TokenDetailsScreen navigation={mockNavigation} route={kaleRoute} />,
      );

      expect(menuTitles()).toEqual(["Copy address", "Hide KALE", "Remove"]);
    });
  });

  describe("hide for a non-native token", () => {
    const usdcId =
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
    const usdcRoute = {
      params: { tokenId: usdcId, tokenSymbol: "USDC" },
      key: "token-details-usdc",
      name: ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN,
    } as unknown as TokenDetailsScreenProps["route"];
    const mockHideToken = jest.fn().mockResolvedValue(undefined);

    beforeEach(() => {
      useBalancesStore.setState({
        hiddenTokenIds: [],
        hideToken: mockHideToken,
      });
    });

    it("places Hide between Copy address and Remove", () => {
      const { useRightHeaderMenu } = jest.requireMock("hooks/useRightHeader");

      renderWithProviders(
        <TokenDetailsScreen navigation={mockNavigation} route={usdcRoute} />,
      );

      const { actions } = useRightHeaderMenu.mock.calls.at(-1)[0];
      const titles = actions.map((a: { title: string }) => a.title);

      expect(titles).toEqual(["Copy address", "Hide USDC", "Remove"]);
      expect(
        actions.find((a: { title: string }) => a.title === "Remove")
          .destructive,
      ).toBe(true);
    });

    it("hides the token, goes back and confirms with a toast", async () => {
      const { useRightHeaderMenu } = jest.requireMock("hooks/useRightHeader");

      const { getByText } = renderWithProviders(
        <TokenDetailsScreen navigation={mockNavigation} route={usdcRoute} />,
      );

      const { actions } = useRightHeaderMenu.mock.calls.at(-1)[0];
      const hideAction = actions.find(
        (a: { title: string }) => a.title === "Hide USDC",
      );

      await act(async () => {
        await hideAction.onPress();
      });

      expect(mockHideToken).toHaveBeenCalledWith({
        publicKey: "GACJYENHYW2LGHBNNGNZ4NCBGZYVTGTZM4CJLQIOQQ5IUZU3SYWOW5EK",
        network: expect.any(String),
        tokenId: usdcId,
      });
      expect(mockGoBack).toHaveBeenCalled();
      await waitFor(() => {
        expect(getByText("USDC hidden")).toBeTruthy();
      });
    });
  });

  describe("no-balance variant", () => {
    const shxId =
      "SHX:GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH";
    const shxRecord = {
      tokenCode: "SHX",
      issuer: "GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH",
      domain: "stronghold.co",
      isNative: false,
      hasTrustline: false,
    } as FormattedSearchTokenRecord;
    const nonHeldRoute = (
      source: TokenChartSource,
      record: FormattedSearchTokenRecord = shxRecord,
    ) =>
      ({
        ...mockRoute,
        params: { tokenId: shxId, tokenSymbol: "SHX", record, source },
      }) as unknown as TokenDetailsScreenProps["route"];

    beforeEach(() => {
      useRemoteConfigStore.setState({
        use_token_price_history: true,
        isInitialized: true,
        swap_enabled: true,
      });
    });

    it("renders the non-held header, chart, stats and About, and no balance rows or history list", () => {
      const screen = renderWithProviders(
        <TokenDetailsScreen
          navigation={mockNavigation}
          route={nonHeldRoute(TokenChartSource.SWAP_PICKER)}
        />,
      );

      expect(screen.getByTestId("non-held-token-header")).toBeTruthy();
      expect(screen.queryByTestId("token-balance-header")).toBeNull();
      expect(screen.getByTestId("token-price-history-section")).toBeTruthy();
      expect(screen.getByTestId("token-stats-section")).toBeTruthy();
      expect(screen.getByTestId("about-section")).toBeTruthy();
      expect(screen.queryByTestId("token-balance-details")).toBeNull();
      expect(screen.queryByTestId("history-list")).toBeNull();
      expect(
        screen.queryByText("Stellar Lumens (XLM) transaction history"),
      ).toBeNull();
    });

    it("passes the route's source to the chart section", () => {
      renderWithProviders(
        <TokenDetailsScreen
          navigation={mockNavigation}
          route={nonHeldRoute(TokenChartSource.SWAP_PICKER)}
        />,
      );

      const section = jest.requireMock(
        "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceHistorySection",
      ).default;
      expect(section.mock.calls.at(-1)[0]).toMatchObject({
        source: TokenChartSource.SWAP_PICKER,
      });
    });

    it("offers only Copy address in the header menu when not opened from Home", () => {
      const { useRightHeaderMenu } = jest.requireMock("hooks/useRightHeader");

      renderWithProviders(
        <TokenDetailsScreen
          navigation={mockNavigation}
          route={nonHeldRoute(TokenChartSource.SWAP_PICKER)}
        />,
      );

      const { actions } = useRightHeaderMenu.mock.calls.at(-1)[0];
      expect(actions).toHaveLength(1);
      expect(actions[0].title).toBe("Copy address");
    });

    it("renders no Swap, Send or Swap To footer when opened from the picker", () => {
      const screen = renderWithProviders(
        <TokenDetailsScreen
          navigation={mockNavigation}
          route={nonHeldRoute(TokenChartSource.SWAP_PICKER)}
        />,
      );

      expect(screen.queryByText("tokenDetailsScreen.swap")).toBeNull();
      expect(screen.queryByTestId("token-details-send-button")).toBeNull();
      expect(screen.queryByTestId("token-details-swap-to-button")).toBeNull();
    });

    it("shows the Blockaid banner from the record when it is flagged", () => {
      const screen = renderWithProviders(
        <TokenDetailsScreen
          navigation={mockNavigation}
          route={nonHeldRoute(TokenChartSource.SWAP_PICKER, {
            ...shxRecord,
            securityLevel: SecurityLevel.MALICIOUS,
          })}
        />,
      );

      expect(
        screen.getByText("transactionAmountScreen.errors.malicious"),
      ).toBeTruthy();
    });

    it("shows no chart, stats or About when the kill switch is off", () => {
      useRemoteConfigStore.setState({
        use_token_price_history: false,
        isInitialized: true,
      });

      const screen = renderWithProviders(
        <TokenDetailsScreen
          navigation={mockNavigation}
          route={nonHeldRoute(TokenChartSource.SWAP_PICKER)}
        />,
      );

      expect(screen.getByTestId("non-held-token-header")).toBeTruthy();
      expect(screen.queryByTestId("token-price-history-section")).toBeNull();
      expect(screen.queryByTestId("token-stats-section")).toBeNull();
      expect(screen.queryByTestId("about-section")).toBeNull();
    });
  });

  describe("held token opened from the picker", () => {
    const usdcId =
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

    afterEach(() => {
      const { useBalancesList } = jest.requireMock("hooks/useBalancesList");
      useBalancesList.mockReset();
      useBalancesList.mockReturnValue({
        balanceItems: [],
        hiddenBalanceItems: [],
        scanResults: {},
        isLoading: false,
        error: null,
        noBalances: true,
        isRefreshing: false,
        isFunded: false,
        localOnlyTokenIds: [],
        handleRefresh: jest.fn(),
      });
    });

    it("renders the held variant (balance rows, history list) but a copy-only menu and no footer", () => {
      useRemoteConfigStore.setState({ swap_enabled: true });
      const { useBalancesList } = jest.requireMock("hooks/useBalancesList");
      useBalancesList.mockReturnValue({
        balanceItems: [
          {
            id: usdcId,
            tokenCode: "USDC",
            tokenType: "credit_alphanum4",
            total: { isGreaterThan: () => true },
          },
        ],
        hiddenBalanceItems: [],
        scanResults: {},
        isLoading: false,
        error: null,
        noBalances: false,
        isRefreshing: false,
        isFunded: true,
        localOnlyTokenIds: [],
        handleRefresh: jest.fn(),
      });
      const { useRightHeaderMenu } = jest.requireMock("hooks/useRightHeader");
      const route = {
        ...mockRoute,
        params: {
          tokenId: usdcId,
          tokenSymbol: "USDC",
          source: TokenChartSource.SWAP_PICKER,
        },
      } as unknown as TokenDetailsScreenProps["route"];

      const screen = renderWithProviders(
        <TokenDetailsScreen navigation={mockNavigation} route={route} />,
      );

      expect(screen.getByTestId("token-balance-header")).toBeTruthy();
      expect(screen.getByTestId("token-balance-details")).toBeTruthy();
      expect(screen.getByTestId("history-list")).toBeTruthy();
      const { actions } = useRightHeaderMenu.mock.calls.at(-1)[0];
      expect(actions.map((a: { title: string }) => a.title)).toEqual([
        "Copy address",
      ]);
      expect(screen.queryByText("tokenDetailsScreen.swap")).toBeNull();
      expect(screen.queryByTestId("token-details-send-button")).toBeNull();
    });
  });
});

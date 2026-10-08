import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, waitFor } from "@testing-library/react-native";
import TokenDetailsScreen from "components/screens/TokenDetailsScreen";
import { NETWORKS } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { usePriceHistoryStore } from "ducks/priceHistory";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { SectionList } from "react-native";

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

jest.mock("components/screens/TokenDetailsScreen/components", () => ({
  TokenBalanceHeader: () => <div data-testid="token-balance-header" />,
  TokenBalanceDetails: () => <div data-testid="token-balance-details" />,
}));

// Mock the chart section per existing practice (the screen test exercises
// layout/navigation, not the chart; the section has its own suite).
jest.mock(
  "components/screens/TokenDetailsScreen/components/PriceHistory/TokenPriceHistorySection",
  () => ({
    __esModule: true,
    default: () => <div data-testid="token-price-history-section" />,
  }),
);

jest.mock(
  "components/screens/TokenDetailsScreen/components/PriceHistory/TokenStatsSection",
  () => ({
    __esModule: true,
    default: () => <div data-testid="token-stats-section" />,
  }),
);

jest.mock(
  "components/screens/TokenDetailsScreen/components/PriceHistory/AboutSection",
  () => ({
    __esModule: true,
    default: () => <div data-testid="about-section" />,
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
  t: (key: string, params?: { tokenName?: string }) => {
    const translations: Record<string, string> = {
      "tokenDetailsScreen.listHeader": `${params?.tokenName || "Token"} transaction history`,
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

  it("renders without crashing", () => {
    renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // The component should render successfully
    // Data loading is now handled by the store's polling mechanism
  });

  it("configures a Copy address + Remove header menu", () => {
    const { useRightHeaderMenu } = jest.requireMock("hooks/useRightHeader");

    renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const { actions } = useRightHeaderMenu.mock.calls.at(-1)[0];
    const titles = actions.map((a: { title: string }) => a.title);

    expect(titles).toContain("Copy address");
    expect(titles).toContain("Remove");
    expect(
      actions.find((a: { title: string }) => a.title === "Remove").destructive,
    ).toBe(true);
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
});

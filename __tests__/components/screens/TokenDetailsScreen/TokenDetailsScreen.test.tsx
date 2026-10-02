import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { waitFor } from "@testing-library/react-native";
import TokenDetailsScreen from "components/screens/TokenDetailsScreen";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("components/screens/HistoryScreen/HistoryList", () =>
  jest.fn(
    ({ ListHeaderComponent }: { ListHeaderComponent?: React.ReactElement }) => (
      <div data-testid="history-list">{ListHeaderComponent}</div>
    ),
  ),
);

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
    network: "testnet",
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
});

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { waitFor } from "@testing-library/react-native";
import TokenDetailsScreen from "components/screens/TokenDetailsScreen";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("components/screens/HistoryScreen/HistoryList", () => {
  const MockHistoryList = ({
    ListHeaderComponent,
  }: {
    ListHeaderComponent?: React.ReactElement;
  }) => <div data-testid="history-list">{ListHeaderComponent}</div>;
  return MockHistoryList;
});

jest.mock("components/screens/TokenDetailsScreen/components", () => ({
  TokenBalanceHeader: () => <div data-testid="token-balance-header" />,
}));

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
  }),
}));

const mockFetchData = jest.fn();
jest.mock("hooks/useGetHistoryData", () => ({
  useGetHistoryData: () => ({
    historyData: { history: [], balances: {} },
    fetchData: mockFetchData,
    status: "success",
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
    };
    return translations[key] || key;
  },
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
        headerLeft: expect.any(Function),
        headerTitle: "Stellar Lumens (XLM)",
      }),
    );
  });

  it("loads transaction data on mount", async () => {
    renderWithProviders(
      <TokenDetailsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalledWith({ isRefresh: false });
    });
  });
});

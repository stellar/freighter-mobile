import { userEvent } from "@testing-library/react-native";
import { HomeScreen } from "components/screens/HomeScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("ducks/balances", () => ({
  useBalancesStore: jest.fn((selector) => {
    const mockState = {
      balances: {},
      pricedBalances: {},
      isLoading: false,
      error: null,
      fetchAccountBalances: jest
        .fn()
        .mockImplementation(() => Promise.resolve()),
    };
    return selector ? selector(mockState) : mockState;
  }),
}));

jest.mock("ducks/prices", () => ({
  usePricesStore: jest.fn(() => ({
    prices: {},
    isLoading: false,
    error: null,
    lastUpdated: null,
    fetchPricesForBalances: jest.fn(),
  })),
}));

jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
  }),
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({
    account: {
      publicKey: "test-public-key",
      accountName: "Test Account",
    },
  }),
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "home.title": "Tokens",
      "home.buy": "Buy",
      "home.send": "Send",
      "home.swap": "Swap",
      "home.copy": "Copy",
      accountAddressCopied: "Address copied",
    };
    return translations[key] || key;
  },
}));

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<HomeScreen />);
    expect(getByText("Test Account")).toBeTruthy();
  });

  it("handles clipboard copy when copy button is pressed", async () => {
    const { getByTestId } = renderWithProviders(<HomeScreen />);

    const copyButton = getByTestId("icon-button-copy");
    await userEvent.press(copyButton);

    expect(mockCopyToClipboard).toHaveBeenCalled();
  }, 10000);
});

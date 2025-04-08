import { userEvent } from "@testing-library/react-native";
import { HomeScreen } from "components/screens/HomeScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("react-native-context-menu-view", () => {
  const ContextMenu = ({
    children,
    onPress,
  }: {
    children: React.ReactNode;
    onPress?: (e: { nativeEvent: { index: number } }) => void;
  }) => {
    const handlePress = () => {
      if (onPress) {
        onPress({ nativeEvent: { index: 0 } });
      }
    };

    return (
      <button onClick={handlePress} data-testid="context-menu" type="button">
        {children}
      </button>
    );
  };

  return {
    __esModule: true,
    default: ContextMenu,
  };
});

// Mock the stores
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
    const { getByText } = renderWithProviders(
      <HomeScreen
        navigation={{ replace: jest.fn() } as never}
        route={{} as never}
      />,
    );
    expect(getByText("Test Account")).toBeTruthy();
  });

  it.skip("handles clipboard copy when copy button is pressed", async () => {
    const { getByTestId } = renderWithProviders(
      <HomeScreen
        navigation={{ replace: jest.fn() } as never}
        route={{} as never}
      />,
    );

    const copyButton = getByTestId("icon-button-copy");
    await userEvent.press(copyButton);

    expect(mockCopyToClipboard).toHaveBeenCalled();
  }, 10000);
});

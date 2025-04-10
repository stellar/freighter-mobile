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
      "home.actions.settings": "Settings",
      "home.actions.manageAssets": "Manage Assets",
      "home.actions.myQRCode": "My QR Code",
    };
    return translations[key] || key;
  },
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({
    network: "TESTNET",
  })),
}));

// Mock the hooks
jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(() => ({
    balanceItems: [],
    isLoading: false,
    error: null,
    noBalances: false,
    isRefreshing: false,
    isFunded: true,
    handleRefresh: jest.fn(),
  })),
}));

jest.mock("hooks/useTotalBalance", () => ({
  useTotalBalance: jest.fn(() => ({
    formattedBalance: "$350.75",
    totalBalance: "350.75",
  })),
}));

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with account information", () => {
    const { getByText } = renderWithProviders(
      <HomeScreen
        navigation={{ replace: jest.fn(), navigate: jest.fn() } as never}
        route={{} as never}
      />,
    );
    expect(getByText("Test Account")).toBeTruthy();
    expect(getByText("$350.75")).toBeTruthy();
  });

  it("handles clipboard copy when copy button is pressed", async () => {
    const { getByTestId } = renderWithProviders(
      <HomeScreen
        navigation={{ replace: jest.fn(), navigate: jest.fn() } as never}
        route={{} as never}
      />,
    );

    const copyButton = getByTestId("icon-button-copy");
    await userEvent.press(copyButton);

    expect(mockCopyToClipboard).toHaveBeenCalledWith("test-public-key", {
      notificationMessage: "Address copied",
    });
  }, 20000);

  it("renders action buttons correctly", () => {
    const { getByText } = renderWithProviders(
      <HomeScreen
        navigation={{ replace: jest.fn(), navigate: jest.fn() } as never}
        route={{} as never}
      />,
    );

    expect(getByText("Buy")).toBeTruthy();
    expect(getByText("Send")).toBeTruthy();
    expect(getByText("Swap")).toBeTruthy();
    expect(getByText("Copy")).toBeTruthy();
  });
});

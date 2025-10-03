import { userEvent, act } from "@testing-library/react-native";
import HomeScreen from "components/screens/HomeScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("components/primitives/Menu", () => {
  const MenuRoot = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="menu-root">{children}</div>
  );
  const MenuTrigger = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="menu-trigger">{children}</div>
  );
  const MenuContent = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="menu-content">{children}</div>
  );
  const MenuItemComponent = ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect: () => void;
  }) => (
    <button
      type="button"
      data-testid="menu-item"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onSelect();
        }
      }}
      role="menuitem"
      tabIndex={0}
    >
      {children}
    </button>
  );
  const MenuItemTitle = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="menu-item-title">{children}</div>
  );
  const MenuItemIcon = ({
    ios,
    androidIconName,
  }: {
    ios?: { name: string };
    androidIconName?: string;
  }) => <div data-testid="menu-item-icon">{ios?.name || androidIconName}</div>;

  return {
    MenuRoot,
    MenuTrigger,
    MenuContent,
    MenuItem: MenuItemComponent,
    MenuItemTitle,
    MenuItemIcon,
  };
});

// Mock the stores
const mockFetchAccountBalances = jest.fn().mockResolvedValue(undefined);
const mockFetchCollectibles = jest.fn().mockResolvedValue(undefined);
const mockFetchActiveSessions = jest.fn().mockResolvedValue(undefined);

jest.mock("ducks/balances", () => ({
  useBalancesStore: jest.fn((selector) => {
    const mockState = {
      balances: {},
      pricedBalances: {},
      isLoading: false,
      isFunded: true,
      error: null,
      fetchAccountBalances: mockFetchAccountBalances,
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

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: jest.fn(() => ({
    collections: [],
    isLoading: false,
    error: null,
    fetchCollectibles: mockFetchCollectibles,
  })),
}));

jest.mock("ducks/walletKit", () => ({
  useWalletKitStore: jest.fn(() => ({
    activeSessions: [],
    isLoading: false,
    error: null,
    fetchActiveSessions: mockFetchActiveSessions,
  })),
}));

jest.mock("ducks/remoteConfig", () => ({
  useRemoteConfigStore: jest.fn(() => ({
    swapEnabled: true,
    isLoading: false,
    error: null,
  })),
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
      "home.actions.manageTokens": "Manage Tokens",
      "home.actions.myQRCode": "My QR Code",
    };
    return translations[key] || key;
  },
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    network: "TESTNET",
    getAllAccounts: jest.fn().mockResolvedValue([]),
    renameAccount: jest.fn().mockResolvedValue(Promise.resolve()),
    selectAccount: jest.fn().mockResolvedValue(Promise.resolve()),
    isRenamingAccount: false,
    allAccounts: [{ publicKey: "GTESTPUBLICKEY", accountName: "Test Account" }],
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

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue("true"),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderHomeScreen = () =>
    renderWithProviders(
      <HomeScreen
        navigation={
          {
            replace: jest.fn(),
            navigate: jest.fn(),
            setOptions: jest.fn(),
          } as never
        }
        route={{} as never}
      />,
    );

  it("renders correctly with account information", () => {
    const { getByText } = renderHomeScreen();
    expect(getByText("Test Account")).toBeTruthy();
    expect(getByText("$350.75")).toBeTruthy();
  });

  it("handles clipboard copy when copy button is pressed", async () => {
    const { getByTestId } = renderHomeScreen();

    const copyButton = getByTestId("icon-button-copy");
    await userEvent.press(copyButton);

    expect(mockCopyToClipboard).toHaveBeenCalledWith("test-public-key", {
      notificationMessage: "Address copied",
    });
  }, 20000);

  it("renders action buttons correctly", () => {
    const { getByText } = renderHomeScreen();

    expect(getByText("Buy")).toBeTruthy();
    expect(getByText("Send")).toBeTruthy();
    expect(getByText("Copy")).toBeTruthy();
  });

  it("calls all fetch functions when refresh is triggered", async () => {
    const { getByTestId } = renderHomeScreen();

    const scrollView = getByTestId("home-screen-scrollview");

    const { refreshControl } = scrollView.props;

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(mockFetchAccountBalances).toHaveBeenCalledWith({
      publicKey: "test-public-key",
      network: "TESTNET",
    });
    expect(mockFetchCollectibles).toHaveBeenCalledWith({
      publicKey: "test-public-key",
      network: "TESTNET",
    });
    expect(mockFetchActiveSessions).toHaveBeenCalledWith(
      "test-public-key",
      "TESTNET",
    );
  });
});

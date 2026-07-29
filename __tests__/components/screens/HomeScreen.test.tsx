import { fireEvent, act } from "@testing-library/react-native";
import HomeScreen from "components/screens/HomeScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  BottomSheetModal: "View",
  BottomSheetTextInput: "input",
  BottomSheetView: "View",
  BottomSheetScrollView: "ScrollView",
  BottomSheetFlatList: "FlatList",
  BottomSheetSectionList: "SectionList",
  BottomSheetDraggableView: "View",
  BottomSheetBackdrop: "View",
}));

jest.mock("components/sds/Icon", () => ({
  __esModule: true,
  default: new Proxy({}, { get: () => "View" }),
}));

jest.mock("components/screens/HomeScreen/ManageAccountBottomSheet", () => ({
  __esModule: true,
  default: function MockManageAccountBottomSheet() {
    return null;
  },
  ManageAccountSheetHeader: function MockManageAccountSheetHeader() {
    return null;
  },
}));

jest.mock("components/screens/HomeScreen/ConnectedApps", () => ({
  __esModule: true,
  default: function MockConnectedApps() {
    return null;
  },
}));

jest.mock("components/analytics/DebugBottomSheet", () => ({
  DebugBottomSheet: function MockDebugBottomSheet() {
    return null;
  },
}));

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

// Mutable so tests can simulate the initial balances fetch settling
// (read lazily at render time, after jest hoisting).
let mockIsLoadingBalances = false;

jest.mock("ducks/balances", () => ({
  useBalancesStore: jest.fn((selector) => {
    const mockState = {
      balances: {},
      pricedBalances: {},
      isLoading: mockIsLoadingBalances,
      isFunded: true,
      error: null,
      fetchAccountBalances: mockFetchAccountBalances,
    };
    return selector ? selector(mockState) : mockState;
  }),
}));

jest.mock("ducks/prices", () => ({
  usePricesStore: jest.fn(() => ({
    pricesByNetwork: {},
    sourceByNetwork: {},
    isLoading: false,
    error: null,
    lastUpdated: null,
    fetchPricesForBalances: jest.fn(),
  })),
  usePricesForNetwork: jest.fn(() => ({})),
}));

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: jest.fn((selector) => {
    const mockState = {
      collections: [],
      isLoading: false,
      error: null,
      fetchCollectibles: mockFetchCollectibles,
    };
    return selector ? selector(mockState) : mockState;
  }),
}));

jest.mock("ducks/walletKit", () => ({
  useWalletKitStore: jest.fn(() => ({
    activeSessions: [],
    isLoading: false,
    error: null,
    fetchActiveSessions: mockFetchActiveSessions,
  })),
  StellarRpcMethods: {
    SIGN_XDR: "stellar_signXDR",
    SIGN_AND_SUBMIT_XDR: "stellar_signAndSubmitXDR",
    SIGN_MESSAGE: "stellar_signMessage",
    SIGN_AUTH_ENTRY: "stellar_signAuthEntry",
  },
  StellarRpcEvents: {
    ACCOUNTS_CHANGED: "accountsChanged",
  },
  StellarRpcChains: {},
  WALLET_KIT_METADATA: {},
  WALLET_KIT_PROJECT_ID: "test-project-id",
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
      "home.buy": "Add",
      "home.send": "Send",
      "home.swap": "Swap",
      accountAddressCopied: "Address copied",
      "home.actions.settings": "Settings",
      "home.actions.manageTokens": "Manage Tokens",
      "home.actions.myQRCode": "My QR Code",
    };
    return translations[key] || key;
  },
}));

const mockFetchAccountsFiatTotals = jest.fn().mockResolvedValue(undefined);
jest.mock("ducks/accountsFiatTotals", () => ({
  // State is built per call so the jest-hoisted factory doesn't capture
  // mockFetchAccountsFiatTotals before its const initializes.
  useAccountsFiatTotalsStore: (
    selector?: (storeState: Record<string, unknown>) => unknown,
  ) => {
    const state = {
      fiatTotals: {},
      isLoading: false,
      fetchAccountsFiatTotals: mockFetchAccountsFiatTotals,
      syncAccountFiatTotal: jest.fn(),
    };

    return selector ? selector(state) : state;
  },
}));

// Mutable so tests can simulate a network switch (read lazily at render
// time, after jest hoisting).
let mockNetwork = "TESTNET";

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: (
    selector?: (storeState: Record<string, unknown>) => unknown,
  ) => {
    const state = {
      network: mockNetwork,
      getAllAccounts: jest.fn().mockResolvedValue([]),
      renameAccount: jest.fn().mockResolvedValue(Promise.resolve()),
      selectAccount: jest.fn().mockResolvedValue(Promise.resolve()),
      isRenamingAccount: false,
      allAccounts: [
        { publicKey: "GTESTPUBLICKEY", accountName: "Test Account" },
      ],
      setSignInMethod: jest.fn(),
    };

    return selector ? selector(state) : state;
  },
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
    hasFiatTotal: true,
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
    mockIsLoadingBalances = false;
    mockNetwork = "TESTNET";
  });

  const buildProps = () => ({
    navigation: {
      replace: jest.fn(),
      navigate: jest.fn(),
      setOptions: jest.fn(),
    } as never,
    route: {} as never,
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

  it("renders the total fiat balance", () => {
    const { getByText } = renderHomeScreen();
    expect(getByText("$350.75")).toBeTruthy();
  });

  it("shows a zero fiat total when no balance is priced", () => {
    const { useTotalBalance } = jest.requireMock("hooks/useTotalBalance");
    useTotalBalance.mockReturnValueOnce({
      formattedBalance: "$0.00",
      totalBalance: "0",
      hasFiatTotal: false,
    });

    const { getByText } = renderHomeScreen();

    expect(getByText("$0.00")).toBeTruthy();
  });

  it("renders action buttons correctly, without the removed copy button", () => {
    const { getByText, queryByTestId } = renderHomeScreen();

    expect(getByText("Add")).toBeTruthy();
    expect(getByText("Send")).toBeTruthy();
    // Copy moved into the manage-accounts sheet
    expect(queryByTestId("icon-button-copy")).toBeNull();
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
    expect(mockFetchAccountsFiatTotals).toHaveBeenCalledWith({
      publicKeys: ["GTESTPUBLICKEY"],
      network: "TESTNET",
      forceRefresh: true,
      excludePublicKey: "test-public-key",
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

  it("warms up the wallets-list fiat totals once the balances fetch settles", () => {
    mockIsLoadingBalances = true;
    const { rerender } = renderWithProviders(<HomeScreen {...buildProps()} />);

    // Balances are still loading — the warm-up must wait its turn.
    expect(mockFetchAccountsFiatTotals).not.toHaveBeenCalled();

    mockIsLoadingBalances = false;
    // Fresh props so React.memo doesn't bail out of the re-render.
    rerender(<HomeScreen {...buildProps()} />);

    expect(mockFetchAccountsFiatTotals).toHaveBeenCalledWith({
      publicKeys: ["GTESTPUBLICKEY"],
      network: "TESTNET",
      excludePublicKey: "test-public-key",
    });

    // One-shot per network: later balances polls must not re-trigger it.
    mockIsLoadingBalances = true;
    rerender(<HomeScreen {...buildProps()} />);
    mockIsLoadingBalances = false;
    rerender(<HomeScreen {...buildProps()} />);

    expect(mockFetchAccountsFiatTotals).toHaveBeenCalledTimes(1);
  });

  it("re-warms the wallets-list fiat totals after a network switch", () => {
    mockIsLoadingBalances = true;
    const { rerender } = renderWithProviders(<HomeScreen {...buildProps()} />);
    mockIsLoadingBalances = false;
    rerender(<HomeScreen {...buildProps()} />);
    expect(mockFetchAccountsFiatTotals).toHaveBeenCalledTimes(1);

    // Switching networks refetches balances for the new network; once they
    // settle, the totals warm up again so the sheet opens with the right
    // values instead of the previous network's.
    mockNetwork = "PUBLIC";
    mockIsLoadingBalances = true;
    rerender(<HomeScreen {...buildProps()} />);
    mockIsLoadingBalances = false;
    rerender(<HomeScreen {...buildProps()} />);

    expect(mockFetchAccountsFiatTotals).toHaveBeenCalledTimes(2);
    expect(mockFetchAccountsFiatTotals).toHaveBeenLastCalledWith(
      expect.objectContaining({ network: "PUBLIC" }),
    );
  });

  describe("HomeScreen floating add buttons", () => {
    it("shows Add token on the tokens tab and Add collectible after switching", () => {
      const { getByTestId, queryByTestId } = renderHomeScreen();

      // Tokens tab is the default
      expect(getByTestId("home-add-token-button")).toBeTruthy();
      expect(queryByTestId("home-add-collectible-button")).toBeNull();

      // Switch to the collectibles tab
      fireEvent.press(getByTestId("tab-collectibles"));

      expect(getByTestId("home-add-collectible-button")).toBeTruthy();
      expect(queryByTestId("home-add-token-button")).toBeNull();
    });
  });
});

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
// (read lazily at render time, after jest hoisting). Declared ahead of the
// store mocks below, which close over them.
let mockNetwork = "TESTNET";
let mockIsLoadingBalances = false;
// Drives the tokens tab's empty state, which decides both tabs' button style.
let mockIsFunded = true;

jest.mock("ducks/balances", () => ({
  useBalancesStore: jest.fn((selector) => {
    const mockState = {
      balances: {},
      pricedBalances: {},
      isLoading: mockIsLoadingBalances,
      isFunded: mockIsFunded,
      error: null,
      fetchAccountBalances: mockFetchAccountBalances,
    };
    return selector ? selector(mockState) : mockState;
  }),
}));

// Mutable so tests can simulate the balances store's 3s price-timeout path
// (balances settled, quotes still in flight).
let mockIsPricesLoading = false;

jest.mock("ducks/prices", () => ({
  usePricesStore: jest.fn((selector) => {
    const mockState = {
      pricesByNetwork: {},
      sourceByNetwork: {},
      isLoading: mockIsPricesLoading,
      error: null,
      lastUpdated: null,
      fetchPricesForBalances: jest.fn(),
    };
    return selector ? selector(mockState) : mockState;
  }),
  usePricesForNetwork: jest.fn(() => ({})),
}));

// Mutable so tests can land a collectible without funding the account.
let mockCollections: unknown[] = [];
// The error and loading branches both pre-empt the grid's empty view, which is
// where the CTA mounts — so both need exercising.
let mockCollectiblesError: string | null = null;
let mockIsCollectiblesLoading = false;

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: jest.fn((selector) => {
    const mockState = {
      collections: mockCollections,
      isLoading: mockIsCollectiblesLoading,
      error: mockCollectiblesError,
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
    // An unfunded account has no balances, hence the empty state.
    noBalances: !mockIsFunded,
    isRefreshing: false,
    isFunded: mockIsFunded,
    handleRefresh: jest.fn(),
  })),
}));

jest.mock("hooks/useTotalBalance", () => ({
  useTotalBalance: jest.fn(() => ({
    totalLabel: "$350.75",
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
    mockIsPricesLoading = false;
    mockNetwork = "TESTNET";
    mockIsFunded = true;
    mockCollections = [];
    mockCollectiblesError = null;
    mockIsCollectiblesLoading = false;
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
      totalLabel: "$0.00",
      totalBalance: "0",
      hasFiatTotal: false,
    });

    const { getByText } = renderHomeScreen();

    expect(getByText("$0.00")).toBeTruthy();
  });

  it("shows the placeholder when a funded account's prices fail", () => {
    // Nothing is loading anymore, so the hero commits to a label — and a
    // confident $0.00 would misreport a funded wallet as empty.
    const { useTotalBalance } = jest.requireMock("hooks/useTotalBalance");
    useTotalBalance.mockReturnValueOnce({
      totalLabel: "--",
      totalBalance: "0",
      hasFiatTotal: false,
    });

    const { getByText, queryByText, queryByTestId } = renderHomeScreen();

    expect(getByText("--")).toBeTruthy();
    expect(queryByText("$0.00")).toBeNull();
    expect(queryByTestId("home-fiat-total-spinner")).toBeNull();
  });

  it("shows a spinner instead of a placeholder $0.00 while balances load", () => {
    const { useTotalBalance } = jest.requireMock("hooks/useTotalBalance");
    useTotalBalance.mockReturnValue({
      totalLabel: "$0.00",
      totalBalance: "0",
      hasFiatTotal: false,
    });
    mockIsLoadingBalances = true;

    const { getByTestId, queryByText } = renderHomeScreen();

    expect(getByTestId("home-fiat-total-spinner")).toBeTruthy();
    expect(queryByText("$0.00")).toBeNull();

    useTotalBalance.mockReturnValue({
      totalLabel: "$350.75",
      totalBalance: "350.75",
      hasFiatTotal: true,
    });
  });

  it("keeps the hero spinner through the price-timeout window", () => {
    // Balances settled unpriced (the store's 3s timeout path) while the
    // quotes are still in flight — the hero must not flash $0.00.
    const { useTotalBalance } = jest.requireMock("hooks/useTotalBalance");
    useTotalBalance.mockReturnValueOnce({
      totalLabel: "$0.00",
      totalBalance: "0",
      hasFiatTotal: false,
    });
    mockIsLoadingBalances = false;
    mockIsPricesLoading = true;

    const { getByTestId, queryByText } = renderHomeScreen();

    expect(getByTestId("home-fiat-total-spinner")).toBeTruthy();
    expect(queryByText("$0.00")).toBeNull();
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

  describe("HomeScreen add button style", () => {
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

    // Tokens tab is in its empty state, so collectibles matches that style.
    it("puts the collectibles CTA in the empty state while the account is unfunded", () => {
      mockIsFunded = false;

      const { getByTestId, queryByTestId } = renderHomeScreen();

      fireEvent.press(getByTestId("tab-collectibles"));

      expect(getByTestId("add-collectible-empty-state-button")).toBeTruthy();
      expect(queryByTestId("home-add-collectible-button")).toBeNull();
    });

    it("keeps the collectibles pill and drops its CTA once the account is funded", () => {
      mockIsFunded = true;

      const { getByTestId, queryByTestId } = renderHomeScreen();

      fireEvent.press(getByTestId("tab-collectibles"));

      expect(getByTestId("home-add-collectible-button")).toBeTruthy();
      expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
    });

    // Guards the invariant: a pill and a CTA are never on screen together.
    it("shows no pill on either tab while the account is unfunded", () => {
      mockIsFunded = false;

      const { getByTestId, queryByTestId } = renderHomeScreen();

      expect(queryByTestId("home-add-token-button")).toBeNull();

      fireEvent.press(getByTestId("tab-collectibles"));

      expect(queryByTestId("home-add-collectible-button")).toBeNull();
    });

    // Regression: the CTA can only mount inside the empty state, so with a
    // populated grid the pill has to stay or the tab offers nothing at all.
    // Holding a collectible needs no funded account, so this is reachable.
    it("keeps the pill when unfunded but the grid has content", () => {
      mockIsFunded = false;
      mockCollections = [
        {
          collectionAddress: "CCOLLECTION",
          collectionName: "Test Collection",
          count: 1,
          items: [{ tokenId: "1", isHidden: false }],
        },
      ];

      const { getByTestId, queryByTestId } = renderHomeScreen();

      fireEvent.press(getByTestId("tab-collectibles"));

      // No empty state to host the CTA, so the pill is the only affordance.
      expect(getByTestId("home-add-collectible-button")).toBeTruthy();
      expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
    });

    // Regression: the error view replaces the empty state, so the pill standing
    // down used to leave the tab with nothing at all.
    it("keeps an Add affordance when unfunded and the collectibles fetch failed", () => {
      mockIsFunded = false;
      mockCollectiblesError = "Error loading collectibles";

      const { getByTestId } = renderHomeScreen();

      fireEvent.press(getByTestId("tab-collectibles"));

      // The CTA now rides along in the error view.
      expect(getByTestId("add-collectible-empty-state-button")).toBeTruthy();
    });

    // Hidden items aren't on the visible grid, so it still renders its empty
    // state — which means the CTA hosts the action and the pill stands down.
    it("treats a grid of only hidden collectibles as empty", () => {
      mockIsFunded = false;
      mockCollections = [
        {
          collectionAddress: "CCOLLECTION",
          collectionName: "Test Collection",
          count: 1,
          items: [{ tokenId: "1", isHidden: true }],
        },
      ];

      const { getByTestId, queryByTestId } = renderHomeScreen();

      fireEvent.press(getByTestId("tab-collectibles"));

      expect(getByTestId("add-collectible-empty-state-button")).toBeTruthy();
      expect(queryByTestId("home-add-collectible-button")).toBeNull();
    });
  });
});

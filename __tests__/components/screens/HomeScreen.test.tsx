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
// Mutable so tests can put the wallet in the completely-empty state that moves
// the Add CTA from the floating pill into each tab's empty state.
let mockIsFunded = true;
// Whether each store has reported for the active account yet — the guard that
// keeps the CTA from flashing into the wrong place on a cold start.
let mockBalancesReported = true;
let mockCollectiblesReported = true;
// A failed fetch counts as having reported, so the placement still resolves.
let mockCollectiblesError: string | null = null;

jest.mock("ducks/balances", () => ({
  useBalancesStore: jest.fn((selector) => {
    const mockState = {
      balances: {},
      pricedBalances: {},
      isLoading: mockIsLoadingBalances,
      isFunded: mockIsFunded,
      error: null,
      // Stamped for the active account by default: most tests care about the
      // settled state, and Home shows no Add affordance until both stores have
      // reported. mockBalancesReported flips it back to "not yet".
      fetchedPublicKey: mockBalancesReported ? "test-public-key" : null,
      fetchedNetwork: mockBalancesReported ? mockNetwork : null,
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

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: jest.fn((selector) => {
    const mockState = {
      collections: mockCollections,
      isLoading: false,
      error: mockCollectiblesError,
      fetchedPublicKey: mockCollectiblesReported ? "test-public-key" : null,
      fetchedNetwork: mockCollectiblesReported ? mockNetwork : null,
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
    // Mirrors mockIsFunded: an unfunded account has no balances, which is what
    // makes the tokens tab render its empty state.
    noBalances: !mockIsFunded,
    isRefreshing: false,
    isFunded: mockIsFunded,
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
    mockIsPricesLoading = false;
    mockNetwork = "TESTNET";
    mockIsFunded = true;
    mockCollections = [];
    mockBalancesReported = true;
    mockCollectiblesReported = true;
    mockCollectiblesError = null;
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

  it("shows a spinner instead of a placeholder $0.00 while balances load", () => {
    const { useTotalBalance } = jest.requireMock("hooks/useTotalBalance");
    useTotalBalance.mockReturnValue({
      formattedBalance: "$0.00",
      totalBalance: "0",
      hasFiatTotal: false,
    });
    mockIsLoadingBalances = true;

    const { getByTestId, queryByText } = renderHomeScreen();

    expect(getByTestId("home-fiat-total-spinner")).toBeTruthy();
    expect(queryByText("$0.00")).toBeNull();

    useTotalBalance.mockReturnValue({
      formattedBalance: "$350.75",
      totalBalance: "350.75",
      hasFiatTotal: true,
    });
  });

  it("keeps the hero spinner through the price-timeout window", () => {
    // Balances settled unpriced (the store's 3s timeout path) while the
    // quotes are still in flight — the hero must not flash $0.00.
    const { useTotalBalance } = jest.requireMock("hooks/useTotalBalance");
    useTotalBalance.mockReturnValueOnce({
      formattedBalance: "$0.00",
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

    // The whole point of the coupling: an empty wallet gets a CTA inside each
    // tab, and neither tab gets a pill.
    it("hands the CTA to both empty states while the wallet is empty", () => {
      mockNetwork = "PUBLIC";
      mockIsFunded = false;
      mockCollections = [];

      const { getByTestId, queryByTestId } = renderHomeScreen();

      expect(queryByTestId("home-add-token-button")).toBeNull();
      expect(getByTestId("fund-account-empty-state-button")).toBeTruthy();

      fireEvent.press(getByTestId("tab-collectibles"));

      expect(queryByTestId("home-add-collectible-button")).toBeNull();
      expect(getByTestId("add-collectible-empty-state-button")).toBeTruthy();
    });

    // One collectible is enough to flip BOTH tabs over to the pill, so the
    // tokens tab must not keep its in-empty-state CTA.
    it("switches both tabs to pills once a collectible lands", () => {
      mockNetwork = "PUBLIC";
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

      expect(getByTestId("home-add-token-button")).toBeTruthy();
      expect(queryByTestId("fund-account-empty-state-button")).toBeNull();

      fireEvent.press(getByTestId("tab-collectibles"));

      expect(getByTestId("home-add-collectible-button")).toBeTruthy();
      expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
    });

    // Adding a token needs XLM for the trustline reserve, so while the tokens
    // tab is still empty the pill offers funding instead of "Add token".
    it("labels the tokens pill Add XLM while the account is unfunded", () => {
      mockNetwork = "PUBLIC";
      mockIsFunded = false;
      mockCollections = [
        {
          collectionAddress: "CCOLLECTION",
          collectionName: "Test Collection",
          count: 1,
          items: [{ tokenId: "1", isHidden: false }],
        },
      ];

      const { getByTestId } = renderHomeScreen();

      expect(
        getByTestId("home-add-token-button").props.accessibilityLabel,
      ).toBe("balancesList.unfundedAccount.fundAccountButton");
    });

    it("labels the tokens pill Add token once the account is funded", () => {
      mockIsFunded = true;

      const { getByTestId } = renderHomeScreen();

      expect(
        getByTestId("home-add-token-button").props.accessibilityLabel,
      ).toBe("balancesList.addTokenButton");
    });

    // Regression: a wallet holding a collectible but no tokens used to show
    // the tokens empty state's CTA and then swap it for the pill, because an
    // unreported collectibles store looks exactly like an empty one.
    it("shows no CTA and no pill until the collectibles store has reported", () => {
      mockNetwork = "PUBLIC";
      mockIsFunded = false;
      mockCollectiblesReported = false;
      // What the store looks like before its first fetch lands: empty, and
      // not loading.
      mockCollections = [];

      const { queryByTestId } = renderHomeScreen();

      expect(queryByTestId("fund-account-empty-state-button")).toBeNull();
      expect(queryByTestId("home-add-token-button")).toBeNull();
    });

    // Regression: requiring both stores delayed the pill by a whole fetch on
    // every launch of a funded wallet. A funded account is provably not empty,
    // so collectibles can't change the placement and it shouldn't wait on them.
    it("shows the tokens pill as soon as balances report for a funded account", () => {
      mockIsFunded = true;
      mockCollectiblesReported = false;
      mockCollections = [];

      const { getByTestId, queryByTestId } = renderHomeScreen();

      expect(getByTestId("home-add-token-button")).toBeTruthy();
      expect(queryByTestId("fund-account-empty-state-button")).toBeNull();
    });

    it("shows the collectibles pill too without waiting on collectibles", () => {
      mockIsFunded = true;
      mockCollectiblesReported = false;

      const { getByTestId, queryByTestId } = renderHomeScreen();

      fireEvent.press(getByTestId("tab-collectibles"));

      expect(getByTestId("home-add-collectible-button")).toBeTruthy();
      expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
    });

    it("shows no CTA and no pill until the balances store has reported", () => {
      mockNetwork = "PUBLIC";
      mockIsFunded = false;
      mockBalancesReported = false;

      const { queryByTestId } = renderHomeScreen();

      expect(queryByTestId("fund-account-empty-state-button")).toBeNull();
      expect(queryByTestId("home-add-token-button")).toBeNull();
    });

    // A fetch that failed still counts as reported — waiting longer teaches us
    // nothing, and no Add affordance at all would be worse.
    it("commits to a placement once a fetch has failed", () => {
      mockNetwork = "PUBLIC";
      mockIsFunded = false;
      mockCollectiblesReported = false;
      mockCollectiblesError = "boom";

      const { getByTestId } = renderHomeScreen();

      expect(getByTestId("fund-account-empty-state-button")).toBeTruthy();
    });

    // Hidden collectibles are not holdings the user can see on the tab, so
    // they must not flip the wallet out of its empty state.
    it("treats a wallet holding only hidden collectibles as empty", () => {
      mockNetwork = "PUBLIC";
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

      expect(queryByTestId("home-add-token-button")).toBeNull();
      expect(getByTestId("fund-account-empty-state-button")).toBeTruthy();
    });
  });
});

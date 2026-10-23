import { HeaderHeightContext } from "@react-navigation/elements";
import { fireEvent, act, within } from "@testing-library/react-native";
import { getFloatingTabBarClearance } from "components/FloatingTabBar/geometry";
import { getNavigationHeaderHeight } from "components/layout/CustomNavigationHeader";
import HomeScreen from "components/screens/HomeScreen";
import { MANAGE_TOKENS_ROUTES, ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { hostParentOf, renderWithProviders } from "helpers/testUtils";
import React from "react";
import * as RN from "react-native";
import { StyleSheet } from "react-native";
import { ReactTestInstance } from "react-test-renderer";

// Mutable so a test can give the screen a home indicator's inset.
let mockBottomInset = 0;

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({
    top: 0,
    bottom: mockBottomInset,
    left: 0,
    right: 0,
  }),
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

// NativeWind doesn't turn classes into styles in tests, so a view's classes
// are read off its `className`. They are arbitrary values on purpose: with its
// rem at 14, `px-6` comes out at 21pt, not Figma's 24.
const classesOf = (node: ReactTestInstance | null | undefined) =>
  ((node?.props.className as string | undefined) ?? "").split(" ");

// The box holds the spinner as well as the total, so it stays at the total's
// line height for the two to swap without moving what is below. The header
// bar's own bottom padding is the gap above it, so the box adds none.
const expectTotalBox = (box: ReactTestInstance | null | undefined) => {
  expect(StyleSheet.flatten(box?.props.style)).toMatchObject({ height: 56 });
  expect(classesOf(box)).toEqual(
    expect.arrayContaining(["w-full", "px-[16px]"]),
  );
  expect(classesOf(box).filter((name) => /^pt-/.test(name))).toEqual([]);
};

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
    mockBottomInset = 0;
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

  it("shows the total in Display/LG/600", () => {
    const { getByText } = renderHomeScreen();

    const style = StyleSheet.flatten(getByText("$350.75").props.style);

    expect(style).toMatchObject({
      fontSize: 48,
      lineHeight: 56,
      fontWeight: "600",
    });
    // Figma sets the total's letter spacing to -4%, which React Native takes
    // in points: -0.04 * 48. fsValue is the identity in Jest.
    expect(style.letterSpacing).toBeCloseTo(-1.92, 5);
  });

  it("shrinks a long total to fit one line, so it never wraps out of its box", () => {
    const { getByText } = renderHomeScreen();

    // The box is fixed to one 56pt line: a second line would spill onto the
    // action tiles. React Native shrinks the text to fit, to 60% at most.
    expect(getByText("$350.75").props).toMatchObject({
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.6,
    });
  });

  it("keeps the total in a box as tall as its 56pt line, with 16pt sides and no padding above", () => {
    const { getByText } = renderHomeScreen();

    expectTotalBox(hostParentOf(getByText("$350.75")));
  });

  it("keeps the spinner in that same box, so swapping them shifts nothing", () => {
    const { useTotalBalance } = jest.requireMock("hooks/useTotalBalance");
    useTotalBalance.mockReturnValueOnce({
      totalLabel: "$0.00",
      totalBalance: "0",
      hasFiatTotal: false,
    });
    mockIsLoadingBalances = true;

    const { getByTestId } = renderHomeScreen();

    expectTotalBox(hostParentOf(getByTestId("home-fiat-total-spinner")));
  });

  it("lays the action row out with 16pt sides and 24pt above and below", () => {
    const { getByTestId } = renderHomeScreen();

    const row = hostParentOf(getByTestId("icon-button-buy"));

    expect(hostParentOf(getByTestId("icon-button-send"))).toBe(row);
    expect(classesOf(row)).toEqual(
      expect.arrayContaining([
        "flex-row",
        "gap-[12px]",
        "w-full",
        "px-[16px]",
        "mt-[24px]",
        "mb-[24px]",
      ]),
    );
    // Nothing else pads the row: the old `px-6 py-6` must not linger beside
    // the new classes.
    expect(classesOf(row).filter((name) => /^p[xy]?-/.test(name))).toEqual([
      "px-[16px]",
    ]);
  });

  it("ends the scroll content with the pill's clearance", () => {
    // The iPhone 17 Pro's home indicator, so a clearance that ignored the
    // inset would show.
    mockBottomInset = 34;

    const { getByTestId } = renderHomeScreen();

    // The screen runs under the floating tab bar, so the content ends this
    // far up for the inline add button to scroll clear of the pill. It still
    // grows to the viewport, so the empty states keep centring in it.
    expect(
      StyleSheet.flatten(
        getByTestId("home-screen-scrollview").props.contentContainerStyle,
      ),
    ).toMatchObject({
      paddingBottom: getFloatingTabBarClearance(mockBottomInset),
    });
  });

  // The header floats over the screen (useHomeHeaders), so the content and
  // the pull-to-refresh spinner start under it.
  describe("under the floating header", () => {
    const renderUnderHeader = (headerHeight?: number) =>
      renderWithProviders(
        <HeaderHeightContext.Provider value={headerHeight}>
          <HomeScreen
            navigation={
              {
                replace: jest.fn(),
                navigate: jest.fn(),
                setOptions: jest.fn(),
              } as never
            }
            route={{} as never}
          />
        </HeaderHeightContext.Provider>,
      );

    const scrollView = (view: ReturnType<typeof renderUnderHeader>) =>
      view.getByTestId("home-screen-scrollview");

    // Where the content and the spinner start, as useScrollUnderHeader puts
    // them: an inset on iOS (the spinner follows it), padding and an offset
    // spinner on Android.
    const contentTop = (view: ReturnType<typeof renderUnderHeader>) => {
      const { props } = scrollView(view);
      return RN.Platform.OS === "ios"
        ? {
            inset: props.contentInset?.top,
            offset: props.contentOffset?.y,
            padding: StyleSheet.flatten(props.contentContainerStyle).paddingTop,
            spinner: props.refreshControl.props.progressViewOffset,
          }
        : {
            padding: StyleSheet.flatten(props.contentContainerStyle).paddingTop,
            spinner: props.refreshControl.props.progressViewOffset,
          };
    };

    afterEach(() => jest.restoreAllMocks());

    it("starts the content below the header the navigator measured, on iOS by an inset", () => {
      // An update banner makes the header taller than the bar alone.
      const view = renderUnderHeader(180);

      expect(contentTop(view)).toEqual({
        inset: 180,
        offset: -180,
        padding: undefined,
        spinner: undefined,
      });
    });

    it("pads the content and offsets the spinner by the header on Android", () => {
      jest.replaceProperty(RN.Platform, "OS", "android");

      const view = renderUnderHeader(180);

      expect(contentTop(view)).toEqual({ padding: 180, spinner: 180 });
    });

    it("never starts above the bar's own height", () => {
      // Before it measures the header, the navigator reports a generic
      // height that's shorter than the bar, and without a navigator there's
      // none. The test's top inset is 0, so the row starts at 45.
      const barHeight = getNavigationHeaderHeight(0);

      [undefined, 60].forEach((reported) => {
        const view = renderUnderHeader(reported);

        expect(contentTop(view)).toMatchObject({
          inset: barHeight,
          offset: -barHeight,
        });
        view.unmount();
      });
    });
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
    // A collection the grid shows, for the tests that need the grid to have
    // content (Add collectible only follows a grid with content).
    const visibleCollection = {
      collectionAddress: "CCOLLECTION",
      collectionName: "Test Collection",
      count: 1,
      items: [{ tokenId: "1", isHidden: false }],
    };

    it("shows Add token on the tokens tab and Add collectible after switching", () => {
      mockCollections = [visibleCollection];

      const { getByTestId, queryByTestId } = renderHomeScreen();

      // Tokens tab is the default
      expect(getByTestId("home-add-token-button")).toBeTruthy();
      expect(queryByTestId("home-add-collectible-button")).toBeNull();

      // Switch to the collectibles tab
      fireEvent.press(getByTestId("tab-collectibles"));

      expect(getByTestId("home-add-collectible-button")).toBeTruthy();
      expect(queryByTestId("home-add-token-button")).toBeNull();
    });

    // Figma puts Add Collectible inside the empty card (?node-id=372-11772),
    // whatever the tokens tab shows, so the card always carries the action
    // and Add collectible stands down.
    it.each([
      ["unfunded", false],
      ["funded", true],
    ])(
      "puts the button in the empty collectibles card while %s, without Add collectible",
      (_name, isFunded) => {
        mockIsFunded = isFunded;

        const { getByTestId, queryByTestId } = renderHomeScreen();

        fireEvent.press(getByTestId("tab-collectibles"));

        expect(
          within(getByTestId("collectibles-empty-state")).getByTestId(
            "add-collectible-empty-state-button",
          ),
        ).toBeTruthy();
        expect(queryByTestId("home-add-collectible-button")).toBeNull();
      },
    );

    it("shows no Add token button while the account is unfunded", () => {
      mockIsFunded = false;

      const { queryByTestId } = renderHomeScreen();

      expect(queryByTestId("home-add-token-button")).toBeNull();
    });

    // The card only shows on an empty grid, so a grid with content ends with
    // Add collectible instead. Holding a collectible needs no funded account,
    // so that's reachable unfunded too.
    it.each([
      ["unfunded", false],
      ["funded", true],
    ])(
      "ends a grid with content with Add collectible while %s",
      (_name, isFunded) => {
        mockIsFunded = isFunded;
        mockCollections = [visibleCollection];

        const { getByTestId, queryByTestId } = renderHomeScreen();

        fireEvent.press(getByTestId("tab-collectibles"));

        expect(getByTestId("home-add-collectible-button")).toBeTruthy();
        expect(queryByTestId("add-collectible-empty-state-button")).toBeNull();
      },
    );

    // The error view replaces the grid, so it carries the button, and Add
    // collectible stands down so the two are never on screen together.
    it.each([
      ["nothing", []],
      ["collectibles from an earlier fetch", [visibleCollection]],
    ])(
      "offers the error view's button alone when the fetch fails with %s loaded",
      (_name, collections) => {
        mockCollections = collections;
        mockCollectiblesError = "Error loading collectibles";

        const { getByTestId, queryByTestId } = renderHomeScreen();

        fireEvent.press(getByTestId("tab-collectibles"));

        expect(getByTestId("add-collectible-empty-state-button")).toBeTruthy();
        expect(queryByTestId("home-add-collectible-button")).toBeNull();
      },
    );

    // Hidden items aren't on the visible grid, so it still renders its empty
    // card, which carries the button.
    it("treats a grid of only hidden collectibles as empty", () => {
      mockCollections = [
        {
          ...visibleCollection,
          items: [{ tokenId: "1", isHidden: true }],
        },
      ];

      const { getByTestId, queryByTestId } = renderHomeScreen();

      fireEvent.press(getByTestId("tab-collectibles"));

      expect(getByTestId("add-collectible-empty-state-button")).toBeTruthy();
      expect(queryByTestId("home-add-collectible-button")).toBeNull();
    });

    // The buttons used to float over the scroll view, anchored above the tab
    // bar. They end each list now, so they have to live inside the scroll view.
    it("scrolls the Add token button with the list", () => {
      const { getByTestId } = renderHomeScreen();

      expect(
        within(getByTestId("home-screen-scrollview")).getByTestId(
          "home-add-token-button",
        ),
      ).toBeTruthy();
    });

    it("scrolls the Add collectible button with the list", () => {
      mockCollections = [visibleCollection];

      const { getByTestId } = renderHomeScreen();

      fireEvent.press(getByTestId("tab-collectibles"));

      expect(
        within(getByTestId("home-screen-scrollview")).getByTestId(
          "home-add-collectible-button",
        ),
      ).toBeTruthy();
    });

    it("opens the Add token screen from the Add token button", () => {
      const navigate = jest.fn();
      const { getByTestId } = renderWithProviders(
        <HomeScreen
          navigation={
            { replace: jest.fn(), navigate, setOptions: jest.fn() } as never
          }
          route={{} as never}
        />,
      );

      fireEvent.press(getByTestId("home-add-token-button"));

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(
        ROOT_NAVIGATOR_ROUTES.MANAGE_TOKENS_STACK,
        { screen: MANAGE_TOKENS_ROUTES.ADD_TOKEN_SCREEN },
      );
    });

    it.each([
      ["the Add collectible button", "home-add-collectible-button", true],
      ["the empty card's button", "add-collectible-empty-state-button", false],
    ])(
      "opens the Add collectible screen from %s",
      (_name, testID, hasCollectibles) => {
        mockCollections = hasCollectibles ? [visibleCollection] : [];
        const navigate = jest.fn();
        const { getByTestId } = renderWithProviders(
          <HomeScreen
            navigation={
              { replace: jest.fn(), navigate, setOptions: jest.fn() } as never
            }
            route={{} as never}
          />,
        );

        fireEvent.press(getByTestId("tab-collectibles"));
        fireEvent.press(getByTestId(testID));

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith(
          ROOT_NAVIGATOR_ROUTES.ADD_COLLECTIBLE_SCREEN,
        );
      },
    );

    // While collectibles load, a pull to refresh included, the grid shows a
    // spinner that fills the tab, so a button below it would sit at the
    // bottom of the screen. It goes then, even over a grid with content.
    it("hides Add collectible while collectibles load", () => {
      mockIsCollectiblesLoading = true;
      mockCollections = [visibleCollection];

      const { getByTestId, queryByTestId } = renderHomeScreen();

      fireEvent.press(getByTestId("tab-collectibles"));

      expect(getByTestId("collectibles-grid-spinner")).toBeTruthy();
      expect(queryByTestId("home-add-collectible-button")).toBeNull();
    });

    it("keeps Add collectible enabled once collectibles have loaded", () => {
      mockIsCollectiblesLoading = false;
      mockCollections = [visibleCollection];

      const { getByTestId } = renderHomeScreen();

      fireEvent.press(getByTestId("tab-collectibles"));

      expect(
        getByTestId("home-add-collectible-button").props.accessibilityState,
      ).toEqual(expect.objectContaining({ disabled: false }));
    });
  });
});

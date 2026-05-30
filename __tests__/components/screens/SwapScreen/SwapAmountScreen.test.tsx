/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import SwapAmountScreen from "components/screens/SwapScreen/screens/SwapAmountScreen";
import Icon from "components/sds/Icon";
import { AnalyticsEvent } from "config/analyticsConfig";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useSwapStore } from "ducks/swap";
import { renderWithProviders } from "helpers/testUtils";
import { useBalancesList } from "hooks/useBalancesList";
import React, { act } from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";

import { mockBalances } from "../../../../__mocks__/balances";
import { mockGestureHandler } from "../../../../__mocks__/gesture-handler";
import { mockUseColors } from "../../../../__mocks__/use-colors";

const MockView = View;
const mockSetSourceToken = jest.fn();
const mockSetDestinationToken = jest.fn();
const mockSetSourceAmount = jest.fn();
const mockSetSourceAmountDisplay = jest.fn();
const mockResetSwap = jest.fn();
const mockResetTransaction = jest.fn();
const mockResetToDefaults = jest.fn();
const mockExecuteSwap = jest.fn().mockResolvedValue(undefined);
const mockSetupSwapTransaction = jest.fn().mockResolvedValue(undefined);

mockGestureHandler();
mockUseColors();

// Stub the BottomSheet wrapper so tests can press CTAs that present sheets
// without depending on @gorhom/bottom-sheet's animated implementation. We
// stash imperative refs on the global so per-test assertions can target
// individual sheets by their declaration order.
type SheetRefSpy = { present: jest.Mock; dismiss: jest.Mock };
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace, vars-on-top, no-var, no-underscore-dangle
  var __mockSheetRefs: SheetRefSpy[];
}
// eslint-disable-next-line no-underscore-dangle
globalThis.__mockSheetRefs = [];
jest.mock("components/BottomSheet", () => {
  /* eslint-disable global-require, @typescript-eslint/no-var-requires, @typescript-eslint/no-shadow */
  const ReactModule = require("react");
  const RNModule = require("react-native");
  /* eslint-enable global-require, @typescript-eslint/no-var-requires, @typescript-eslint/no-shadow */

  const NoopSheet = (props: { modalRef?: React.RefObject<unknown> }) => {
    const { modalRef } = props;
    ReactModule.useImperativeHandle(modalRef, () => {
      const spy: SheetRefSpy = {
        present: jest.fn(),
        dismiss: jest.fn(),
      };
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__mockSheetRefs.push(spy);
      return spy;
    }, []);
    // Don't render customContent — the sheet should be "closed" by default
    // and would otherwise duplicate icons/elements queried by the test.
    return ReactModule.createElement(RNModule.View);
  };
  return { __esModule: true, default: NoopSheet };
});

type SwapStoreState = {
  sourceTokenId: string;
  destinationToken: null | {
    id: string;
    tokenCode: string;
    issuer?: string;
    decimals: number;
    tokenType: string;
    isNew: boolean;
  };
  sourceTokenSymbol: string;
  sourceAmount: string;
  sourceAmountDisplay: string;
  destinationAmount: string;
  pathResult: null | { destinationAmount: string };
  isLoadingPath: boolean;
  pathError: string | null;
  setSourceToken: jest.Mock;
  setDestinationToken: jest.Mock;
  setSourceAmount: jest.Mock;
  setSourceAmountDisplay: jest.Mock;
  resetSwap: jest.Mock;
};

const makeDefaultSwapState = (): SwapStoreState => ({
  sourceTokenId:
    "USDC:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
  destinationToken: {
    id: "FTT:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
    tokenCode: "FTT",
    issuer: "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
    decimals: 7,
    tokenType: "credit_alphanum4",
    isNew: false,
  },
  sourceTokenSymbol: "USDC",
  sourceAmount: "1",
  sourceAmountDisplay: "1",
  destinationAmount: "2",
  pathResult: null,
  isLoadingPath: false,
  pathError: null,
  setSourceToken: mockSetSourceToken,
  setDestinationToken: mockSetDestinationToken,
  setSourceAmount: mockSetSourceAmount,
  setSourceAmountDisplay: mockSetSourceAmountDisplay,
  resetSwap: mockResetSwap,
});

jest.mock("ducks/swap", () => ({
  useSwapStore: jest.fn(),
  // Pass-through adapter — tests can inspect the call by passing in a
  // descriptor that doesn't match any held balance and asserting that the
  // useSwapPathFinding mock receives an object with `tokenCode`/`id` from
  // the descriptor.
  destinationAsBalanceLike: jest.fn(
    (descriptor: {
      id: string;
      tokenCode: string;
      tokenType: string;
      issuer?: string;
    }) => ({
      id: descriptor.id,
      tokenCode: descriptor.tokenCode,
      tokenType: descriptor.tokenType,
      token: {
        code: descriptor.tokenCode,
        issuer: descriptor.issuer ? { key: descriptor.issuer } : undefined,
        type: descriptor.tokenType,
      },
    }),
  ),
}));

const setSwapStoreState = (patch: Partial<SwapStoreState>): void => {
  (useSwapStore as unknown as jest.Mock).mockImplementation(() => ({
    ...makeDefaultSwapState(),
    ...patch,
  }));
};

jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: jest.fn(() => ({
    isBuilding: false,
    resetTransaction: mockResetTransaction,
  })),
}));
jest.mock("ducks/swapSettings", () => ({
  useSwapSettingsStore: jest.fn(() => ({
    swapFee: "100",
    swapTimeout: "30",
    swapSlippage: "0.5",
    resetToDefaults: mockResetToDefaults,
  })),
}));
jest.mock("components/screens/SwapScreen/hooks/useSwapTransaction", () => ({
  useSwapTransaction: jest.fn(() => ({
    isProcessing: false,
    executeSwap: mockExecuteSwap,
    setupSwapTransaction: mockSetupSwapTransaction,
    handleProcessingScreenClose: jest.fn(),
    sourceToken: "XLM",
    destinationToken: "USDC",
    transactionScanResult: {},
    sourceAmount: "10",
  })),
}));
jest.mock("hooks/useBalancesList");

jest.mock("@react-navigation/elements", () => ({
  useHeaderHeight: () => 0,
}));

// Mock useSwapPathFinding so tests can assert what destinationBalance it was
// invoked with. The hook itself is a debounced effect; we don't care about
// its internals here.
const mockUseSwapPathFinding = jest.fn();
jest.mock("components/screens/SwapScreen/hooks/useSwapPathFinding", () => ({
  useSwapPathFinding: (...args: unknown[]) => mockUseSwapPathFinding(...args),
}));

// Default mocks for the Trending list infrastructure. Tests can override the
// useSwapTokenLookup return via the helper below.
type TrendingFixture = {
  tokenCode: string;
  domain: string;
  hasTrustline: boolean;
  iconUrl?: string;
  issuer: string;
  isNative: boolean;
};
type SwapTokenLookupReturn = {
  yourTokens: TrendingFixture[];
  popularTokens: TrendingFixture[];
  trendingTokens: TrendingFixture[];
  searchResults: TrendingFixture[];
  hadSorobanMatches: boolean;
  stellarExpertDown: boolean;
  status: string;
  isTrendingLoading: boolean;
  searchTerm: string;
  handleSearch: jest.Mock;
  resetSearch: jest.Mock;
};
const mockUseSwapTokenLookup = jest.fn<SwapTokenLookupReturn, []>(() => ({
  yourTokens: [],
  popularTokens: [],
  trendingTokens: [],
  searchResults: [],
  hadSorobanMatches: false,
  stellarExpertDown: false,
  status: "idle",
  isTrendingLoading: false,
  searchTerm: "",
  handleSearch: jest.fn(),
  resetSearch: jest.fn(),
}));
jest.mock("components/screens/SwapScreen/hooks/useSwapTokenLookup", () => ({
  useSwapTokenLookup: (
    ...args: unknown[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => (mockUseSwapTokenLookup as any)(...args),
}));

const mockFetchPricesForTokenIds = jest.fn();
const mockPrices: Record<
  string,
  { currentPrice?: unknown; percentagePriceChange24h?: unknown }
> = {};
jest.mock("ducks/prices", () => ({
  usePricesStore: (selector?: (s: unknown) => unknown): unknown => {
    const state = {
      prices: mockPrices,
      fetchPricesForTokenIds: mockFetchPricesForTokenIds,
    };
    return selector ? selector(state) : state;
  },
}));
// Cache the return value so account / spendableAmount memos stay stable across
// re-renders — otherwise the amountError useEffect can re-fire forever when
// sourceAmount exceeds spendable.
jest.mock("hooks/useGetActiveAccount", () => {
  const stable = { account: { publicKey: "abc", subentryCount: 0 } };
  return () => stable;
});
jest.mock("hooks/useRightHeader", () => ({
  useRightHeaderMenu: jest.fn(),
  useRightHeaderButton: jest.fn(),
}));
const mockShowToast = jest.fn();
jest.mock("providers/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <MockView>{children}</MockView>
  ),
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

type Props = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN
>;

const makeNavigation = () =>
  ({ navigate: jest.fn() }) as unknown as Props["navigation"];

const makeRoute = () =>
  ({
    key: "swap-amount",
    name: SWAP_ROUTES.SWAP_AMOUNT_SCREEN,
    params: { tokenId: "SRC", tokenSymbol: "XLM" },
  }) as unknown as Props["route"];

const mockBalancesListReturn = (
  scanResults: Record<string, { result_type: string }> = {},
) => {
  (useBalancesList as jest.Mock).mockImplementation(() => ({
    balanceItems: mockBalances,
    scanResults,
    isLoading: false,
    error: null,
    noBalances: false,
    isRefreshing: false,
    isFunded: true,
    handleRefresh: jest.fn(),
  }));
};

describe("SwapAmountScreen", () => {
  beforeEach(() => {
    // Only clear call history; clearAllMocks would also drop the mock impls
    // set in the top-level jest.mock factories.
    mockSetSourceToken.mockClear();
    mockSetDestinationToken.mockClear();
    mockSetSourceAmount.mockClear();
    mockSetSourceAmountDisplay.mockClear();
    mockResetSwap.mockClear();
    mockResetTransaction.mockClear();
    mockResetToDefaults.mockClear();
    mockExecuteSwap.mockClear();
    mockSetupSwapTransaction.mockClear();
    mockShowToast.mockClear();
    setSwapStoreState({});
    mockBalancesListReturn();
  });

  it("initializes source token from route params", () => {
    mockBalancesListReturn({
      "USDC-GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH": {
        result_type: "Malicious",
      },
    });
    renderWithProviders(
      <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
    );
    expect(mockSetSourceToken).toHaveBeenCalledWith("SRC", "XLM");
    expect(mockSetDestinationToken).toHaveBeenCalledWith(null);
    expect(mockSetSourceAmount).toHaveBeenCalledWith("0");
  });

  it("renders security warnings for malicious states", () => {
    mockBalancesListReturn({
      "USDC-GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH": {
        result_type: "Malicious",
      },
    });
    const { UNSAFE_getByType } = renderWithProviders(
      <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
    );
    const icon = UNSAFE_getByType(Icon.AlertCircle);
    expect(icon).toBeTruthy();
    expect(icon.props.themeColor).toBe("red");
  });

  it("renders security warnings for suspicious states", () => {
    mockBalancesListReturn({
      "USDC-GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH": {
        result_type: "Warning",
      },
    });
    const { UNSAFE_getByType } = renderWithProviders(
      <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
    );
    const icon = UNSAFE_getByType(Icon.AlertCircle);
    expect(icon).toBeTruthy();
    expect(icon.props.themeColor).toBe("amber");
  });

  it("resets state on unmount", () => {
    const { unmount } = renderWithProviders(
      <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
    );
    act(() => {
      unmount();
    });
    expect(mockResetSwap).toHaveBeenCalled();
    expect(mockResetTransaction).toHaveBeenCalled();
    expect(mockResetToDefaults).toHaveBeenCalled();
  });

  describe("CTA state machine", () => {
    it("shows 'Select a token' when no destination is set", () => {
      setSwapStoreState({ destinationToken: null, sourceAmount: "0" });

      const navigation = makeNavigation();
      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={navigation} route={makeRoute()} />,
      );

      const cta = getByTestId("swap-continue-button");
      expect(cta).toHaveTextContent("Select a token");

      fireEvent.press(cta);
      expect(navigation.navigate).toHaveBeenCalledWith(
        SWAP_ROUTES.SWAP_SCREEN,
        { selectionType: "destination" },
      );
    });

    it("shows 'Enter an amount' when destination is set but amount is zero", () => {
      setSwapStoreState({ sourceAmount: "0" });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      const cta = getByTestId("swap-continue-button");
      expect(cta).toHaveTextContent("Enter an amount");
    });

    it("shows 'Insufficient balance' (disabled) when amount > spendable", () => {
      // USDC available is 10 (per mockBalances). Source amount 9999 forces insufficient.
      setSwapStoreState({ sourceAmount: "9999" });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      const cta = getByTestId("swap-continue-button");
      expect(cta).toHaveTextContent("Insufficient balance");
      expect(cta.props.accessibilityState?.disabled).toBe(true);
    });

    it("shows 'Review swap' with a spinner while path-finding is loading", () => {
      setSwapStoreState({ sourceAmount: "1", isLoadingPath: true });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      // Loading state still renders the Review label per the design doc; the
      // spinner is rendered by the SDS Button when isLoading=true.
      const cta = getByTestId("swap-continue-button");
      expect(cta).toHaveTextContent("Review swap");
    });

    it("shows 'Review swap' (enabled) when path-finding succeeds", async () => {
      setSwapStoreState({
        sourceAmount: "1",
        pathResult: { destinationAmount: "2" },
      });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      const cta = getByTestId("swap-continue-button");
      expect(cta).toHaveTextContent("Review swap");
      expect(cta.props.accessibilityState?.disabled).toBeFalsy();

      await act(async () => {
        fireEvent.press(cta);
        await Promise.resolve();
      });

      expect(mockSetupSwapTransaction).toHaveBeenCalled();
    });
  });

  describe("Pre-flight XLM reserve check", () => {
    beforeEach(() => {
      // Reset sheet refs so each test starts with a clean array.
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__mockSheetRefs = [];
      // Create (or recreate) the analytics spy and clear any prior calls.
      jest.spyOn(analytics, "track").mockClear();
    });

    it("opens the XLM reserve sheet when destinationToken.isNew && XLM spendable < 0.5", async () => {
      // The new check uses calculateSpendableAmount(xlmBalance, subentryCount, swapFee).
      // swapFee mock is "100", subentryCount is 0.
      // spendable = total - (2+0)*0.5 - 100 = total - 101.
      //
      // We also need total >= 100 to satisfy hasXLMForFees (which checks total >= fee)
      // so that amountError is not set (which would disable the CTA button).
      //
      // total = "100.1":
      //   hasXLMForFees: 100.1 >= 100 → true (no error)
      //   spendable = max(0, 100.1 - 1 - 100) = max(0, -0.9) = 0 < 0.5 → gate trips
      const lowXlmBalances = mockBalances.map((b) => {
        if (b.token?.type !== "native") return b;
        return {
          ...b,
          total: new BigNumber("100.1"),
          available: new BigNumber("0.1"),
        };
      });
      (useBalancesList as jest.Mock).mockImplementation(() => ({
        balanceItems: lowXlmBalances,
        scanResults: {},
        isLoading: false,
        error: null,
        noBalances: false,
        isRefreshing: false,
        isFunded: true,
        handleRefresh: jest.fn(),
      }));

      setSwapStoreState({
        sourceAmount: "1",
        pathResult: { destinationAmount: "2" },
        destinationToken: {
          id: "FTT:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
          tokenCode: "FTT",
          issuer: "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
          decimals: 7,
          tokenType: "credit_alphanum4",
          isNew: true,
        },
      });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      await act(async () => {
        fireEvent.press(getByTestId("swap-continue-button"));
        // handleMainButtonPress is async (prepareSwapTransaction). Yield to
        // microtasks so its effects flush before assertions run.
        await Promise.resolve();
      });

      // Gate must have fired: swap transaction must NOT have been initiated.
      expect(mockSetupSwapTransaction).not.toHaveBeenCalled();
      // The analytics event must fire when the gate trips.
      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN,
      );
      // The XLM reserve sheet's present() must have been called.
      // eslint-disable-next-line no-underscore-dangle
      const presentedSheets = globalThis.__mockSheetRefs.filter(
        (spy) => spy.present.mock.calls.length > 0,
      );
      expect(presentedSheets.length).toBeGreaterThan(0);
    });

    it("opens Review sheet when destinationToken.isNew but XLM spendable >= 0.5", async () => {
      // XLM total is the default 1000.5.
      // spendable = 1000.5 - (2+0)*0.5 - 100 = 899.5 — well above 0.5.
      // The pre-flight gate should NOT fire, so setupSwapTransaction is called.
      setSwapStoreState({
        sourceAmount: "1",
        pathResult: { destinationAmount: "2" },
        destinationToken: {
          id: "FTT:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
          tokenCode: "FTT",
          issuer: "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
          decimals: 7,
          tokenType: "credit_alphanum4",
          isNew: true,
        },
      });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      await act(async () => {
        fireEvent.press(getByTestId("swap-continue-button"));
        // handleMainButtonPress is async (prepareSwapTransaction). Yield to
        // microtasks so its effects flush before assertions run.
        await Promise.resolve();
      });

      // Gate should NOT have fired — setupSwapTransaction must have been called.
      expect(mockSetupSwapTransaction).toHaveBeenCalled();
      // Analytics reserve event must NOT fire on the happy path.
      expect(analytics.track).not.toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN,
      );
    });

    it("opens XlmReserveBottomSheet when XLM is the source and post-swap spendable < BASE_RESERVE", async () => {
      // swapFee mock is "100", subentryCount = 0, minimumBalance = 1 XLM.
      // xlmSpendable = max(0, total - 1 - 100) = total - 101.
      //
      // We need:
      //   (a) sourceAmount <= xlmSpendable  → CTA is in "review" state, not "insufficient"
      //   (b) xlmSpendable - sourceAmount <= BASE_RESERVE (0.5) → gate fires
      //
      // total = 101.9:
      //   xlmSpendable = 101.9 - 101 = 0.9
      //   sourceAmount = 0.89  (≤ 0.9 ✓, passes spendable check)
      //   projectedSpendable = 0.9 - 0.89 = 0.01  (≤ 0.5 ✓, gate fires)
      //
      // Without XLM-as-source logic, the gate would compare 0.9 > 0.5 and NOT fire,
      // so this test specifically validates the new projected-spendable calculation.
      const xlmAsSourceBalances = mockBalances.map((b) => {
        if (b.token?.type !== "native") return b;
        return {
          ...b,
          total: new BigNumber("101.9"),
          available: new BigNumber("0.9"),
        };
      });
      (useBalancesList as jest.Mock).mockImplementation(() => ({
        balanceItems: xlmAsSourceBalances,
        scanResults: {},
        isLoading: false,
        error: null,
        noBalances: false,
        isRefreshing: false,
        isFunded: true,
        handleRefresh: jest.fn(),
      }));

      setSwapStoreState({
        // sourceTokenId = "XLM" (NATIVE_TOKEN_CODE) — XLM is the source
        sourceTokenId: "XLM",
        sourceAmount: "0.89",
        pathResult: { destinationAmount: "2" },
        destinationToken: {
          id: "FTT:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
          tokenCode: "FTT",
          issuer: "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
          decimals: 7,
          tokenType: "credit_alphanum4",
          isNew: true,
        },
      });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      await act(async () => {
        fireEvent.press(getByTestId("swap-continue-button"));
        await Promise.resolve();
      });

      // Gate must have fired: swap transaction must NOT have been initiated.
      expect(mockSetupSwapTransaction).not.toHaveBeenCalled();
      // Analytics must fire for the XLM-as-source gate trip.
      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN,
      );
      // The XLM reserve sheet's present() must have been called.
      // eslint-disable-next-line no-underscore-dangle
      const presentedSheets = globalThis.__mockSheetRefs.filter(
        (spy) => spy.present.mock.calls.length > 0,
      );
      expect(presentedSheets.length).toBeGreaterThan(0);
    });
  });

  describe("Trending list", () => {
    const trendingFixture = [
      {
        tokenCode: "AQUA",
        domain: "aqua.network",
        hasTrustline: false,
        iconUrl: undefined,
        issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
        isNative: false,
      },
      {
        tokenCode: "yXLM",
        domain: "ultrastellar.com",
        hasTrustline: true,
        iconUrl: undefined,
        issuer: "GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55",
        isNative: false,
      },
    ];

    beforeEach(() => {
      mockUseSwapTokenLookup.mockReturnValue({
        yourTokens: [],
        popularTokens: [],
        trendingTokens: trendingFixture,
        searchResults: [],
        hadSorobanMatches: false,
        stellarExpertDown: false,
        status: "idle",
        isTrendingLoading: false,
        searchTerm: "",
        handleSearch: jest.fn(),
        resetSearch: jest.fn(),
      });
      mockFetchPricesForTokenIds.mockClear();
    });

    it("renders trending rows when network is PUBLIC and stellarExpertDown is false", () => {
      const { queryAllByText, getByText } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      expect(getByText("Trending Tokens")).toBeTruthy();
      // Both fixture rows render — confirm by token code.
      expect(queryAllByText("AQUA").length).toBeGreaterThan(0);
      expect(queryAllByText("yXLM").length).toBeGreaterThan(0);
    });

    it("calls fetchPricesForTokenIds for the trending list", () => {
      renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      expect(mockFetchPricesForTokenIds).toHaveBeenCalledWith({
        tokens: [
          "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          "yXLM:GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55",
        ],
      });
    });

    it("opens TrendingTokenDetailBottomSheet when a row is tapped", () => {
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__mockSheetRefs = [];
      const { getByText } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      // eslint-disable-next-line no-underscore-dangle
      const sheetsBeforeTap = globalThis.__mockSheetRefs.length;

      // Tap the AQUA row — the SwapTokenRow renders the tokenCode as the
      // primary text node, so the trending row is findable that way.
      act(() => {
        fireEvent.press(getByText("AQUA"));
      });

      // Tapping a trending row sets selectedTrendingRecord, which renders
      // the TrendingTokenDetailBottomSheet via its own <BottomSheet>. The
      // sheet stub registers a new spy ref on mount.
      // eslint-disable-next-line no-underscore-dangle
      expect(globalThis.__mockSheetRefs.length).toBeGreaterThan(
        sheetsBeforeTap,
      );
      // eslint-disable-next-line no-underscore-dangle
      const newestSheet = globalThis.__mockSheetRefs.at(-1);
      expect(newestSheet?.present).toHaveBeenCalled();
    });

    it("hides the trending list when stellarExpertDown is true", () => {
      mockUseSwapTokenLookup.mockReturnValue({
        yourTokens: [],
        popularTokens: [],
        trendingTokens: trendingFixture,
        searchResults: [],
        hadSorobanMatches: false,
        stellarExpertDown: true,
        status: "error",
        isTrendingLoading: false,
        searchTerm: "",
        handleSearch: jest.fn(),
        resetSearch: jest.fn(),
      });
      const { queryByText } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      expect(queryByText("Trending Tokens")).toBeNull();
    });

    it("hides the trending list when trendingTokens is empty", () => {
      mockUseSwapTokenLookup.mockReturnValue({
        yourTokens: [],
        popularTokens: [],
        trendingTokens: [],
        searchResults: [],
        hadSorobanMatches: false,
        stellarExpertDown: false,
        status: "idle",
        isTrendingLoading: false,
        searchTerm: "",
        handleSearch: jest.fn(),
        resetSearch: jest.fn(),
      });
      const { queryByText } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      expect(queryByText("Trending Tokens")).toBeNull();
    });

    it("shows a loading spinner while trendingTokens is empty and isTrendingLoading is true", () => {
      mockUseSwapTokenLookup.mockReturnValue({
        yourTokens: [],
        popularTokens: [],
        trendingTokens: [],
        searchResults: [],
        hadSorobanMatches: false,
        stellarExpertDown: false,
        status: "idle",
        isTrendingLoading: true,
        searchTerm: "",
        handleSearch: jest.fn(),
        resetSearch: jest.fn(),
      });
      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      expect(getByTestId("trending-loading-spinner")).toBeTruthy();
    });
  });

  describe("Non-held destination path finding", () => {
    beforeEach(() => {
      mockUseSwapPathFinding.mockClear();
    });

    it("invokes useSwapPathFinding with the adapter-built balance-like for a non-held destination", () => {
      // Destination id "AQUA:..." is NOT in mockBalances — so the screen's
      // destinationBalance memo returns undefined and the adapter projection
      // is fed to useSwapPathFinding instead of the matching held balance.
      setSwapStoreState({
        sourceAmount: "1",
        destinationToken: {
          id: "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          tokenCode: "AQUA",
          issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          decimals: 7,
          tokenType: "credit_alphanum4",
          isNew: true,
        },
      });

      renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      expect(mockUseSwapPathFinding).toHaveBeenCalled();
      const lastCall = mockUseSwapPathFinding.mock.calls.at(-1) as
        | [{ destinationBalance?: Record<string, unknown> }]
        | undefined;
      expect(lastCall?.[0]?.destinationBalance).toEqual(
        expect.objectContaining({
          id: "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          tokenCode: "AQUA",
          token: expect.objectContaining({
            code: "AQUA",
            type: "credit_alphanum4",
          }),
        }),
      );
    });

    it("uses the held PricedBalance directly when the destination is held", () => {
      // mockBalances contains FTT — destinationBalance memo will resolve to
      // it directly and useSwapPathFinding receives the full PricedBalance,
      // not the adapter projection.
      setSwapStoreState({
        sourceAmount: "1",
        destinationToken: {
          id: "FTT:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
          tokenCode: "FTT",
          issuer: "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
          decimals: 7,
          tokenType: "credit_alphanum4",
          isNew: false,
        },
      });

      renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      expect(mockUseSwapPathFinding).toHaveBeenCalled();
      const lastCall = mockUseSwapPathFinding.mock.calls.at(-1) as
        | [{ destinationBalance?: Record<string, unknown> }]
        | undefined;
      // Held balance carries `total` and `available` BigNumbers (from
      // mockBalances); the adapter projection does not.
      expect(lastCall?.[0]?.destinationBalance).toEqual(
        expect.objectContaining({
          id: "FTT:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
          total: expect.anything(),
          available: expect.anything(),
        }),
      );
    });
  });

  describe("Non-held destination Receive slot", () => {
    it("shows the descriptor tokenCode (AQUA) in the Receive pill when destination is non-held", () => {
      // AQUA is not in mockBalances, so destinationBalance will be undefined.
      // The Receive pill should render the descriptor's tokenCode instead of
      // falling through to the 'Select a token' placeholder pill.
      setSwapStoreState({
        sourceAmount: "1",
        destinationToken: {
          id: "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          tokenCode: "AQUA",
          issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          decimals: 7,
          tokenType: "credit_alphanum4",
          isNew: true,
        },
      });

      const { getByTestId, queryByTestId, queryAllByText } =
        renderWithProviders(
          <SwapAmountScreen
            navigation={makeNavigation()}
            route={makeRoute()}
          />,
        );

      // The Receive pill should be rendered with the descriptor's tokenCode
      expect(getByTestId("swap-receive-pill")).toBeTruthy();
      // The 'Select a token' placeholder pill must NOT appear
      expect(queryByTestId("swap-receive-choose-pill")).toBeNull();
      // The descriptor's tokenCode must be visible to the user
      expect(queryAllByText("AQUA").length).toBeGreaterThan(0);
    });

    it("shows the 'Select a token' placeholder pill when no destination is selected", () => {
      setSwapStoreState({ destinationToken: null, sourceAmount: "0" });

      const { getByTestId, queryByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      expect(getByTestId("swap-receive-choose-pill")).toBeTruthy();
      expect(queryByTestId("swap-receive-pill")).toBeNull();
    });

    it("fires SWAP_TO_PICKER_OPENED with source:dropdown when the Receive pill is tapped", () => {
      jest.spyOn(analytics, "track").mockClear();

      setSwapStoreState({
        sourceAmount: "1",
        destinationToken: {
          id: "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          tokenCode: "AQUA",
          issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          decimals: 7,
          tokenType: "credit_alphanum4",
          isNew: true,
        },
      });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      fireEvent.press(getByTestId("swap-receive-pill"));

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TO_PICKER_OPENED,
        { source: "dropdown" },
      );
    });
  });

  describe("Swap-direction toggle (Figma 11310-94387)", () => {
    // mockBalances uses id: "XLM" for native and a specific issuer for USDC;
    // re-use those exact values so balanceItems.find resolves correctly.
    const HELD_USDC = mockBalances.find((b) => b.id?.startsWith("USDC:"))!;

    it("renders the toggle and Sell pill alongside Receive pill in the card layout", () => {
      setSwapStoreState({
        sourceTokenId: "XLM",
        sourceTokenSymbol: "XLM",
        sourceAmount: "1",
        destinationToken: {
          id: HELD_USDC.id,
          tokenCode: "USDC",
          issuer: HELD_USDC.id.split(":")[1],
          decimals: 7,
          tokenType: "credit_alphanum4",
          isNew: false,
        },
      });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      expect(getByTestId("swap-sell-card")).toBeTruthy();
      expect(getByTestId("swap-receive-card")).toBeTruthy();
      expect(getByTestId("swap-sell-pill")).toBeTruthy();
      expect(getByTestId("swap-receive-pill")).toBeTruthy();
      expect(getByTestId("swap-direction-toggle")).toBeTruthy();
    });

    it("tapping the Sell pill navigates to the source picker", () => {
      setSwapStoreState({
        sourceTokenId: "XLM",
        sourceTokenSymbol: "XLM",
      });
      const navigation = makeNavigation();
      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={navigation} route={makeRoute()} />,
      );
      fireEvent.press(getByTestId("swap-sell-pill"));
      expect(navigation.navigate).toHaveBeenCalled();
    });

    it("swap-direction toggle bails out when destination is non-held", () => {
      // AQUA is not in mockBalances → destinationBalance is undefined → the
      // handler should early-return without calling either setter.
      const setSourceTokenSpy = jest.fn();
      const setDestinationTokenSpy = jest.fn();
      setSwapStoreState({
        sourceTokenId: "XLM",
        sourceTokenSymbol: "XLM",
        destinationToken: {
          id: "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          tokenCode: "AQUA",
          issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          decimals: 7,
          tokenType: "credit_alphanum4",
          isNew: true,
        },
        setSourceToken: setSourceTokenSpy,
        setDestinationToken: setDestinationTokenSpy,
      } as Partial<SwapStoreState>);

      // The init-effect bootstrap from swapFromTokenId/swapFromTokenSymbol
      // calls setSourceToken once on mount — we only care about whether the
      // direction toggle adds a second call. Tap, then assert no toggle-driven
      // call landed.
      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      setSourceTokenSpy.mockClear();
      setDestinationTokenSpy.mockClear();

      fireEvent.press(getByTestId("swap-direction-toggle"));

      expect(setSourceTokenSpy).not.toHaveBeenCalled();
      expect(setDestinationTokenSpy).not.toHaveBeenCalled();
    });
  });

  describe("Analytics events", () => {
    beforeEach(() => {
      jest.spyOn(analytics, "track").mockClear();
    });

    it("fires SWAP_TO_PICKER_OPENED with source:cta when the 'Select a token' CTA is pressed", () => {
      setSwapStoreState({ destinationToken: null, sourceAmount: "0" });

      const navigation = makeNavigation();
      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={navigation} route={makeRoute()} />,
      );

      fireEvent.press(getByTestId("swap-continue-button"));

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TO_PICKER_OPENED,
        { source: "cta" },
      );
    });

    it("fires SWAP_TO_PICKER_OPENED with source:dropdown when the Receive dropdown is tapped", () => {
      // destinationToken is null so the "Select a token" placeholder pill is rendered
      setSwapStoreState({ destinationToken: null, sourceAmount: "0" });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      fireEvent.press(getByTestId("swap-receive-choose-pill"));

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TO_PICKER_OPENED,
        { source: "dropdown" },
      );
    });

    it("fires SWAP_TRENDING_TOKEN_TAPPED with tokenCode and position when a trending row is tapped", () => {
      const trendingFixture = [
        {
          tokenCode: "AQUA",
          domain: "aqua.network",
          hasTrustline: false,
          iconUrl: undefined,
          issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          isNative: false,
        },
        {
          tokenCode: "yXLM",
          domain: "ultrastellar.com",
          hasTrustline: true,
          iconUrl: undefined,
          issuer: "GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55",
          isNative: false,
        },
      ];
      mockUseSwapTokenLookup.mockReturnValue({
        yourTokens: [],
        popularTokens: [],
        trendingTokens: trendingFixture,
        searchResults: [],
        hadSorobanMatches: false,
        stellarExpertDown: false,
        status: "idle",
        isTrendingLoading: false,
        searchTerm: "",
        handleSearch: jest.fn(),
        resetSearch: jest.fn(),
      });

      const { getByText } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      act(() => {
        fireEvent.press(getByText("AQUA"));
      });

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TRENDING_TOKEN_TAPPED,
        { tokenCode: "AQUA", position: 0 },
      );
    });
  });
});

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
const mockSaveSwapFee = jest.fn();
const mockExecuteSwap = jest.fn().mockResolvedValue(undefined);
const mockSetupSwapTransaction = jest.fn().mockResolvedValue(undefined);

mockGestureHandler();
mockUseColors();

// Stub the BottomSheet wrapper so tests can press CTAs that present sheets
// without depending on @gorhom/bottom-sheet's animated implementation. We
// stash imperative refs on the global so per-test assertions can target
// individual sheets by their declaration order.
type SheetRefSpy = {
  present: jest.Mock;
  dismiss: jest.Mock;
  /**
   * Synthetic dismiss: invokes the user-supplied
   * bottomSheetModalProps.onChange with index=-1, mirroring gorhom's
   * behavior when the sheet closes (swipe / backdrop / X / programmatic).
   * Returns true when the sheet had an onChange handler.
   */
  fireDismiss: () => boolean;
};
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

  const NoopSheet = (props: {
    modalRef?: React.RefObject<unknown>;
    bottomSheetModalProps?: { onChange?: (index: number) => void };
  }) => {
    const { modalRef, bottomSheetModalProps } = props;
    ReactModule.useImperativeHandle(modalRef, () => {
      const spy: SheetRefSpy = {
        present: jest.fn(),
        dismiss: jest.fn(),
        fireDismiss: () => {
          if (bottomSheetModalProps?.onChange) {
            bottomSheetModalProps.onChange(-1);
            return true;
          }
          return false;
        },
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
  descriptorAsPathBalance: jest.fn(
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
    saveSwapFee: mockSaveSwapFee,
    feeManuallyChanged: false,
    markFeeManuallyChanged: jest.fn(),
  })),
}));
// Deterministic network fee so the fee-freeze behavior is testable and
// independent of the real (or temporarily faked) useNetworkFees module.
jest.mock("hooks/useNetworkFees", () => ({
  useNetworkFees: () => ({
    recommendedFee: "0.001",
    networkCongestion: "LOW",
  }),
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
  refreshTrending?: jest.Mock;
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
  refreshTrending: jest.fn().mockResolvedValue(undefined),
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
    mockSaveSwapFee.mockClear();
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

  describe("network fee freeze", () => {
    it("keeps applying the recommended fee while no source amount is entered", () => {
      setSwapStoreState({ sourceAmount: "0" });

      renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      expect(mockSaveSwapFee).toHaveBeenCalledWith("0.001");
    });

    it("freezes the fee (stops applying recommended values) once an amount is entered", () => {
      setSwapStoreState({ sourceAmount: "1" });

      renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      expect(mockSaveSwapFee).not.toHaveBeenCalled();
    });
  });

  describe("CTA state machine", () => {
    it("shows 'Select a token' when no destination is set", async () => {
      setSwapStoreState({ destinationToken: null, sourceAmount: "0" });

      const navigation = makeNavigation();
      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={navigation} route={makeRoute()} />,
      );

      const cta = getByTestId("swap-continue-button");
      expect(cta).toHaveTextContent("Select a token");

      // handleMainButtonPress is now async (awaits waitForKeyboardDismiss)
      // before navigating, so flush microtasks before asserting.
      await act(async () => {
        fireEvent.press(cta);
        await Promise.resolve();
      });
      expect(navigation.navigate).toHaveBeenCalledWith(
        SWAP_ROUTES.SWAP_SCREEN,
        { selectionType: "destination" },
      );
    });

    it("shows 'Select a token' AND opens the source picker when source is empty", async () => {
      // sourceTokenId="" mimics the selection-swap rule clearing the source.
      // sourceBalance lookup misses → CTA goes to "select" / missingSide=source.
      setSwapStoreState({
        sourceTokenId: "",
        sourceTokenSymbol: "",
        sourceAmount: "0",
      });

      const navigation = makeNavigation();
      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={navigation} route={makeRoute()} />,
      );

      const cta = getByTestId("swap-continue-button");
      expect(cta).toHaveTextContent("Select a token");

      await act(async () => {
        fireEvent.press(cta);
        await Promise.resolve();
      });
      expect(navigation.navigate).toHaveBeenCalledWith(
        SWAP_ROUTES.SWAP_SCREEN,
        { selectionType: "source" },
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

    it("dismisses the keyboard AND waits for keyboardDidHide before opening the Review sheet", async () => {
      // Regression: the system keyboard previously stayed up when the user
      // tapped "Review swap", squishing the bottom sheet content. Now we
      // also wait for keyboardDidHide so the sheet animates in at its
      // final position rather than jumping after the keyboard slides away.
      const RN = jest.requireActual("react-native");
      const dismissSpy = jest.spyOn(RN.Keyboard, "dismiss");
      const isVisibleSpy = jest
        .spyOn(RN.Keyboard, "isVisible")
        .mockReturnValue(true);
      // Stub addListener so the test can synchronously fire the
      // keyboardDidHide callback after press, resolving the wait promise.
      let hideCallback: (() => void) | null = null;
      const addListenerSpy = jest
        .spyOn(RN.Keyboard, "addListener")
        .mockImplementation((...args: unknown[]) => {
          const event = args[0] as string;
          const cb = args[1] as () => void;
          if (event === "keyboardDidHide") hideCallback = cb;
          return { remove: jest.fn() } as any;
        });

      setSwapStoreState({
        sourceAmount: "1",
        pathResult: { destinationAmount: "2" },
      });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      await act(async () => {
        fireEvent.press(getByTestId("swap-continue-button"));
        await Promise.resolve();
      });

      // Keyboard.dismiss must have fired, and the listener must have been
      // registered to wait for keyboardDidHide.
      expect(dismissSpy).toHaveBeenCalled();
      expect(addListenerSpy).toHaveBeenCalledWith(
        "keyboardDidHide",
        expect.any(Function),
      );

      // Fire the keyboardDidHide callback to resolve the wait, then the
      // sheet presentation (mockSetupSwapTransaction) is reachable.
      await act(async () => {
        hideCallback?.();
        await Promise.resolve();
      });
      expect(mockSetupSwapTransaction).toHaveBeenCalled();

      dismissSpy.mockRestore();
      isVisibleSpy.mockRestore();
      addListenerSpy.mockRestore();
    });

    it("does NOT dismiss the keyboard on the 'Enter an amount' CTA (it focuses the input)", () => {
      const RN = jest.requireActual("react-native");
      const dismissSpy = jest.spyOn(RN.Keyboard, "dismiss");
      dismissSpy.mockClear();

      // amount=0 → CTA is "Enter an amount", which focuses the TextInput.
      setSwapStoreState({ sourceAmount: "0" });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      fireEvent.press(getByTestId("swap-continue-button"));

      expect(dismissSpy).not.toHaveBeenCalled();
      dismissSpy.mockRestore();
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

    it("opens XlmReserveBottomSheet when XLM is the source and initial spendable < BASE_RESERVE", async () => {
      // swapFee mock is "100", subentryCount = 0, minimumBalance = 1 XLM.
      // xlmSpendable = max(0, total - 1 - 100) = total - 101.
      //
      // For XLM source the 0.5 reserve is normally deducted from spendable
      // up-front, so the sheet is only the fallback when there isn't even
      // 0.5 spendable to begin with. Pick total so spendable < 0.5 (no
      // deduction applied) and an amount within spendable so the CTA is in
      // "review" state.
      //
      // total = 101.4:
      //   xlmSpendable = 101.4 - 101 = 0.4  (< 0.5 → no deduction, gate fires)
      //   sourceAmount = 0.39  (≤ 0.4 ✓, CTA reaches review)
      const xlmAsSourceBalances = mockBalances.map((b) => {
        if (b.token?.type !== "native") return b;
        return {
          ...b,
          total: new BigNumber("101.4"),
          available: new BigNumber("0.4"),
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
        sourceAmount: "0.39",
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

    it("reserves BASE_RESERVE from spendable when swapping XLM → a new token", () => {
      // total = 101.9 → xlmSpendable = 0.9. Swapping XLM → a new token
      // reserves 0.5, so the usable spendable is 0.4. An amount of 0.89
      // (which would be spendable WITHOUT the reserve) now exceeds it, so
      // the CTA must read "Insufficient balance" rather than reaching the
      // review / reserve-sheet path.
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

      const cta = getByTestId("swap-continue-button");
      expect(cta).toHaveTextContent("Insufficient balance");
      expect(cta.props.accessibilityState?.disabled).toBe(true);
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

    it("calls fetchPricesForTokenIds for the trending list + the active destination", () => {
      // The destination (FTT) is non-held in this fixture, so its price
      // is appended to the trending-list fetch. Without this the
      // receive card sits on '--' for any non-trending token the user
      // picks until they add a trustline.
      renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      expect(mockFetchPricesForTokenIds).toHaveBeenCalledWith({
        tokens: [
          "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          "yXLM:GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55",
          "FTT:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
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

    it("re-opens the same Trending row on a second tap after dismiss", () => {
      // Regression: tapping the same Trending row twice was a no-op
      // because setSelectedTrendingRecord with the same object reference
      // doesn't fire the present-effect. Fix: clear selectedTrendingRecord
      // on dismiss via bottomSheetModalProps.onChange(-1). The next tap
      // then goes null → record → effect → present(). Because the sheet
      // is conditionally mounted, dismissal unmounts it and the second
      // tap re-mounts a fresh ref — assert via __mockSheetRefs membership.
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__mockSheetRefs = [];
      const { getByText } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      act(() => {
        fireEvent.press(getByText("AQUA"));
      });
      // eslint-disable-next-line no-underscore-dangle
      const sheetsAfterFirstTap = globalThis.__mockSheetRefs.length;
      // eslint-disable-next-line no-underscore-dangle
      const firstSheet = globalThis.__mockSheetRefs.at(-1);
      expect(firstSheet?.present).toHaveBeenCalledTimes(1);

      // Simulate the user dismissing the sheet (swipe / backdrop / X) —
      // gorhom fires onChange(-1), which our screen routes to clearing
      // selectedTrendingRecord.
      act(() => {
        firstSheet?.fireDismiss();
      });

      // Tap the SAME row again — should mount a new sheet ref and call
      // present() on it.
      act(() => {
        fireEvent.press(getByText("AQUA"));
      });
      // eslint-disable-next-line no-underscore-dangle
      expect(globalThis.__mockSheetRefs.length).toBeGreaterThan(
        sheetsAfterFirstTap,
      );
      // eslint-disable-next-line no-underscore-dangle
      const secondSheet = globalThis.__mockSheetRefs.at(-1);
      expect(secondSheet?.present).toHaveBeenCalledTimes(1);
      expect(secondSheet).not.toBe(firstSheet);
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

    it("pull-to-refresh calls refreshTrending and surfaces a toast on failure", async () => {
      const refreshTrending = jest
        .fn()
        .mockRejectedValue(new Error("network down"));
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
        refreshTrending,
      });

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      const list = getByTestId("swap-amount-trending-list");
      await act(async () => {
        list.props.refreshControl.props.onRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(refreshTrending).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
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
        | [{ destinationTokenForPath?: Record<string, unknown> }]
        | undefined;
      expect(lastCall?.[0]?.destinationTokenForPath).toEqual(
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
        | [{ destinationTokenForPath?: Record<string, unknown> }]
        | undefined;
      // Held balance carries `total` and `available` BigNumbers (from
      // mockBalances); the adapter projection does not.
      expect(lastCall?.[0]?.destinationTokenForPath).toEqual(
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

    it("swap-direction toggle ENABLED when destination is XLM (regression: descriptor.id 'native' vs balance.id 'XLM')", () => {
      // Pre-fix, descriptorFromBalance/descriptorFromSearchRecord emitted
      // id: "native" for XLM. Production balance.id for XLM is "XLM"
      // (services/backend.ts:298 converts native→XLM). The lookup
      // balanceItems.find(b => b.id === descriptor.id) returned undefined
      // → destinationBalance undefined → canSwapDirection false → toggle
      // stayed disabled and the Receive balance line was hidden.
      const setSourceTokenSpy = jest.fn();
      const setDestinationTokenSpy = jest.fn();
      setSwapStoreState({
        // Source: held classic token (USDC). Destination: XLM (held native).
        sourceTokenId:
          "USDC:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
        sourceTokenSymbol: "USDC",
        destinationToken: {
          id: "XLM",
          tokenCode: "XLM",
          issuer: undefined,
          decimals: 7,
          tokenType: "native",
          isNew: false,
        },
        setSourceToken: setSourceTokenSpy,
        setDestinationToken: setDestinationTokenSpy,
      } as Partial<SwapStoreState>);

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      setSourceTokenSpy.mockClear();
      setDestinationTokenSpy.mockClear();

      fireEvent.press(getByTestId("swap-direction-toggle"));

      // Toggle should fire both setters since XLM is held.
      expect(setSourceTokenSpy).toHaveBeenCalledWith("XLM", "XLM");
      expect(setDestinationTokenSpy).toHaveBeenCalledTimes(1);
    });

    it("swap-direction toggle resets sell to 'Select' when destination is non-held", () => {
      // AQUA is not in mockBalances → destinationBalance is undefined. The
      // new contract: the held source still moves DOWN to the receive slot,
      // and the sell slot resets to the empty "Select" state (no balance to
      // sell from the non-held token).
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

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );
      setSourceTokenSpy.mockClear();
      setDestinationTokenSpy.mockClear();

      fireEvent.press(getByTestId("swap-direction-toggle"));

      // Sell slot cleared (Select state).
      expect(setSourceTokenSpy).toHaveBeenCalledWith("", "");
      // Receive slot gets the descriptor of the held source (XLM).
      expect(setDestinationTokenSpy).toHaveBeenCalledTimes(1);
      const [descriptor] = setDestinationTokenSpy.mock.calls[0];
      expect(descriptor).toEqual(
        expect.objectContaining({ tokenCode: "XLM", isNew: false }),
      );
    });
  });

  describe("Analytics events", () => {
    beforeEach(() => {
      jest.spyOn(analytics, "track").mockClear();
    });

    it("fires SWAP_TO_PICKER_OPENED with source:cta when the 'Select a token' CTA is pressed", async () => {
      setSwapStoreState({ destinationToken: null, sourceAmount: "0" });

      const navigation = makeNavigation();
      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={navigation} route={makeRoute()} />,
      );

      // handleMainButtonPress is async (awaits waitForKeyboardDismiss)
      // — flush microtasks before asserting on the analytics fire.
      await act(async () => {
        fireEvent.press(getByTestId("swap-continue-button"));
        await Promise.resolve();
      });

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

    it("fires SWAP_FROM_PICKER_OPENED with source:dropdown when the Sell pill is tapped", () => {
      // Held source (XLM) → "swap-sell-pill" is rendered; press routes
      // through navigateToSelectSourceTokenScreen which is the only call
      // site for the source-side picker event.
      setSwapStoreState({
        sourceTokenId: "XLM",
        sourceTokenSymbol: "XLM",
      } as Partial<SwapStoreState>);

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      fireEvent.press(getByTestId("swap-sell-pill"));

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_FROM_PICKER_OPENED,
        { source: "dropdown" },
      );
      // Negative assertion: source picker MUST NOT reuse the destination
      // event after the caa4aeab split.
      expect(analytics.track).not.toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TO_PICKER_OPENED,
        { source: "dropdown" },
      );
    });

    it("fires SWAP_DIRECTION_TOGGLED with previous source/destination codes + issuers when the toggle is pressed", () => {
      setSwapStoreState({
        sourceTokenId: "XLM",
        sourceTokenSymbol: "XLM",
        destinationToken: {
          id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          tokenCode: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          decimals: 7,
          tokenType: "credit_alphanum4",
          isNew: false,
        },
      } as Partial<SwapStoreState>);

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      fireEvent.press(getByTestId("swap-direction-toggle"));

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_DIRECTION_TOGGLED,
        expect.objectContaining({
          previousSourceTokenCode: "XLM",
          previousSourceTokenIssuer: "",
          previousDestinationTokenCode: "USDC",
          previousDestinationTokenIssuer:
            "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        }),
      );
    });

    it("fires SWAP_DIRECTION_TOGGLED with a real source issuer when the source is a held classic asset (exercises descriptorFromBalance lookup)", () => {
      // Held USDC source — exercises the descriptorFromBalance(sourceBalance)
      // ?? "" branch with a non-empty issuer string. The two sibling tests
      // both pin previousSourceTokenIssuer: "" (XLM / cleared), so without
      // this case a regression that flattens the issuer to "" goes unnoticed.
      const HELD_USDC_ID =
        "USDC:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH";
      setSwapStoreState({
        sourceTokenId: HELD_USDC_ID,
        sourceTokenSymbol: "USDC",
        destinationToken: {
          id: "XLM",
          tokenCode: "XLM",
          decimals: 7,
          tokenType: "native",
          isNew: false,
        },
      } as Partial<SwapStoreState>);

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      fireEvent.press(getByTestId("swap-direction-toggle"));

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_DIRECTION_TOGGLED,
        expect.objectContaining({
          previousSourceTokenCode: "USDC",
          previousSourceTokenIssuer:
            "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
          previousDestinationTokenCode: "XLM",
          previousDestinationTokenIssuer: "",
        }),
      );
    });

    it("fires SWAP_DIRECTION_TOGGLED capturing non-held destination from the store descriptor (regression: AQUA is absent from balanceItems)", () => {
      // Non-held destination (AQUA absent from mockBalances) + cleared
      // source. The destination payload must come from the store descriptor
      // — destinationBalance is undefined for non-held tokens.
      setSwapStoreState({
        sourceTokenId: "",
        sourceTokenSymbol: "",
        destinationToken: {
          id: "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          tokenCode: "AQUA",
          issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
          decimals: 7,
          tokenType: "credit_alphanum4",
          isNew: true,
        },
      } as Partial<SwapStoreState>);

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      fireEvent.press(getByTestId("swap-direction-toggle"));

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_DIRECTION_TOGGLED,
        expect.objectContaining({
          previousSourceTokenCode: "",
          previousSourceTokenIssuer: "",
          previousDestinationTokenCode: "AQUA",
          previousDestinationTokenIssuer:
            "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
        }),
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
        expect.objectContaining({
          tokenCode: "AQUA",
          position: 0,
          tokenIssuer: expect.any(String),
        }),
      );
    });
  });
});

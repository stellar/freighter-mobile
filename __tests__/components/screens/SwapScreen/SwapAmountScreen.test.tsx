/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import SwapAmountScreen from "components/screens/SwapScreen/screens/SwapAmountScreen";
import Icon from "components/sds/Icon";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useSwapStore } from "ducks/swap";
import { renderWithProviders } from "helpers/testUtils";
import { useBalancesList } from "hooks/useBalancesList";
import React, { act } from "react";
import { View } from "react-native";

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
    it("opens the XLM reserve sheet when destinationToken.isNew && XLM available < 0.5", async () => {
      // Adapter: XLM available is `1000.5` in the default mockBalances. Patch
      // useBalancesList to return an XLM balance below the 0.5 threshold.
      const lowXlmBalances = mockBalances.map((b) => {
        if (b.id !== "XLM") return b;
        return {
          ...b,
          // Source balance display still says 10 USDC; XLM is what we're
          // checking for the trustline reserve.
          available: new BigNumber("0.3"),
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

      // eslint-disable-next-line no-underscore-dangle
      globalThis.__mockSheetRefs = [];

      const { getByTestId } = renderWithProviders(
        <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      await act(async () => {
        fireEvent.press(getByTestId("swap-continue-button"));
        // handleMainButtonPress is async (prepareSwapTransaction). Yield to
        // microtasks so its effects flush before assertions run.
        await Promise.resolve();
      });

      // The XLM reserve sheet's present() should have been called instead
      // of setupSwapTransaction (which sets up the Review sheet).
      const presentedSheets =
        // eslint-disable-next-line no-underscore-dangle
        globalThis.__mockSheetRefs.filter(
          (spy) => spy.present.mock.calls.length > 0,
        );
      expect(presentedSheets.length).toBeGreaterThan(0);
      expect(mockSetupSwapTransaction).not.toHaveBeenCalled();
    });

    it("opens Review sheet when destinationToken.isNew but XLM available >= 0.5", async () => {
      // XLM available is the default 1000.5 — well above the 0.5 trustline
      // reserve. The pre-flight gate should NOT fire, so setupSwapTransaction
      // is called.
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

      expect(mockSetupSwapTransaction).toHaveBeenCalled();
    });
  });
});

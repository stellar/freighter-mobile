/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import EarnAmountScreen from "components/screens/EarnScreen/screens/EarnAmountScreen";
import { EARN_ROUTES, EarnStackParamList } from "config/routes";
import { useEarnStore } from "ducks/earn";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { renderWithProviders } from "helpers/testUtils";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import React from "react";

import { mockGestureHandler } from "../../../../__mocks__/gesture-handler";
import { mockUseColors } from "../../../../__mocks__/use-colors";

mockGestureHandler();
mockUseColors();

// This is the screen the final whole-branch review flagged as untested
// (FIX 3): it owns the CTA precedence, the fee-gate ordering, the
// clamp/re-simulate sequence, the inline processing gate, and the retry-
// banner lifecycle. It is also where FIX 2 (the ~5,000x-too-low fee-headroom
// gate) actually lives, so the fee-gate tests below double as FIX 2's
// coverage.
//
// Mocking approach modeled on
// __tests__/components/screens/SwapScreen/SwapAmountScreen.test.tsx: a
// stubbed <BottomSheet> that records each sheet's imperative ref (by
// declaration order) instead of rendering `customContent`, so we can assert
// which sheet was presented — and in what order relative to `simulate` —
// without needing to mount the real review/fee/security sheets.

type SheetRefSpy = {
  present: jest.Mock;
  dismiss: jest.Mock;
};
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace, vars-on-top, no-var, no-underscore-dangle, @typescript-eslint/naming-convention
  var __earnAmountMockSheetRefs: SheetRefSpy[];
}
// eslint-disable-next-line no-underscore-dangle
globalThis.__earnAmountMockSheetRefs = [];

jest.mock("components/BottomSheet", () => {
  /* eslint-disable global-require, @typescript-eslint/no-var-requires, @typescript-eslint/no-shadow */
  const ReactModule = require("react");
  const RNModule = require("react-native");
  /* eslint-enable global-require, @typescript-eslint/no-var-requires, @typescript-eslint/no-shadow */

  const NoopSheet = (props: { modalRef?: React.RefObject<unknown> }) => {
    const { modalRef } = props;
    ReactModule.useImperativeHandle(modalRef, () => {
      const spy: SheetRefSpy = { present: jest.fn(), dismiss: jest.fn() };
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__earnAmountMockSheetRefs.push(spy);
      return spy;
    }, []);
    // Don't render customContent — mirrors Swap's stub. The child sheets
    // (fee/review/security) are never mounted, so they need no mocks of
    // their own.
    return ReactModule.createElement(RNModule.View);
  };
  return { __esModule: true, default: NoopSheet };
});

// EarnAmountScreen renders EarnProcessingScreen inline (not a registered
// route) whenever mockEarnTransactionStatus !== "idle". Stub it via the barrel
// it's imported through — EarnAmountScreen itself is imported by its own
// path below, so this mock only affects that one barrel import.
jest.mock("components/screens/EarnScreen/screens", () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const RNModule = require("react-native");
  return {
    EarnProcessingScreen: ({ status }: { status: string }) => (
      <RNModule.View
        testID="earn-processing-mock"
        accessibilityLabel={status}
      />
    ),
  };
});

const mockSimulate = jest.fn();
const mockSubmitEarnTransaction = jest.fn();
const mockResetEarnTransactionStatus = jest.fn();
const mockAbandonEarnTransaction = jest.fn();

let mockEarnTransactionStatus: "idle" | "submitting" | "success" | "error" =
  "idle";

jest.mock("components/screens/EarnScreen/hooks/useSimulateEarnDeposit", () => ({
  useSimulateEarnDeposit: () => ({
    simulate: mockSimulate,
    isSimulating: false,
    error: null,
    scanResult: undefined,
  }),
}));

jest.mock("components/screens/EarnScreen/hooks/useEarnTransaction", () => ({
  useEarnTransaction: () => ({
    status: mockEarnTransactionStatus,
    error: null,
    submit: mockSubmitEarnTransaction,
    reset: mockResetEarnTransactionStatus,
    abandon: mockAbandonEarnTransaction,
  }),
}));

jest.mock("components/screens/EarnScreen/hooks/useEarnPosition", () => ({
  useEarnPosition: () => ({ currentPositionTokens: "0" }),
}));

jest.mock("hooks/useGetActiveAccount");
jest.mock("hooks/useTokenFiatConverter");

jest.mock("hooks/useNetworkFees", () => ({
  useNetworkFees: () => ({
    recommendedFee: "",
    networkCongestion: "low",
    feePresets: {},
  }),
  clearNetworkFeesCache: jest.fn(),
}));

jest.mock("hooks/useInitialRecommendedFee", () => ({
  useInitialRecommendedFee: jest.fn(),
}));

const mockCalculateSpendableAmount = jest.fn();
const mockGetBalanceByContractId = jest.fn();
jest.mock("helpers/balances", () => ({
  // Real implementation for everything else — `TokenIcon`/`TokenIconWithBadge`
  // (rendered by the real, unmocked `AmountCard`) reach into this module too
  // (`isLiquidityPool`, `getTokenIdentifier`), and a full replacement would
  // silently drop those.
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  ...jest.requireActual("helpers/balances"),
  calculateSpendableAmount: (...args: unknown[]) =>
    mockCalculateSpendableAmount(...args),
  getBalanceByContractId: (...args: unknown[]) =>
    mockGetBalanceByContractId(...args),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "TESTNET" }),
}));

// eslint-disable-next-line prefer-const
let mockPricedBalances: Record<string, unknown> = {};
jest.mock("ducks/balances", () => ({
  useBalancesStore: () => ({ pricedBalances: mockPricedBalances }),
}));

jest.mock("ducks/debug", () => ({
  useDebugStore: () => ({ overriddenBlockaidResponse: undefined }),
}));

jest.mock("services/blockaid/helper", () => ({
  assessTransactionSecurity: () => ({
    isMalicious: false,
    isSuspicious: false,
    isUnableToScan: false,
  }),
  extractSecurityWarnings: () => [],
}));

const mockShowToast = jest.fn();
jest.mock("providers/ToastProvider", () => {
  /* eslint-disable global-require, @typescript-eslint/no-var-requires */
  const ReactModule = require("react");
  const RNModule = require("react-native");
  /* eslint-enable global-require, @typescript-eslint/no-var-requires */
  return {
    ToastProvider: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(RNModule.View, null, children),
    useToast: () => ({ showToast: mockShowToast }),
  };
});

// Plain-key translation, matching the established pattern in
// TransactionAmountScreen.test.tsx — assertions target the i18n key itself
// rather than locale copy.
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

const USDC_ASSET_ID =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const POOL_ID = "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD";

const USDC_BALANCE = {
  id: USDC_ASSET_ID,
  contractId: USDC_ASSET_ID,
  token: { code: "USDC", type: "credit_alphanum4" },
  total: new BigNumber("1000"),
  available: new BigNumber("1000"),
  currentPrice: new BigNumber("1"),
} as never;

const XLM_BALANCE = {
  id: "XLM",
  token: { type: "native", code: "XLM" },
  total: new BigNumber("10"),
  available: new BigNumber("10"),
} as never;

type Props = NativeStackScreenProps<
  EarnStackParamList,
  typeof EARN_ROUTES.EARN_AMOUNT_SCREEN
>;

const makeNavigation = () =>
  ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
  }) as unknown as Props["navigation"];

const makeRoute = () =>
  ({
    key: "earn-amount",
    name: EARN_ROUTES.EARN_AMOUNT_SCREEN,
    params: { assetId: USDC_ASSET_ID, tokenCode: "USDC" },
  }) as unknown as Props["route"];

/**
 * Configures the two `calculateSpendableAmount` call sites EarnAmountScreen
 * makes: once for the deposit asset (drives `maxDepositable`) and once for
 * XLM (drives the fee-headroom check). When the deposit asset IS XLM, both
 * calls target the same balance object, so `xlm` wins for both — matching
 * production, where there is only one balance to ask.
 */
const setSpendable = ({ deposit, xlm }: { deposit: string; xlm: string }) => {
  mockCalculateSpendableAmount.mockImplementation(
    ({ balance }: { balance: unknown }) =>
      balance === XLM_BALANCE ? new BigNumber(xlm) : new BigNumber(deposit),
  );
};

const setTokenAmount = (
  tokenAmount: string,
  overrides: Record<string, unknown> = {},
) => {
  (useTokenFiatConverter as jest.Mock).mockReturnValue({
    tokenAmount,
    tokenAmountDisplay: tokenAmount,
    tokenAmountDisplayRaw: null,
    fiatAmount: "0",
    fiatAmountDisplay: "0",
    fiatAmountDisplayRaw: null,
    showFiatAmount: false,
    pasteRejectNonce: 0,
    setTokenAmount: jest.fn(),
    setFiatAmount: jest.fn(),
    setShowFiatAmount: jest.fn(),
    setDisplayAmountFromText: jest.fn(),
    updateFiatDisplay: jest.fn(),
    ...overrides,
  });
};

describe("EarnAmountScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line no-underscore-dangle
    globalThis.__earnAmountMockSheetRefs = [];
    mockEarnTransactionStatus = "idle";
    mockPricedBalances = { XLM: XLM_BALANCE, [USDC_ASSET_ID]: USDC_BALANCE };

    useEarnStore.getState().resetEarn();
    useEarnStore.getState().setPool({ id: POOL_ID, name: "Fixed" } as never);
    useEarnStore.getState().selectAsset({
      assetId: USDC_ASSET_ID,
      apy: 0.1694,
      code: "USDC",
      decimals: 7,
    });

    useTransactionSettingsStore.getState().resetSettings();
    useTransactionBuilderStore.getState().resetTransaction();

    (useGetActiveAccount as jest.Mock).mockReturnValue({
      account: {
        publicKey: "GSENDER",
        privateKey: "SPRIVATE",
        subentryCount: 0,
      },
    });

    mockGetBalanceByContractId.mockReturnValue(USDC_BALANCE);
    // Generous defaults: enough of both assets that no guard fires unless a
    // test deliberately narrows it.
    setSpendable({ deposit: "1000", xlm: "10" });
    setTokenAmount("10");

    mockSimulate.mockResolvedValue({
      preparedXdr: "prepared-xdr",
      scanResult: undefined,
    });
  });

  const renderScreen = () =>
    renderWithProviders(
      <EarnAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
    );

  describe("CTA state machine", () => {
    it("disables the CTA with 'insufficient' when the spendable balance is zero", () => {
      setSpendable({ deposit: "0", xlm: "10" });
      setTokenAmount("0");

      const { getByTestId } = renderScreen();
      const cta = getByTestId("earn-amount-cta");

      expect(cta).toHaveTextContent("earnAmount.insufficientFunds");
      expect(cta.props.accessibilityState?.disabled).toBe(true);
    });

    it("disables the CTA with 'enter' when the amount is zero", () => {
      setTokenAmount("0");

      const { getByTestId } = renderScreen();
      const cta = getByTestId("earn-amount-cta");

      expect(cta).toHaveTextContent("earnAmount.enterAmount");
      expect(cta.props.accessibilityState?.disabled).toBe(true);
    });

    it("disables the CTA with 'insufficient' when the amount exceeds the max depositable", () => {
      setSpendable({ deposit: "10", xlm: "10" });
      setTokenAmount("9999");

      const { getByTestId } = renderScreen();
      const cta = getByTestId("earn-amount-cta");

      expect(cta).toHaveTextContent("earnAmount.insufficientFunds");
      expect(cta.props.accessibilityState?.disabled).toBe(true);
    });

    it("enables the CTA with 'review' once a valid amount is entered", () => {
      const { getByTestId } = renderScreen();
      const cta = getByTestId("earn-amount-cta");

      expect(cta).toHaveTextContent("earnAmount.review");
      expect(cta.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  describe("fee-headroom gate (FIX 2)", () => {
    it("opens the fee sheet BEFORE calling simulate when spendable XLM sits in the resource-fee band", async () => {
      // transactionFee defaults to MIN_TRANSACTION_FEE ("0.00001"). The
      // buffered threshold is transactionFee + BLEND_DEPOSIT_XLM_FEE_BUFFER
      // ("0.5") = "0.50001". 0.1 clears the bare inclusion fee (the
      // pre-fix gate) but falls inside the real resource-fee band, which is
      // exactly the ~5,000x gap FIX 2 closes.
      setSpendable({ deposit: "1000", xlm: "0.1" });
      setTokenAmount("10");

      const { getByTestId } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();

      // eslint-disable-next-line no-underscore-dangle
      const [feeSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(feeSheet.present).toHaveBeenCalledTimes(1);
      expect(mockSimulate).not.toHaveBeenCalled();
    });

    it("does not trip the gate for an XLM deposit that leaves >= 0.5 XLM spendable", async () => {
      // Regression guard noted in the review: the CTA's own insufficient-
      // funds check already keeps any XLM amount that reaches this gate at
      // >= 0.5 XLM spendable, so the raised threshold must not fire here.
      mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
      setSpendable({ deposit: "0.6", xlm: "0.6" });
      setTokenAmount("0.05");

      useTransactionBuilderStore.setState({ sorobanResourceFeeXlm: "0.01" });

      const { getByTestId } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      // eslint-disable-next-line no-underscore-dangle
      const [feeSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(feeSheet.present).not.toHaveBeenCalled();
      expect(mockSimulate).toHaveBeenCalledTimes(1);
    });
  });

  describe("simulate -> Review ordering", () => {
    it("opens Review only after simulate resolves successfully", async () => {
      mockSimulate.mockResolvedValue({
        preparedXdr: "prepared-xdr",
        scanResult: undefined,
      });
      useTransactionBuilderStore.setState({ sorobanResourceFeeXlm: "0.01" });

      const { getByTestId } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSimulate).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line no-underscore-dangle
      const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(reviewSheet.present).toHaveBeenCalledTimes(1);
    });

    it("does not open Review when simulate fails", async () => {
      mockSimulate.mockResolvedValue(null);

      const { getByTestId } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSimulate).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line no-underscore-dangle
      const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(reviewSheet.present).not.toHaveBeenCalled();
    });
  });

  describe("inline processing gate", () => {
    it("renders the processing screen inline once status leaves idle", () => {
      mockEarnTransactionStatus = "submitting";

      const { getByTestId, queryByTestId } = renderScreen();

      expect(getByTestId("earn-processing-mock")).toBeTruthy();
      expect(queryByTestId("earn-amount-screen")).toBeNull();
    });

    it("renders the normal amount screen while status is idle", () => {
      const { getByTestId, queryByTestId } = renderScreen();

      expect(getByTestId("earn-amount-screen")).toBeTruthy();
      expect(queryByTestId("earn-processing-mock")).toBeNull();
    });
  });

  describe("retry banner lifecycle", () => {
    it("shows the retry banner when lastSubmitFailed is true, and clears it on an amount edit", () => {
      useEarnStore.setState({ lastSubmitFailed: true });

      const { getByText, queryByText, rerender } = renderScreen();

      expect(getByText("earnAmount.retryBanner")).toBeTruthy();

      // Simulate the user editing the amount: the tokenAmount the screen
      // reads changes across a re-render of the SAME mounted instance.
      setTokenAmount("5");
      rerender(
        <EarnAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      expect(useEarnStore.getState().lastSubmitFailed).toBe(false);
      expect(queryByText("earnAmount.retryBanner")).toBeNull();
    });

    it("does not show the retry banner when lastSubmitFailed is false", () => {
      const { queryByText } = renderScreen();

      expect(queryByText("earnAmount.retryBanner")).toBeNull();
    });
  });
});

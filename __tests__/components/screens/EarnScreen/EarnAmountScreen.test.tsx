/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, fireEvent } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import { AmountCard } from "components/AmountCard";
import { ReceiveFundsBottomSheet } from "components/screens/EarnScreen/components/ReceiveFundsBottomSheet";
import { UNKNOWN_RESOURCE_FEE_FLOOR_XLM } from "components/screens/EarnScreen/helpers";
import EarnAmountScreen from "components/screens/EarnScreen/screens/EarnAmountScreen";
import { AnalyticsEvent } from "config/analyticsConfig";
import { BLEND_FIXED_POOL_IDS } from "config/blend";
import { NETWORKS } from "config/constants";
import { EARN_ROUTES, EarnStackParamList } from "config/routes";
import { useEarnStore } from "ducks/earn";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { renderWithProviders } from "helpers/testUtils";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import React from "react";
import { BackHandler } from "react-native";

import { mockUseColors } from "../../../../__mocks__/use-colors";

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
  // eslint-disable-next-line @typescript-eslint/no-namespace, vars-on-top, no-var, no-underscore-dangle, @typescript-eslint/naming-convention
  var __earnAmountMockSheetContents: React.ReactElement[];
  // eslint-disable-next-line @typescript-eslint/no-namespace, vars-on-top, no-var, no-underscore-dangle, @typescript-eslint/naming-convention
  var __earnAmountMockSheetProps: Record<string, unknown>[];
}
// eslint-disable-next-line no-underscore-dangle
globalThis.__earnAmountMockSheetRefs = [];
// eslint-disable-next-line no-underscore-dangle
globalThis.__earnAmountMockSheetContents = [];
// eslint-disable-next-line no-underscore-dangle
globalThis.__earnAmountMockSheetProps = [];

jest.mock("components/BottomSheet", () => {
  /* eslint-disable global-require, @typescript-eslint/no-var-requires, @typescript-eslint/no-shadow */
  const ReactModule = require("react");
  const RNModule = require("react-native");
  /* eslint-enable global-require, @typescript-eslint/no-var-requires, @typescript-eslint/no-shadow */

  const NoopSheet = (props: {
    modalRef?: React.RefObject<unknown>;
    customContent?: React.ReactElement;
  }) => {
    const { modalRef, customContent } = props;
    ReactModule.useImperativeHandle(modalRef, () => {
      const spy: SheetRefSpy = { present: jest.fn(), dismiss: jest.fn() };
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__earnAmountMockSheetRefs.push(spy);
      return spy;
    }, []);
    // eslint-disable-next-line no-underscore-dangle
    globalThis.__earnAmountMockSheetProps.push(props);
    // Recorded, not rendered, so a test can call a child sheet's handlers.
    if (customContent) {
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__earnAmountMockSheetContents.push(customContent);
    }
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
    EarnProcessingScreen: ({
      status,
      onCloseWhileSubmitting,
    }: {
      status: string;
      onCloseWhileSubmitting: () => void;
    }) => (
      <RNModule.View testID="earn-processing-mock" accessibilityLabel={status}>
        <RNModule.Pressable
          testID="earn-processing-close"
          onPress={onCloseWhileSubmitting}
        />
      </RNModule.View>
    ),
  };
});

// The Earn funnel events all go through `track` (mocked in jest.setup.js);
// asserting on it checks the event name and the payload the extension uses.
const { track: mockTrack } = jest.requireMock("services/analytics/core");

const mockSimulate = jest.fn();
const mockSubmitEarnTransaction = jest.fn();
const mockResetEarnTransactionStatus = jest.fn();
const mockAbandonEarnTransaction = jest.fn();

let mockEarnTransactionStatus: "idle" | "submitting" | "success" | "error" =
  "idle";
let mockEarnTransactionHash: string | null = null;

// Settable per-test so the failed-simulation message-swap effect (see
// `EarnAmountScreen`'s `simulateError` useEffect) can be exercised without
// actually driving a rejected `simulate()` call through this mock.
let mockSimulateError: string | null = null;

jest.mock("components/screens/EarnScreen/hooks/useSimulateEarnDeposit", () => ({
  useSimulateEarnDeposit: () => ({
    simulate: mockSimulate,
    isSimulating: false,
    error: mockSimulateError,
    scanResult: undefined,
  }),
}));

jest.mock("components/screens/EarnScreen/hooks/useEarnTransaction", () => ({
  useEarnTransaction: () => ({
    status: mockEarnTransactionStatus,
    transactionHash: mockEarnTransactionHash,
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

let mockTransactionAssessment = {
  isMalicious: false,
  isSuspicious: false,
  isUnableToScan: false,
};
jest.mock("services/blockaid/helper", () => ({
  assessTransactionSecurity: () => mockTransactionAssessment,
  extractSecurityWarnings: () => [],
}));

const mockShowToast = jest.fn();
const mockDismissToast = jest.fn();
jest.mock("providers/ToastProvider", () => {
  /* eslint-disable global-require, @typescript-eslint/no-var-requires */
  const ReactModule = require("react");
  const RNModule = require("react-native");
  /* eslint-enable global-require, @typescript-eslint/no-var-requires */
  return {
    ToastProvider: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(RNModule.View, null, children),
    useToast: () => ({
      showToast: mockShowToast,
      dismissToast: mockDismissToast,
    }),
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
const POOL_ID = BLEND_FIXED_POOL_IDS[NETWORKS.PUBLIC]!;

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

let mockSetOptions = jest.fn();
const makeNavigation = () =>
  ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
    setOptions: mockSetOptions,
  }) as unknown as Props["navigation"];

const makeRoute = () =>
  ({
    key: "earn-amount",
    name: EARN_ROUTES.EARN_AMOUNT_SCREEN,
    params: { assetId: USDC_ASSET_ID, tokenCode: "USDC" },
  }) as unknown as Props["route"];

/**
 * Configures the two `calculateSpendableAmount` call sites EarnAmountScreen
 * makes: once for the deposit asset (drives the deposit maximum) and once for
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
    // eslint-disable-next-line no-underscore-dangle
    globalThis.__earnAmountMockSheetContents = [];
    // eslint-disable-next-line no-underscore-dangle
    globalThis.__earnAmountMockSheetProps = [];
    mockTransactionAssessment = {
      isMalicious: false,
      isSuspicious: false,
      isUnableToScan: false,
    };
    mockEarnTransactionStatus = "idle";
    mockEarnTransactionHash = null;
    mockSimulateError = null;
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
      setTokenAmount("1");

      const { getByTestId } = renderScreen();
      const cta = getByTestId("earn-amount-cta");

      expect(cta).toHaveTextContent("swapScreen.cta.insufficientBalance");
      expect(cta.props.accessibilityState?.disabled).toBe(true);
    });

    it("offers 25% / 50% / Max, without 75%, in place of the CTA while the amount is zero", () => {
      setTokenAmount("0");

      const { getByTestId, queryByTestId } = renderScreen();

      expect(queryByTestId("earn-amount-cta")).toBeNull();
      expect(getByTestId("earn-amount-percentage-buttons")).toBeTruthy();
      expect(getByTestId("percentage-25")).toBeTruthy();
      expect(getByTestId("percentage-50")).toBeTruthy();
      expect(getByTestId("percentage-100")).toBeTruthy();
      expect(queryByTestId("percentage-75")).toBeNull();
    });

    it("disables the CTA with 'insufficient' when the amount exceeds the max depositable", () => {
      setSpendable({ deposit: "10", xlm: "10" });
      setTokenAmount("9999");

      const { getByTestId } = renderScreen();
      const cta = getByTestId("earn-amount-cta");

      expect(cta).toHaveTextContent("swapScreen.cta.insufficientBalance");
      expect(cta.props.accessibilityState?.disabled).toBe(true);
    });

    // The same as Swap: a toast with the maximum, the CTA reading
    // "Insufficient balance", and the amount left in its normal colour.
    describe("an amount above the spendable balance", () => {
      it("shows Swap's maximum-spendable toast", () => {
        setSpendable({ deposit: "10", xlm: "10" });
        setTokenAmount("9999");

        renderScreen();

        expect(mockShowToast).toHaveBeenCalledWith({
          variant: "error",
          title: "swapScreen.errors.insufficientBalance",
          toastId: "earn-insufficient-balance",
          duration: 3000,
        });
      });

      it("keeps the amount in its normal colour", () => {
        setSpendable({ deposit: "10", xlm: "10" });
        setTokenAmount("9999");

        const { UNSAFE_getByType: getByType } = renderScreen();

        expect(getByType(AmountCard).props.isError).toBeFalsy();
      });

      it("takes the toast down once the amount fits", () => {
        setSpendable({ deposit: "10", xlm: "10" });
        setTokenAmount("9999");
        const { rerender } = renderScreen();

        setTokenAmount("5");
        rerender(
          <EarnAmountScreen
            navigation={makeNavigation()}
            route={makeRoute()}
          />,
        );

        expect(mockDismissToast).toHaveBeenCalledWith(
          "earn-insufficient-balance",
        );
      });

      it("shows no toast for an amount that fits", () => {
        setSpendable({ deposit: "10", xlm: "10" });
        setTokenAmount("5");

        renderScreen();

        expect(mockShowToast).not.toHaveBeenCalledWith(
          expect.objectContaining({ toastId: "earn-insufficient-balance" }),
        );
      });

      // The deposit's own balance refresh puts the amount above what's left;
      // that isn't the user typing too much. It showed on "Deposit complete"
      // and followed the user Home.
      it.each(["submitting", "success"] as const)(
        "stays quiet while the deposit is %s",
        (status) => {
          mockEarnTransactionStatus = status;
          setSpendable({ deposit: "0.5", xlm: "10" });
          setTokenAmount("1");

          renderScreen();

          expect(mockShowToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ toastId: "earn-insufficient-balance" }),
          );
        },
      );
    });

    it("enables the CTA with 'review' once a valid amount is entered", () => {
      const { getByTestId } = renderScreen();
      const cta = getByTestId("earn-amount-cta");

      expect(cta).toHaveTextContent("earnAmount.review");
      expect(cta.props.accessibilityState?.disabled).toBeFalsy();
    });

    it("offers the whole spendable balance for an XLM deposit -- no fee buffer held back", () => {
      // A prior design held back a guessed 0.5 XLM buffer from Max, which
      // made depositing the full spendable balance read as "insufficient".
      // That buffer is gone: the full balance is now a valid amount.
      mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
      setSpendable({ deposit: "100", xlm: "100" });
      setTokenAmount("100");

      const { getByTestId } = renderScreen();
      const cta = getByTestId("earn-amount-cta");

      expect(cta).toHaveTextContent("earnAmount.review");
      expect(cta.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  describe("fee-headroom gate", () => {
    it("opens the fee sheet BEFORE calling simulate when the account has no spendable XLM at all", async () => {
      // The 0.5 XLM buffer is gone, so this pre-simulation gate now only
      // needs to catch a zero-XLM account -- anything else clears it and is
      // caught post-simulation instead (see "post-simulation fee shortfall"
      // below), once the real resource fee is known.
      setSpendable({ deposit: "1000", xlm: "0" });
      setTokenAmount("10");

      const { getByTestId } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();

      // eslint-disable-next-line no-underscore-dangle
      const [feeSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(feeSheet.present).toHaveBeenCalledTimes(1);
      expect(mockSimulate).not.toHaveBeenCalled();
      expect(mockTrack).toHaveBeenCalledWith(
        "earn.xlm_fee_insufficient_shown",
        {
          protocol: "blend",
          asset_code: "USDC",
          reason: "no_xlm",
        },
      );
    });

    it("does not trip the gate once there is any spendable XLM, even far less than a Blend submit's resource fee", async () => {
      // This is exactly the case the buffer used to guess at pre-simulation.
      // Now it clears this gate (it is not "zero XLM") and simulate runs;
      // whether it actually covers the real fee is the shortfall check's job.
      mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
      setSpendable({ deposit: "0.1", xlm: "0.1" });
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

  describe("post-simulation fee shortfall", () => {
    it("blocks Review and surfaces the reduce-by amount when a typed deposit does not leave enough XLM for the measured fee", async () => {
      // 0.01 XLM left over, less than the resource fee simulation is about
      // to report. Typed, not Max, so the amount is left to the user.
      mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
      setSpendable({ deposit: "100", xlm: "100" });
      setTokenAmount("99.99");

      mockSimulate.mockImplementation(() => {
        useTransactionBuilderStore.setState({
          sorobanResourceFeeXlm: "0.0546395",
        });
        return { preparedXdr: "prepared-xdr", scanResult: undefined };
      });

      const { getByTestId } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSimulate).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line no-underscore-dangle
      const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(reviewSheet.present).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          toastId: "earn-fee-shortfall",
        }),
      );
    });

    // Max fills the whole spendable XLM, which leaves nothing for the
    // resource fee, known only once simulation returns. The deposit is
    // lowered by that fee and built again, as main Swap applies Max again
    // when its quote's fee is higher.
    describe("a Max XLM deposit", () => {
      const reviewedTokenAmount = () => {
        // eslint-disable-next-line no-underscore-dangle
        const contents = [...globalThis.__earnAmountMockSheetContents];
        const review = contents
          .reverse()
          .find((content) => "onSettingsPress" in (content.props as object));
        return (review?.props as { tokenAmount?: string } | undefined)
          ?.tokenAmount;
      };

      const pressReview = async () => {
        const utils = renderScreen();
        await act(async () => {
          fireEvent.press(utils.getByTestId("earn-amount-cta"));
          await Promise.resolve();
        });
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });
        return utils;
      };

      let mockSetTokenAmount: jest.Mock;
      beforeEach(() => {
        mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
        setSpendable({ deposit: "100", xlm: "100" });
        mockSetTokenAmount = jest.fn();
        setTokenAmount("100", { setTokenAmount: mockSetTokenAmount });
      });

      const measureFees = (...fees: string[]) => {
        fees.forEach((fee) => {
          mockSimulate.mockImplementationOnce(() => {
            useTransactionBuilderStore.setState({ sorobanResourceFeeXlm: fee });
            return Promise.resolve({
              preparedXdr: "prepared-xdr",
              scanResult: undefined,
            });
          });
        });
      };

      it("is lowered by the measured fee and built again", async () => {
        measureFees("0.0546395", "0.0546395");

        await pressReview();

        expect(mockSimulate).toHaveBeenCalledTimes(2);
        expect(mockSimulate).toHaveBeenLastCalledWith(
          expect.objectContaining({ amount: "99.9453605" }),
        );
        expect(mockSetTokenAmount).toHaveBeenCalledWith("99.9453605");
      });

      it("opens Review with the lowered amount, and no toast", async () => {
        measureFees("0.0546395", "0.0546395");

        await pressReview();

        // eslint-disable-next-line no-underscore-dangle
        const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
        expect(reviewSheet.present).toHaveBeenCalledTimes(1);
        expect(reviewedTokenAmount()).toBe("99.9453605");
        expect(mockShowToast).not.toHaveBeenCalledWith(
          expect.objectContaining({ toastId: "earn-fee-shortfall" }),
        );
      });

      it("keeps the fiat line in step in fiat mode", async () => {
        mockGetBalanceByContractId.mockReturnValue({
          ...(XLM_BALANCE as object),
          currentPrice: new BigNumber("0.5"),
        });
        const mockUpdateFiatDisplay = jest.fn();
        setTokenAmount("100", {
          setTokenAmount: mockSetTokenAmount,
          showFiatAmount: true,
          updateFiatDisplay: mockUpdateFiatDisplay,
        });
        measureFees("0.0546395", "0.0546395");

        await pressReview();

        // 99.9453605 XLM at $0.50.
        expect(mockUpdateFiatDisplay).toHaveBeenCalledWith("49.97");
        expect(mockSetTokenAmount).toHaveBeenCalledWith("99.9453605");
      });

      it("asks for a smaller deposit when the lowered one is still short", async () => {
        // The second build measures a higher fee than the first.
        measureFees("0.05", "0.06");

        await pressReview();

        // eslint-disable-next-line no-underscore-dangle
        const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
        expect(mockSimulate).toHaveBeenCalledTimes(2);
        expect(reviewSheet.present).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({ toastId: "earn-fee-shortfall" }),
        );
      });
    });

    // Review shows the deposit as it is when it opens.
    it("locks the amount while the deposit is being built", async () => {
      let resolveSimulate: (value: unknown) => void = () => {};
      mockSimulate.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSimulate = resolve;
          }),
      );
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("earn-amount-cta"));

      expect(getByTestId("earn-amount-input").props.editable).toBe(false);

      await act(async () => {
        resolveSimulate({ preparedXdr: "prepared-xdr", scanResult: undefined });
        await Promise.resolve();
      });

      expect(getByTestId("earn-amount-input").props.editable).not.toBe(false);
    });

    it("shows nothing once the deposit is built if the user has left", async () => {
      mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
      setSpendable({ deposit: "100", xlm: "100" });
      setTokenAmount("100");
      let resolveSimulate: (value: unknown) => void = () => {};
      mockSimulate.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSimulate = resolve;
          }),
      );
      const { getByTestId, unmount } = renderScreen();

      fireEvent.press(getByTestId("earn-amount-cta"));
      unmount();
      await act(async () => {
        // Depositing all 100 XLM leaves nothing for this fee.
        useTransactionBuilderStore.setState({
          sorobanResourceFeeXlm: "0.0546395",
        });
        resolveSimulate({ preparedXdr: "prepared-xdr", scanResult: undefined });
        await Promise.resolve();
      });

      expect(mockShowToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ toastId: "earn-fee-shortfall" }),
      );
    });

    it("lets a non-XLM deposit through when the spendable XLM covers the measured fee", async () => {
      // Deposit asset is USDC (this suite's default balance); depositing the
      // whole USDC balance doesn't touch the XLM the fee is paid from.
      setSpendable({ deposit: "1000", xlm: "10" });
      setTokenAmount("1000");

      mockSimulate.mockImplementation(() => {
        useTransactionBuilderStore.setState({
          sorobanResourceFeeXlm: "0.0546395",
        });
        return { preparedXdr: "prepared-xdr", scanResult: undefined };
      });

      const { getByTestId } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      // eslint-disable-next-line no-underscore-dangle
      const [feeSheet, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(reviewSheet.present).toHaveBeenCalledTimes(1);
      expect(feeSheet.present).not.toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ toastId: "earn-fee-shortfall" }),
      );
    });

    it("opens the XLM fee sheet when a non-XLM deposit's measured fee is more than the spendable XLM", async () => {
      // Enough XLM to clear the pre-simulation gate, not enough for a Blend
      // submit's resource fee: signing would fail on-chain.
      setSpendable({ deposit: "1000", xlm: "0.01" });
      setTokenAmount("10");

      mockSimulate.mockImplementation(() => {
        useTransactionBuilderStore.setState({
          sorobanResourceFeeXlm: "0.0546395",
        });
        return { preparedXdr: "prepared-xdr", scanResult: undefined };
      });

      const { getByTestId } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      // eslint-disable-next-line no-underscore-dangle
      const [feeSheet, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(mockSimulate).toHaveBeenCalledTimes(1);
      expect(feeSheet.present).toHaveBeenCalledTimes(1);
      expect(reviewSheet.present).not.toHaveBeenCalled();
      expect(mockTrack).toHaveBeenCalledWith(
        "earn.xlm_fee_insufficient_shown",
        {
          protocol: "blend",
          asset_code: "USDC",
          reason: "fee_not_covered",
        },
      );
      // The reduce-your-deposit toast is for XLM deposits only.
      expect(mockShowToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ toastId: "earn-fee-shortfall" }),
      );
    });

    it("checks a non-XLM deposit against the unknown-fee floor when simulation reports no fee", async () => {
      setSpendable({ deposit: "1000", xlm: "0.05" });
      setTokenAmount("10");

      mockSimulate.mockImplementation(() => {
        useTransactionBuilderStore.setState({ sorobanResourceFeeXlm: null });
        return { preparedXdr: "prepared-xdr", scanResult: undefined };
      });

      const { getByTestId } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      // eslint-disable-next-line no-underscore-dangle
      const [feeSheet, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(feeSheet.present).toHaveBeenCalledTimes(1);
      expect(reviewSheet.present).not.toHaveBeenCalled();
    });

    it("blocks with the shortfall message when the resource fee is unknown (null) and the deposit is near-max", async () => {
      // `null` must never be treated as "0": a near-max deposit leaves less
      // room than the unknown-fee floor, so this must still block rather
      // than silently letting Review open (the bug the fix report's finding
      // flagged -- feeding "0" here would report "0" every time, since
      // tokenAmount <= spendableXlm always holds by construction).
      mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
      setSpendable({ deposit: "100", xlm: "100" });
      setTokenAmount("99.95");

      mockSimulate.mockImplementation(() => {
        useTransactionBuilderStore.setState({ sorobanResourceFeeXlm: null });
        return { preparedXdr: "prepared-xdr", scanResult: undefined };
      });

      const { getByTestId } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      // eslint-disable-next-line no-underscore-dangle
      const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(reviewSheet.present).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          toastId: "earn-fee-shortfall",
        }),
      );
    });

    it("still lets Review open when the resource fee is unknown (null) but the deposit leaves well over the unknown-fee floor", async () => {
      mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
      setSpendable({ deposit: "100", xlm: "100" });
      setTokenAmount("10");

      mockSimulate.mockImplementation(() => {
        useTransactionBuilderStore.setState({ sorobanResourceFeeXlm: null });
        return { preparedXdr: "prepared-xdr", scanResult: undefined };
      });

      const { getByTestId } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      // eslint-disable-next-line no-underscore-dangle
      const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(reviewSheet.present).toHaveBeenCalledTimes(1);
      expect(mockShowToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ toastId: "earn-fee-shortfall" }),
      );
    });

    it("leaves Max and the enterable amount unaffected by the unknown-fee floor", () => {
      // The floor only feeds the post-simulation shortfall check on the rare
      // null-fee branch -- it must never reduce what Max/the percentage
      // buttons offer or what the CTA treats as "too high", regardless of
      // what `sorobanResourceFeeXlm` happens to be. Depositing the FULL
      // spendable balance must stay enabled even with the floor sitting in
      // the duck.
      mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
      setSpendable({ deposit: "100", xlm: "100" });
      setTokenAmount("100");
      useTransactionBuilderStore.setState({
        sorobanResourceFeeXlm: UNKNOWN_RESOURCE_FEE_FLOOR_XLM,
      });

      const { getByTestId } = renderScreen();
      const cta = getByTestId("earn-amount-cta");

      expect(cta).toHaveTextContent("earnAmount.review");
      expect(cta.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  describe("failed-simulation message", () => {
    it("replaces a balance rejection on an XLM deposit with the fee-specific message", () => {
      mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
      setSpendable({ deposit: "100", xlm: "100" });
      mockSimulateError =
        "host invocation failed: HostError: Error(Contract, #10)";

      renderScreen();

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "earnAmount.errors.insufficientBalanceForFee",
        }),
      );
    });

    // The pool's own error is for Sentry, not for the user.
    it("says the pool can't take the deposit right now for any other rejection", () => {
      mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
      setSpendable({ deposit: "100", xlm: "100" });
      mockSimulateError = "HostError: Error(Contract, #1206)";

      renderScreen();

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "earnAmount.errors.depositUnavailable",
        }),
      );
    });

    it("says the token's balance is too low on a non-XLM balance rejection", () => {
      // USDC is this suite's default deposit asset -- a fee-specific reword
      // would be wrong here since the fee comes from a separate XLM balance.
      mockSimulateError = "Error(Contract, #10)";

      renderScreen();

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "earnAmount.errors.insufficientTokenBalance",
        }),
      );
    });

    it("reports the failure with the pool's own reason", () => {
      mockSimulateError = "HostError: Error(Contract, #1206)";

      renderScreen();

      expect(mockTrack).toHaveBeenCalledWith("earn.simulation_failed", {
        protocol: "blend",
        asset_code: "USDC",
        reason_code: "HostError: Error(Contract, #1206)",
      });
    });
  });

  describe("funnel events", () => {
    it("reports Max, but not 25% or 50%", () => {
      setTokenAmount("0");
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("percentage-25"));
      fireEvent.press(getByTestId("percentage-50"));
      expect(mockTrack).not.toHaveBeenCalledWith(
        "earn.max_amount_selected",
        expect.anything(),
      );

      fireEvent.press(getByTestId("percentage-100"));
      expect(mockTrack).toHaveBeenCalledWith("earn.max_amount_selected", {
        protocol: "blend",
        asset_code: "USDC",
        percent: 100,
      });
    });

    it("reports opening the pool details", () => {
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("earn-amount-pool-card-row"));

      expect(mockTrack).toHaveBeenCalledWith("earn.pool_details_opened", {
        protocol: "blend",
        pool_id: POOL_ID,
      });
    });

    it("reports closing the processing screen before the deposit settles", () => {
      mockEarnTransactionStatus = "submitting";
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("earn-processing-close"));

      expect(mockTrack).toHaveBeenCalledWith(
        "earn.deposit_processing_dismissed",
        {
          protocol: "blend",
          asset_code: "USDC",
          pool_id: POOL_ID,
        },
      );
      expect(mockAbandonEarnTransaction).toHaveBeenCalled();
    });
  });

  // The Receive sheet sits over the "You need XLM to pay fees" sheet. Its X
  // closes both, the fee sheet first: gorhom restores the sheet underneath
  // as soon as the top one starts closing, and ignores a dismiss that
  // arrives in between.
  describe("the Receive sheet over the XLM fee sheet", () => {
    it("closes both with X, the sheet underneath first", () => {
      renderScreen();
      // eslint-disable-next-line no-underscore-dangle
      const refs = globalThis.__earnAmountMockSheetRefs;
      const [feeSheet] = refs;
      const receiveSheet = refs[refs.length - 1];
      // eslint-disable-next-line no-underscore-dangle
      const receive = [...globalThis.__earnAmountMockSheetContents]
        .reverse()
        .find((content) => content.type === ReceiveFundsBottomSheet) as
        | React.ReactElement<{ onClose: () => void }>
        | undefined;

      act(() => {
        receive?.props.onClose();
      });

      expect(feeSheet.dismiss).toHaveBeenCalledTimes(1);
      expect(receiveSheet.dismiss).toHaveBeenCalledTimes(1);
      expect(feeSheet.dismiss.mock.invocationCallOrder[0]).toBeLessThan(
        receiveSheet.dismiss.mock.invocationCallOrder[0],
      );
    });
  });

  // When Blockaid can't scan the deposit (every testnet deposit), the sheet
  // has to say so, as Send's does, instead of listing nothing.
  describe("the security sheet", () => {
    it("says the deposit couldn't be scanned, as Send's does", () => {
      mockTransactionAssessment = {
        isMalicious: false,
        isSuspicious: false,
        isUnableToScan: true,
      };

      renderScreen();

      // eslint-disable-next-line no-underscore-dangle
      const contents = [...globalThis.__earnAmountMockSheetContents];
      const securitySheet = contents
        .reverse()
        .find((content) => "onProceedAnyway" in (content.props as object)) as
        | React.ReactElement<{ warnings: unknown[] }>
        | undefined;
      expect(securitySheet?.props.warnings).toEqual([
        {
          id: "unable-to-scan",
          description: "Unable to scan transaction",
          severity: "warning",
        },
      ]);
    });
  });

  // As on Send and Swap: leaving Review without confirming is reported as a
  // rejection, whichever way the sheet closed; a confirmed deposit isn't.
  describe("leaving Review", () => {
    const { analytics: mockAnalytics } = jest.requireMock("services/analytics");
    const reviewSheetDismiss = () => {
      // eslint-disable-next-line no-underscore-dangle
      const allProps = [...globalThis.__earnAmountMockSheetProps];
      const reviewProps = allProps
        .reverse()
        .find(
          (props) => props.analyticsEvent === AnalyticsEvent.VIEW_EARN_REVIEW,
        ) as { bottomSheetModalProps?: { onDismiss?: () => void } };
      return reviewProps.bottomSheetModalProps?.onDismiss;
    };

    it("reports a rejection when Review closes without a confirm", () => {
      renderScreen();

      act(() => {
        reviewSheetDismiss()?.();
      });

      expect(
        mockAnalytics.trackInternalSignedTransactionRejected,
      ).toHaveBeenCalledTimes(1);
    });

    it("doesn't report a confirmed deposit as a rejection", () => {
      useTransactionBuilderStore.setState({
        transactionXDR: "prepared-xdr",
        isBuilding: false,
      });
      renderScreen();
      // eslint-disable-next-line no-underscore-dangle
      const review = [...globalThis.__earnAmountMockSheetContents]
        .reverse()
        // Review is the only sheet with `isRebuilding`; the settings sheet
        // has an `onConfirm` too.
        .find((content) => "isRebuilding" in (content.props as object)) as
        | React.ReactElement<{ onConfirm: () => void }>
        | undefined;

      act(() => {
        review?.props.onConfirm();
        reviewSheetDismiss()?.();
      });

      expect(mockSubmitEarnTransaction).toHaveBeenCalled();
      expect(
        mockAnalytics.trackInternalSignedTransactionRejected,
      ).not.toHaveBeenCalled();
    });
  });

  describe("error toasts", () => {
    const rerenderScreen = (rerender: (element: React.ReactElement) => void) =>
      rerender(
        <EarnAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

    it("dismisses them once the amount changes", () => {
      setTokenAmount("10");
      mockSimulateError = "pool is frozen";
      const { rerender } = renderScreen();
      expect(mockDismissToast).not.toHaveBeenCalled();

      setTokenAmount("11");
      rerenderScreen(rerender);

      expect(mockDismissToast).toHaveBeenCalledWith("earn-simulate-failed");
      expect(mockDismissToast).toHaveBeenCalledWith("earn-fee-shortfall");
    });

    it("dismisses them when the screen goes away", () => {
      mockSimulateError = "pool is frozen";
      const { unmount } = renderScreen();

      unmount();

      expect(mockDismissToast).toHaveBeenCalledWith("earn-simulate-failed");
      expect(mockDismissToast).toHaveBeenCalledWith("earn-fee-shortfall");
    });

    it("shows the same failure again when a retry fails the same way", () => {
      mockSimulateError = "pool is frozen";
      const { rerender } = renderScreen();

      // The retry clears the error while it runs, then fails again.
      mockSimulateError = null;
      rerenderScreen(rerender);
      mockSimulateError = "pool is frozen";
      rerenderScreen(rerender);

      expect(
        mockShowToast.mock.calls.filter(
          ([options]) => options.toastId === "earn-simulate-failed",
        ),
      ).toHaveLength(2);
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
    it("renders the processing screen inline while status is submitting", () => {
      mockEarnTransactionStatus = "submitting";

      const { getByTestId, queryByTestId } = renderScreen();

      expect(getByTestId("earn-processing-mock")).toBeTruthy();
      expect(queryByTestId("earn-amount-screen")).toBeNull();
    });

    it("renders the processing screen inline while status is success", () => {
      mockEarnTransactionStatus = "success";

      const { getByTestId, queryByTestId } = renderScreen();

      expect(getByTestId("earn-processing-mock")).toBeTruthy();
      expect(queryByTestId("earn-amount-screen")).toBeNull();
    });

    it("swallows Android's back button while the deposit is submitting", () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      mockEarnTransactionStatus = "submitting";

      renderScreen();

      const backPress = addListener.mock.calls.find(
        ([eventName]) => eventName === "hardwareBackPress",
      );
      // Handled, so the route isn't popped out from under the submit.
      expect(backPress?.[1]()).toBe(true);
      addListener.mockRestore();
    });

    it("turns off iOS's swipe back while the deposit is submitting", () => {
      mockSetOptions = jest.fn();
      mockEarnTransactionStatus = "submitting";

      renderScreen();

      expect(mockSetOptions).toHaveBeenLastCalledWith({
        gestureEnabled: false,
      });
    });

    it("keeps iOS's swipe back while nothing is submitting", () => {
      mockSetOptions = jest.fn();

      renderScreen();

      expect(mockSetOptions).toHaveBeenLastCalledWith({
        gestureEnabled: true,
      });
    });

    it("leaves Android's back button alone while nothing is submitting", () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");

      renderScreen();

      expect(
        addListener.mock.calls.some(
          ([eventName]) => eventName === "hardwareBackPress",
        ),
      ).toBe(false);
      addListener.mockRestore();
    });

    it("renders the normal amount screen while status is idle", () => {
      const { getByTestId, queryByTestId } = renderScreen();

      expect(getByTestId("earn-amount-screen")).toBeTruthy();
      expect(queryByTestId("earn-processing-mock")).toBeNull();
    });

    // There is no failure screen: a failed deposit returns to the amount
    // screen with an error toast, the app's pattern for errors.
    it("returns to the amount screen with an error toast when the deposit fails", () => {
      mockEarnTransactionStatus = "error";

      const { getByTestId, queryByTestId } = renderScreen();

      expect(getByTestId("earn-amount-screen")).toBeTruthy();
      expect(queryByTestId("earn-processing-mock")).toBeNull();
      expect(mockResetEarnTransactionStatus).toHaveBeenCalledTimes(1);
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          title: "earnAmount.errors.depositFailed",
          toastId: "earn-deposit-failed",
        }),
      );
    });
  });

  describe("the failed-deposit toast", () => {
    it("goes when the amount changes", () => {
      const { rerender } = renderScreen();

      setTokenAmount("5");
      rerender(
        <EarnAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

      expect(mockDismissToast).toHaveBeenCalledWith("earn-deposit-failed");
    });
  });

  describe("deposit precision", () => {
    it("scales the deposit by the balance record's precision, not the catalog's", async () => {
      // A catalog entry that disagrees with the asset's real precision: a
      // classic asset's SAC always uses 7.
      useEarnStore.getState().selectAsset({
        assetId: USDC_ASSET_ID,
        apy: 0.1694,
        code: "USDC",
        decimals: 9,
      });

      const { getByTestId } = renderScreen();
      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();

      expect(mockSimulate).toHaveBeenCalledWith(
        expect.objectContaining({ decimals: 7 }),
      );
    });

    it("never builds the deposit without a balance record to take the precision from", async () => {
      mockGetBalanceByContractId.mockReturnValue(undefined);

      const { queryByTestId } = renderScreen();
      const cta = queryByTestId("earn-amount-cta");
      if (cta) {
        await fireEvent.press(cta);
        await Promise.resolve();
      }

      expect(mockSimulate).not.toHaveBeenCalled();
    });
  });

  // A SEP-41 balance carries `decimals` and keeps its amounts in the token's
  // smallest unit, so its spendable amount is converted before it meets the
  // typed amount, as on Send. 10000000 with 6 decimals is 10 tokens.
  describe("a SEP-41 deposit balance", () => {
    const SEP41_BALANCE = {
      id: `USDC:${USDC_ASSET_ID}`,
      contractId: USDC_ASSET_ID,
      decimals: 6,
      token: { code: "USDC", issuer: { key: USDC_ASSET_ID } },
      total: new BigNumber("10000000"),
      available: new BigNumber("10000000"),
      currentPrice: new BigNumber("1"),
    } as never;

    beforeEach(() => {
      mockGetBalanceByContractId.mockReturnValue(SEP41_BALANCE);
      setSpendable({ deposit: "10000000", xlm: "10" });
    });

    it("counts an amount above the balance as too high", () => {
      setTokenAmount("50");

      const { getByTestId } = renderScreen();

      expect(getByTestId("earn-amount-cta")).toHaveTextContent(
        "swapScreen.cta.insufficientBalance",
      );
    });

    it("lets an amount within the balance through", () => {
      setTokenAmount("5");

      const { getByTestId } = renderScreen();

      expect(getByTestId("earn-amount-cta")).toHaveTextContent(
        "earnAmount.review",
      );
    });

    it("offers the whole balance on Max, in whole tokens", () => {
      const mockSetTokenAmount = jest.fn();
      setTokenAmount("0", { setTokenAmount: mockSetTokenAmount });

      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId("percentage-100"));

      expect(mockSetTokenAmount).toHaveBeenCalledWith("10");
    });

    it("shows the available balance in whole tokens", () => {
      setTokenAmount("5");

      const { getByText } = renderScreen();

      expect(
        getByText(`${formatTokenForDisplay("10", "USDC")} common.available`),
      ).toBeTruthy();
    });
  });

  describe("Review matches the build", () => {
    // Sheets record their content on every render; the last one is current.
    const latestSheetContent = (propName: string) =>
      // eslint-disable-next-line no-underscore-dangle
      [...globalThis.__earnAmountMockSheetContents]
        .reverse()
        .find((content) => propName in (content.props as object)) as
        | React.ReactElement<Record<string, unknown>>
        | undefined;

    const rerenderScreen = (rerender: (ui: React.ReactElement) => void) =>
      rerender(
        <EarnAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
      );

    it("shows Review the amount the deposit was built with, even after the field changes", async () => {
      const { getByTestId, rerender } = renderScreen();

      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      setTokenAmount("5");
      rerenderScreen(rerender);

      expect(latestSheetContent("onSettingsPress")?.props.tokenAmount).toBe(
        "10",
      );
    });

    it("keeps Review closed when the amount changed while the deposit was being built", async () => {
      let resolveSimulate: (value: unknown) => void = () => {};
      mockSimulate.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSimulate = resolve;
          }),
      );
      const { getByTestId, rerender } = renderScreen();

      fireEvent.press(getByTestId("earn-amount-cta"));
      setTokenAmount("5");
      rerenderScreen(rerender);
      await act(async () => {
        resolveSimulate({ preparedXdr: "prepared-xdr", scanResult: undefined });
        await Promise.resolve();
      });

      // eslint-disable-next-line no-underscore-dangle
      const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(reviewSheet.present).not.toHaveBeenCalled();
    });

    it("rebuilds a settings change with the reviewed amount, from a sheet without a memo", async () => {
      const { getByTestId, rerender } = renderScreen();
      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      setTokenAmount("5");
      rerenderScreen(rerender);
      const settingsSheet = latestSheetContent("onSettingsChange");
      expect(settingsSheet?.props.showMemo).toBe(false);
      // A deposit is a Soroban invoke: the fee field is its inclusion fee.
      expect(settingsSheet?.props.isSoroban).toBe(true);
      (settingsSheet?.props.onSettingsChange as () => void)();

      expect(mockSimulate).toHaveBeenCalledTimes(2);
      expect(mockSimulate).toHaveBeenLastCalledWith(
        expect.objectContaining({ amount: "10" }),
      );
    });

    // The deposit's USD volume is the amount it was built with, priced from
    // the balance Review showed.
    it("confirms with the reviewed amount and the deposited balance", async () => {
      const { getByTestId, rerender } = renderScreen();
      await fireEvent.press(getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();

      setTokenAmount("5");
      rerenderScreen(rerender);
      act(() => {
        useTransactionBuilderStore.setState({
          transactionXDR: "prepared-xdr",
          isBuilding: false,
        });
      });
      act(() => {
        (
          latestSheetContent("onSettingsPress")?.props.onConfirm as () => void
        )();
      });

      expect(mockSubmitEarnTransaction).toHaveBeenCalledWith({
        amount: "10",
        balance: USDC_BALANCE,
      });
    });

    it("only confirms a finished build", () => {
      renderScreen();
      const confirm = () =>
        (
          latestSheetContent("onSettingsPress")?.props.onConfirm as () => void
        )();

      // Nothing staged yet, e.g. after a failed rebuild.
      confirm();
      expect(mockSubmitEarnTransaction).not.toHaveBeenCalled();

      act(() => {
        useTransactionBuilderStore.setState({
          transactionXDR: "prepared-xdr",
          isBuilding: true,
        });
      });
      expect(latestSheetContent("onSettingsPress")?.props.isRebuilding).toBe(
        true,
      );
      confirm();
      expect(mockSubmitEarnTransaction).not.toHaveBeenCalled();

      act(() => {
        useTransactionBuilderStore.setState({ isBuilding: false });
      });
      confirm();
      expect(mockSubmitEarnTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // A higher fee leaves less XLM, so the deposit Review shows may no longer
  // cover its own fees once the user saves one.
  describe("a fee change in Review", () => {
    const { analytics: mockAnalytics } = jest.requireMock("services/analytics");
    const latestSheetContent = (propName: string) =>
      // eslint-disable-next-line no-underscore-dangle
      [...globalThis.__earnAmountMockSheetContents]
        .reverse()
        .find((content) => propName in (content.props as object)) as
        | React.ReactElement<Record<string, unknown>>
        | undefined;
    const reviewSheetDismiss = () => {
      // eslint-disable-next-line no-underscore-dangle
      const reviewProps = [...globalThis.__earnAmountMockSheetProps]
        .reverse()
        .find(
          (props) => props.analyticsEvent === AnalyticsEvent.VIEW_EARN_REVIEW,
        ) as { bottomSheetModalProps?: { onDismiss?: () => void } };
      return reviewProps.bottomSheetModalProps?.onDismiss;
    };

    // The spendable XLM drops by the inclusion fee, as in
    // `calculateSpendableAmount`.
    const setXlmBeforeFee = (xlm: string) => {
      mockCalculateSpendableAmount.mockImplementation(
        ({
          balance,
          transactionFee,
        }: {
          balance: unknown;
          transactionFee: string;
        }) =>
          balance === XLM_BALANCE
            ? new BigNumber(xlm).minus(transactionFee)
            : new BigNumber("1000"),
      );
    };

    const openReviewAndSaveFee = async (fee: string) => {
      const utils = renderScreen();
      await fireEvent.press(utils.getByTestId("earn-amount-cta"));
      await Promise.resolve();
      await Promise.resolve();
      // eslint-disable-next-line no-underscore-dangle
      const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(reviewSheet.present).toHaveBeenCalledTimes(1);

      act(() => {
        useTransactionSettingsStore.setState({ transactionFee: fee });
      });
      await act(async () => {
        (
          latestSheetContent("onSettingsChange")?.props
            .onSettingsChange as () => void
        )();
        await Promise.resolve();
      });
      return utils;
    };

    beforeEach(() => {
      mockSimulate.mockImplementation(() => {
        useTransactionBuilderStore.setState({
          sorobanResourceFeeXlm: "0.05",
        });
        return Promise.resolve({
          preparedXdr: "prepared-xdr",
          scanResult: undefined,
        });
      });
    });

    describe("on an XLM deposit", () => {
      beforeEach(() => {
        mockGetBalanceByContractId.mockReturnValue(XLM_BALANCE);
        // 0.1 XLM left over at the default fee, enough for the 0.05 fee.
        setXlmBeforeFee("100");
        setTokenAmount("99.9");
      });

      it("closes Review when the new fee leaves the deposit short", async () => {
        await openReviewAndSaveFee("0.1");

        // eslint-disable-next-line no-underscore-dangle
        const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
        expect(reviewSheet.dismiss).toHaveBeenCalled();
      });

      it("asks for a smaller deposit once Review has closed", async () => {
        await openReviewAndSaveFee("0.1");
        expect(mockShowToast).not.toHaveBeenCalledWith(
          expect.objectContaining({ toastId: "earn-fee-shortfall" }),
        );

        act(() => {
          reviewSheetDismiss()?.();
        });

        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "error",
            toastId: "earn-fee-shortfall",
          }),
        );
      });

      it("doesn't report Review closing for the fee as a rejection", async () => {
        await openReviewAndSaveFee("0.1");

        act(() => {
          reviewSheetDismiss()?.();
        });

        expect(
          mockAnalytics.trackInternalSignedTransactionRejected,
        ).not.toHaveBeenCalled();
      });

      it("doesn't confirm the deposit while Review closes", async () => {
        await openReviewAndSaveFee("0.1");
        act(() => {
          useTransactionBuilderStore.setState({
            transactionXDR: "prepared-xdr",
            isBuilding: false,
          });
        });

        act(() => {
          (
            latestSheetContent("onSettingsPress")?.props.onConfirm as () => void
          )();
        });

        expect(mockSubmitEarnTransaction).not.toHaveBeenCalled();
      });

      it("keeps Review open when the new fee still fits", async () => {
        await openReviewAndSaveFee("0.01");

        // eslint-disable-next-line no-underscore-dangle
        const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
        expect(reviewSheet.dismiss).not.toHaveBeenCalled();
      });
    });

    it("opens the XLM fee sheet once Review has closed on a non-XLM deposit", async () => {
      // 0.06 XLM covers the 0.05 fee at the default fee, not at 0.02.
      setXlmBeforeFee("0.06");
      await openReviewAndSaveFee("0.02");

      // eslint-disable-next-line no-underscore-dangle
      const [feeSheet, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(reviewSheet.dismiss).toHaveBeenCalled();

      await act(async () => {
        reviewSheetDismiss()?.();
        await Promise.resolve();
      });

      expect(feeSheet.present).toHaveBeenCalledTimes(1);
      expect(mockShowToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ toastId: "earn-fee-shortfall" }),
      );
    });
  });

  describe("security sheet over Review", () => {
    const pressSecuritySheetContinue = () => {
      // eslint-disable-next-line no-underscore-dangle
      const securitySheet = globalThis.__earnAmountMockSheetContents.find(
        (content) => "onProceedAnyway" in (content.props as object),
      );
      (
        securitySheet?.props as { onProceedAnyway: () => void }
      ).onProceedAnyway();
    };

    it("only closes itself on unable-to-scan, so Review's Confirm stays the way to sign", () => {
      mockTransactionAssessment = {
        isMalicious: false,
        isSuspicious: false,
        isUnableToScan: true,
      };
      renderScreen();

      pressSecuritySheetContinue();

      expect(mockSubmitEarnTransaction).not.toHaveBeenCalled();
      // eslint-disable-next-line no-underscore-dangle
      const [, reviewSheet] = globalThis.__earnAmountMockSheetRefs;
      expect(reviewSheet.dismiss).not.toHaveBeenCalled();
    });

    it("confirms on a Suspicious verdict, like Review's own 'Confirm anyway'", () => {
      mockTransactionAssessment = {
        isMalicious: false,
        isSuspicious: true,
        isUnableToScan: false,
      };
      useTransactionBuilderStore.setState({ transactionXDR: "prepared-xdr" });
      renderScreen();

      pressSecuritySheetContinue();

      expect(mockSubmitEarnTransaction).toHaveBeenCalledTimes(1);
      // Review goes first: closing this sheet first brings Review back, and
      // gorhom ignores Review's own dismiss while that happens, which left
      // Review open under the processing step.
      const [, reviewSheet, , securitySheet] =
        // eslint-disable-next-line no-underscore-dangle
        globalThis.__earnAmountMockSheetRefs;
      expect(reviewSheet.dismiss).toHaveBeenCalledTimes(1);
      expect(reviewSheet.dismiss.mock.invocationCallOrder[0]).toBeLessThan(
        securitySheet.dismiss.mock.invocationCallOrder[0],
      );
    });
  });
});

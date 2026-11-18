/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, fireEvent } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import { SecurityDetailBottomSheet } from "components/blockaid/SecurityDetailBottomSheet";
import { EarnSwapBottomSheet } from "components/screens/EarnScreen/components/EarnSwapBottomSheet";
import { EarnSwapFromBottomSheet } from "components/screens/EarnScreen/components/EarnSwapFromBottomSheet";
import { NotEnoughTokenBottomSheet } from "components/screens/EarnScreen/components/NotEnoughTokenBottomSheet";
import { ReceiveFundsBottomSheet } from "components/screens/EarnScreen/components/ReceiveFundsBottomSheet";
import EarnTokenPickerScreen from "components/screens/EarnScreen/screens/EarnTokenPickerScreen";
import { EARN_ROUTES, EarnStackParamList } from "config/routes";
import { usePreferencesStore } from "ducks/preferences";
import { useSwapStore } from "ducks/swap";
import { useTokenIconsStore } from "ducks/tokenIcons";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// This screen renders the first-run Earn intro as a full-screen early
// return, gated on `usePreferencesStore.hasSeenEarnIntro` -- `EARN_ROUTES`
// has no intro entry, so the intro replaces the picker's own body rather
// than being a route or (as previously) a bottom sheet over it. Mocking
// approach for the REMAINING sheets is modeled on
// EarnAmountScreen.test.tsx: a stubbed <BottomSheet> that records each
// sheet's imperative ref (by declaration order) and the props it was given,
// so we can assert which sheet was presented -- and inspect the
// intro sheet's own `onDismiss` wiring -- without mounting the real
// gorhom-based sheets.

type SheetRefSpy = {
  present: jest.Mock;
  dismiss: jest.Mock;
};
type CapturedSheet = {
  ref: SheetRefSpy;
  props: Record<string, unknown>;
};
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace, vars-on-top, no-var, no-underscore-dangle, @typescript-eslint/naming-convention
  var __earnTokenPickerMockSheets: CapturedSheet[];
}
// eslint-disable-next-line no-underscore-dangle
globalThis.__earnTokenPickerMockSheets = [];

jest.mock("components/BottomSheet", () => {
  /* eslint-disable global-require, @typescript-eslint/no-var-requires, @typescript-eslint/no-shadow */
  const ReactModule = require("react");
  const RNModule = require("react-native");
  /* eslint-enable global-require, @typescript-eslint/no-var-requires, @typescript-eslint/no-shadow */

  const NoopSheet = (props: { modalRef?: React.RefObject<unknown> }) => {
    const { modalRef } = props;
    // Keeps the latest props, so handlers read the screen's current state.
    const entryRef = ReactModule.useRef(null as CapturedSheet | null);
    if (entryRef.current) {
      entryRef.current.props = props;
    }
    ReactModule.useImperativeHandle(modalRef, () => {
      const spy: SheetRefSpy = { present: jest.fn(), dismiss: jest.fn() };
      entryRef.current = { ref: spy, props };
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__earnTokenPickerMockSheets.push(entryRef.current);
      return spy;
    }, []);
    // Don't render customContent -- the real NotEnoughTokenBottomSheet /
    // ReceiveFundsBottomSheet are covered by their own component tests.
    return ReactModule.createElement(RNModule.View);
  };
  return { __esModule: true, default: NoopSheet };
});

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    setOptions: jest.fn(),
  }),
  // The picker counts as focused for as long as it is mounted.
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    require("react").useEffect(effect, [effect]);
  },
}));

const mockFetchAccountBalances = jest.fn();
const mockDismissToast = jest.fn();
jest.mock("providers/ToastProvider", () => {
  /* eslint-disable global-require, @typescript-eslint/no-var-requires */
  const ReactModule = require("react");
  const RNModule = require("react-native");
  /* eslint-enable global-require, @typescript-eslint/no-var-requires */
  return {
    ToastProvider: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(RNModule.View, null, children),
    useToast: () => ({ showToast: jest.fn(), dismissToast: mockDismissToast }),
  };
});

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "TESTNET" }),
}));

jest.mock("ducks/balances", () => ({
  useBalancesStore: () => ({
    pricedBalances: {},
    fetchAccountBalances: mockFetchAccountBalances,
  }),
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({
    account: {
      publicKey: "GTESTPUBLICKEY",
      subentryCount: 0,
    },
  }),
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

const mockOpenInAppBrowser = jest.fn(() => Promise.resolve());
jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({ open: mockOpenInAppBrowser }),
}));

let mockUseEarnTokens: {
  isLoading: boolean;
  error: string | null;
  held: unknown[];
  supported: unknown[];
  pool: unknown;
  refetch: jest.Mock;
};

// The real Earn swap hook, wrapped to capture what the picker passes it.
let mockEarnSwapParams: { onQuoteExpired?: () => void } = {};
jest.mock("components/screens/EarnScreen/hooks/useEarnSwap", () => {
  const actual = jest.requireActual(
    "components/screens/EarnScreen/hooks/useEarnSwap",
  );
  return {
    ...actual,
    useEarnSwap: (params: { onQuoteExpired?: () => void }) => {
      mockEarnSwapParams = params;
      return actual.useEarnSwap(params);
    },
  };
});

jest.mock("components/screens/EarnScreen/hooks/useEarnTokens", () => ({
  useEarnTokens: () => mockUseEarnTokens,
}));

type Props = NativeStackScreenProps<
  EarnStackParamList,
  typeof EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN
>;

// Shared across a render so the intro's close wiring (`navigation.goBack`)
// is assertable; re-created per test in `beforeEach`.
let mockNavigation: { navigate: jest.Mock; goBack: jest.Mock };

const makeNavigation = () => mockNavigation as unknown as Props["navigation"];

const makeRoute = () =>
  ({
    key: "earn-token-picker",
    name: EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN,
    params: undefined,
  }) as unknown as Props["route"];

const renderScreen = () =>
  renderWithProviders(
    <EarnTokenPickerScreen navigation={makeNavigation()} route={makeRoute()} />,
  );

const makeOption = (code: string, total = "0") => ({
  assetId: `C${code}FAKESACADDRESS`,
  code,
  decimals: 7,
  total,
  apy: 0.1694,
  poolId: "CPOOLFAKE",
  isNative: false,
  balance: undefined,
});

describe("EarnTokenPickerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line no-underscore-dangle
    globalThis.__earnTokenPickerMockSheets = [];
    mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };
    mockUseEarnTokens = {
      isLoading: false,
      error: null,
      held: [],
      supported: [],
      pool: null,
      refetch: jest.fn(),
    };
  });

  describe("first-entry presentation", () => {
    it("renders the intro instead of the picker when the flag is unset", () => {
      usePreferencesStore.getState().setHasSeenEarnIntro(false);

      const { getByTestId } = renderScreen();

      expect(getByTestId("earn-intro-screen")).toBeTruthy();
    });

    it("renders the picker, not the intro, when the flag is already set", () => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);

      const { queryByTestId } = renderScreen();

      expect(queryByTestId("earn-intro-screen")).toBeNull();
    });

    // The intro is deliberately gated AHEAD of the loading/error branches:
    // it doesn't depend on the token list, and gating it on the fetch would
    // flash a spinner before the first thing a new user ever sees. Both
    // cases previously suppressed the intro entirely.
    it("shows the intro even while the token list is still loading", () => {
      usePreferencesStore.getState().setHasSeenEarnIntro(false);
      mockUseEarnTokens.isLoading = true;

      const { getByTestId, queryByTestId } = renderScreen();

      expect(getByTestId("earn-intro-screen")).toBeTruthy();
      expect(queryByTestId("earn-token-picker-spinner")).toBeNull();
    });

    it("shows the intro even when the token fetch errored", () => {
      usePreferencesStore.getState().setHasSeenEarnIntro(false);
      mockUseEarnTokens.error = "boom";

      const { getByTestId } = renderScreen();

      expect(getByTestId("earn-intro-screen")).toBeTruthy();
    });
  });

  describe("intro dismissal", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(false);
    });

    it("Continue marks the intro seen and reveals the picker", () => {
      const { getByTestId, queryByTestId } = renderScreen();

      expect(usePreferencesStore.getState().hasSeenEarnIntro).toBe(false);

      act(() => {
        fireEvent.press(getByTestId("earn-intro-continue"));
      });

      expect(usePreferencesStore.getState().hasSeenEarnIntro).toBe(true);
      // Same screen, no navigation -- the intro is an early return, so the
      // picker simply takes over on the next render.
      expect(queryByTestId("earn-intro-screen")).toBeNull();
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });

    it("close marks the intro seen and leaves the Earn flow", () => {
      const { getByTestId } = renderScreen();

      act(() => {
        fireEvent.press(getByTestId("earn-intro-close"));
      });

      // Marked seen as well as dismissed: a user who closed the pitch should
      // not be shown it again on this install.
      expect(usePreferencesStore.getState().hasSeenEarnIntro).toBe(true);
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });
  // The held section is replaced by explanatory prose when the user holds
  // none of the pool's reserves.
  describe("list structure", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    it("shows the empty-held prose instead of an 'in your wallet' section", () => {
      mockUseEarnTokens.supported = [makeOption("USDC")];

      const { getByTestId, queryByText } = renderScreen();

      expect(getByTestId("earn-token-picker-empty-held")).toBeTruthy();
      expect(queryByText("earnTokenPicker.inYourWallet")).toBeNull();
      expect(getByTestId("earn-token-option-USDC")).toBeTruthy();
    });

    it("shows the held section, and no empty-held prose, when the user holds a reserve", () => {
      mockUseEarnTokens.held = [makeOption("XLM", "100")];
      mockUseEarnTokens.supported = [makeOption("USDC")];

      const { getByText, queryByTestId } = renderScreen();

      expect(getByText("earnTokenPicker.inYourWallet")).toBeTruthy();
      expect(getByText("earnTokenPicker.otherSupportedAssets")).toBeTruthy();
      expect(queryByTestId("earn-token-picker-empty-held")).toBeNull();
    });

    it("ends with the APY disclaimer, without the ambient glow", () => {
      mockUseEarnTokens.supported = [makeOption("USDC")];

      const { getByText, getByTestId, queryByTestId } = renderScreen();

      expect(getByTestId("earn-token-picker-apy-disclaimer")).toBeTruthy();
      expect(getByText("earnTokenPicker.apyDisclaimer")).toBeTruthy();
      expect(queryByTestId("earn-glow")).toBeNull();
    });

    it("names the pool in the 'Deposit into' chip, which opens Blend's app", () => {
      mockUseEarnTokens.supported = [makeOption("USDC")];
      mockUseEarnTokens.pool = { name: "Testnet v2.1", reserves: [] };

      const { getByText, getByTestId } = renderScreen();

      expect(getByText("earnTokenPicker.depositInto")).toBeTruthy();
      // The pool reads "<name> Pool" (getPoolDisplayName's own tests cover
      // the wording); `t` here echoes keys.
      expect(
        getByText("earnTokenPicker.protocolName · earnPoolDetails.poolName"),
      ).toBeTruthy();

      fireEvent.press(getByTestId("earn-token-picker-pool-chip"));
      // This suite runs on testnet.
      expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
        "https://testnet.blend.capital/",
      );
    });
  });

  describe("keeping state fresh", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
      act(() => {
        useSwapStore.getState().resetSwap();
      });
    });

    it("refreshes the balances when the picker is in front", () => {
      renderScreen();

      expect(mockFetchAccountBalances).toHaveBeenCalledWith({
        publicKey: "GTESTPUBLICKEY",
        network: "TESTNET",
      });
    });

    it("clears the swap when the swap sheets close", () => {
      renderScreen();
      act(() => {
        useSwapStore.getState().setSourceToken("XLM", "XLM");
        useSwapStore.getState().setSourceAmount("12");
        useTransactionBuilderStore.setState({
          transactionXDR: "unsubmitted-swap-xdr",
        });
      });

      // eslint-disable-next-line no-underscore-dangle
      const swapFromSheet = globalThis.__earnTokenPickerMockSheets.find(
        (sheet) =>
          (sheet.props.customContent as React.ReactElement | undefined)
            ?.type === EarnSwapFromBottomSheet,
      );
      const { onClose } = (
        swapFromSheet?.props.customContent as React.ReactElement<{
          onClose: () => void;
        }>
      ).props;
      act(() => {
        onClose();
      });

      expect(useSwapStore.getState().sourceTokenId).toBe("");
      expect(useSwapStore.getState().sourceAmount).toBe("0");
      // A swap built for Review but never confirmed can't be signed later.
      expect(useTransactionBuilderStore.getState().transactionXDR).toBeNull();
      // A setup failure's toast goes with the swap it was about.
      expect(mockDismissToast).toHaveBeenCalledWith(
        "failed-to-setup-transaction",
      );
    });
  });

  describe("funnel events", () => {
    // `track` is mocked in jest.setup.js.
    const { track: mockTrack } = jest.requireMock("services/analytics/core");

    const notEnoughSheetProps = () => {
      // eslint-disable-next-line no-underscore-dangle
      const sheets = globalThis.__earnTokenPickerMockSheets;
      const sheet = sheets.find(
        ({ props }) =>
          (props.customContent as React.ReactElement | undefined)?.type ===
          NotEnoughTokenBottomSheet,
      );
      return (
        sheet?.props.customContent as React.ReactElement<{
          onBuy: () => void;
          onSwap: () => void;
          onReceive: () => void;
        }>
      ).props;
    };

    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    it("reports picking a held token", () => {
      mockUseEarnTokens.held = [makeOption("XLM", "100")];
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("earn-token-option-XLM"));

      expect(mockTrack).toHaveBeenCalledWith("earn.token_selected", {
        asset_code: "XLM",
        pool_id: "CPOOLFAKE",
        apy: 0.1694,
      });
    });

    it("reports the Not enough sheet with the buttons it shows", () => {
      mockUseEarnTokens.supported = [makeOption("EURC")];
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("earn-token-option-EURC"));

      // Testnet and nothing to swap from: Receive is the only way.
      expect(mockTrack).toHaveBeenCalledWith(
        "earn.balance_insufficient_shown",
        { asset_code: "EURC", variant: "transfer-only" },
      );
    });

    it("reports the button picked on the Not enough sheet", () => {
      mockUseEarnTokens.supported = [makeOption("EURC")];
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId("earn-token-option-EURC"));

      act(() => {
        notEnoughSheetProps().onReceive();
      });
      expect(mockTrack).toHaveBeenCalledWith("earn.funding_action_selected", {
        asset_code: "EURC",
        action: "transfer",
      });

      act(() => {
        notEnoughSheetProps().onBuy();
      });
      expect(mockTrack).toHaveBeenCalledWith("earn.funding_action_selected", {
        asset_code: "EURC",
        action: "buy",
      });

      act(() => {
        notEnoughSheetProps().onSwap();
      });
      expect(mockTrack).toHaveBeenCalledWith("earn.funding_action_selected", {
        asset_code: "EURC",
        action: "swap",
      });
    });
  });

  describe("an expired swap quote", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    it("goes back to the swap sheet for a retry instead of ending on the processing sheet", () => {
      renderScreen();
      // eslint-disable-next-line no-underscore-dangle
      const sheets = globalThis.__earnTokenPickerMockSheets;
      const swapSheet = sheets.find(
        ({ props }) => props.analyticsEvent === "earn_swap_amount",
      );
      const processingSheet = sheets.find(
        ({ props }) => props.enablePanDownToClose === false,
      );

      act(() => {
        mockEarnSwapParams.onQuoteExpired?.();
      });

      expect(processingSheet?.ref.dismiss).toHaveBeenCalled();
      expect(swapSheet?.ref.present).toHaveBeenCalled();
    });
  });

  describe("icons for tokens the account doesn't hold", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    it("looks up each one by its classic code and issuer", () => {
      const fetchIconUrl = jest.fn(() => Promise.resolve({} as never));
      const original = useTokenIconsStore.getState().fetchIconUrl;
      useTokenIconsStore.setState({ fetchIconUrl });
      mockUseEarnTokens.supported = [
        {
          ...makeOption("EURC"),
          canonicalId:
            "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        },
        // No classic form: nothing to look up.
        { ...makeOption("FOO"), canonicalId: null },
      ];

      renderScreen();

      expect(fetchIconUrl).toHaveBeenCalledTimes(1);
      expect(fetchIconUrl).toHaveBeenCalledWith({
        token: {
          code: "EURC",
          issuer: {
            key: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
          },
        },
        network: "TESTNET",
      });
      useTokenIconsStore.setState({ fetchIconUrl: original });
    });
  });

  // The Receive sheet sits over the "Not enough" sheet. Its X closes both,
  // its back arrow only itself. gorhom restores the sheet underneath as soon
  // as the top one starts closing, and ignores a dismiss that arrives in
  // between, so the lower sheet has to go first.
  describe("the Receive sheet over the Not enough sheet", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    const findSheet = (type: unknown) =>
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__earnTokenPickerMockSheets.find(
        ({ props }) =>
          (props.customContent as React.ReactElement | undefined)?.type ===
          type,
      );

    it("closes both with X, the sheet underneath first", () => {
      renderScreen();
      const notEnough = findSheet(NotEnoughTokenBottomSheet);
      const receive = findSheet(ReceiveFundsBottomSheet);

      act(() => {
        (
          receive?.props.customContent as React.ReactElement<{
            onClose: () => void;
          }>
        ).props.onClose();
      });

      expect(notEnough?.ref.dismiss).toHaveBeenCalledTimes(1);
      expect(receive?.ref.dismiss).toHaveBeenCalledTimes(1);
      expect(notEnough!.ref.dismiss.mock.invocationCallOrder[0]).toBeLessThan(
        receive!.ref.dismiss.mock.invocationCallOrder[0],
      );
    });

    it("closes only itself with the back arrow", () => {
      renderScreen();
      const notEnough = findSheet(NotEnoughTokenBottomSheet);
      const receive = findSheet(ReceiveFundsBottomSheet);

      act(() => {
        (
          receive?.props.customContent as React.ReactElement<{
            onBack: () => void;
          }>
        ).props.onBack();
      });

      expect(receive?.ref.dismiss).toHaveBeenCalledTimes(1);
      expect(notEnough?.ref.dismiss).not.toHaveBeenCalled();
    });
  });

  // XLM's total includes the minimum balance the account can't spend, so the
  // row shows what the deposit screen will offer instead.
  describe("the XLM row in your wallet", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    it("shows the spendable XLM, not the total", () => {
      mockUseEarnTokens.held = [
        {
          ...makeOption("XLM", "100"),
          isNative: true,
          balance: {
            token: { type: "native", code: "XLM" },
            total: new BigNumber("100"),
            available: new BigNumber("100"),
            minimumBalance: new BigNumber("1"),
          },
        },
      ];

      const { getByText, queryByText } = renderScreen();

      // 100 total, less the 1 XLM minimum balance and the 0.00001 fee.
      expect(getByText(formatTokenForDisplay("98.99999", "XLM"))).toBeTruthy();
      expect(queryByText(formatTokenForDisplay("100", "XLM"))).toBeNull();
    });

    it("keeps other tokens at their balance", () => {
      mockUseEarnTokens.held = [makeOption("USDC", "50")];

      const { getByText } = renderScreen();

      expect(getByText(formatTokenForDisplay("50", "USDC"))).toBeTruthy();
    });
  });

  // "Swap from" sits over the swap sheet. Its X leaves the swap entirely, so
  // the swap sheet underneath has to go first: gorhom restores it as soon
  // as the top sheet starts closing and ignores a dismiss in between.
  describe("X on the Swap from sheet", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    it("closes the swap sheet underneath first", () => {
      renderScreen();
      // eslint-disable-next-line no-underscore-dangle
      const sheets = globalThis.__earnTokenPickerMockSheets;
      const swapSheet = sheets.find(
        ({ props }) => props.analyticsEvent === "earn_swap_amount",
      );
      const swapFromSheet = sheets.find(
        ({ props }) =>
          (props.customContent as React.ReactElement | undefined)?.type ===
          EarnSwapFromBottomSheet,
      );

      act(() => {
        (
          swapFromSheet?.props.customContent as React.ReactElement<{
            onClose: () => void;
          }>
        ).props.onClose();
      });

      expect(swapSheet?.ref.dismiss).toHaveBeenCalledTimes(1);
      expect(swapFromSheet?.ref.dismiss).toHaveBeenCalledTimes(1);
      expect(swapSheet!.ref.dismiss.mock.invocationCallOrder[0]).toBeLessThan(
        swapFromSheet!.ref.dismiss.mock.invocationCallOrder[0],
      );
    });
  });

  // Main Swap builds only once the quote is ready. Before that the button
  // is live but there is nothing to build, and opening the security sheet
  // or Review would offer to sign whatever transaction was staged before.
  describe("the Earn swap's Review button before the quote is ready", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    const notEnoughSheetPropsFor = () => {
      // eslint-disable-next-line no-underscore-dangle
      const sheets = globalThis.__earnTokenPickerMockSheets;
      const sheet = sheets.find(
        ({ props }) =>
          (props.customContent as React.ReactElement | undefined)?.type ===
          NotEnoughTokenBottomSheet,
      );
      return (
        sheet?.props.customContent as React.ReactElement<{
          onSwap: () => void;
        }>
      ).props;
    };

    it("builds nothing and opens nothing", async () => {
      mockUseEarnTokens.supported = [
        {
          ...makeOption("EURC"),
          canonicalId:
            "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        },
      ];
      useTransactionBuilderStore.setState({
        transactionXDR: "unsubmitted-swap-xdr",
      });
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId("earn-token-option-EURC"));
      act(() => {
        notEnoughSheetPropsFor().onSwap();
      });

      // eslint-disable-next-line no-underscore-dangle
      const sheets = globalThis.__earnTokenPickerMockSheets;
      const findByContent = (type: unknown) =>
        sheets.find(
          ({ props }) =>
            (props.customContent as React.ReactElement | undefined)?.type ===
            type,
        );
      const swapSheet = findByContent(EarnSwapBottomSheet);
      const { onReview } = (
        swapSheet?.props.customContent as React.ReactElement<{
          onReview: (() => Promise<void>) | null;
        }>
      ).props;
      await act(async () => {
        await onReview?.();
      });

      const reviewSheet = sheets.find(
        ({ props }) => props.analyticsEvent === "earn_swap_review",
      );
      expect(
        findByContent(SecurityDetailBottomSheet)?.ref.present,
      ).not.toHaveBeenCalled();
      expect(reviewSheet?.ref.present).not.toHaveBeenCalled();
    });
  });
});

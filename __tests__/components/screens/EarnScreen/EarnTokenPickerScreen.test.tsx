/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Asset, Networks } from "@stellar/stellar-sdk";
import { act, fireEvent } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import InformationBottomSheet from "components/InformationBottomSheet";
import { SecurityDetailBottomSheet } from "components/blockaid/SecurityDetailBottomSheet";
import { EarnSwapBottomSheet } from "components/screens/EarnScreen/components/EarnSwapBottomSheet";
import { EarnSwapFromBottomSheet } from "components/screens/EarnScreen/components/EarnSwapFromBottomSheet";
import { NotEnoughTokenBottomSheet } from "components/screens/EarnScreen/components/NotEnoughTokenBottomSheet";
import { ReceiveFundsBottomSheet } from "components/screens/EarnScreen/components/ReceiveFundsBottomSheet";
import EarnTokenPickerScreen from "components/screens/EarnScreen/screens/EarnTokenPickerScreen";
import { SwapDetailsBottomSheet } from "components/screens/SwapScreen/components";
import { NETWORKS } from "config/constants";
import { EARN_ROUTES, EarnStackParamList } from "config/routes";
import { usePreferencesStore } from "ducks/preferences";
import { usePricesStore } from "ducks/prices";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { descriptorAsPathBalance, swapPairKey, useSwapStore } from "ducks/swap";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTokenIconsStore } from "ducks/tokenIcons";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { formatFiatAmount, formatTokenForDisplay } from "helpers/formatAmount";
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

// The network's recommended per-operation fee, in XLM. One object, as the
// real hook keeps its state: a new one per render would re-run every effect
// that depends on it.
const mockNetworkFees = {
  recommendedFee: "0.00123",
  networkCongestion: "low",
  feePresets: { low: "0.00123", medium: "0.00123", high: "0.00123" },
};
jest.mock("hooks/useNetworkFees", () => ({
  useNetworkFees: () => mockNetworkFees,
  clearNetworkFeesCache: jest.fn(),
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
  useAuthenticationStore: (
    selector?: (state: { network: string }) => unknown,
  ) => {
    const state = { network: "TESTNET" };
    return selector ? selector(state) : state;
  },
}));

// Empty unless a test adds a balance, and emptied again after it.
const mockPricedBalances: Record<string, unknown> = {};
jest.mock("ducks/balances", () => ({
  useBalancesStore: () => ({
    pricedBalances: mockPricedBalances,
    fetchAccountBalances: mockFetchAccountBalances,
  }),
}));

// One object, for the same reason as `mockNetworkFees`.
const mockActiveAccount = {
  account: {
    publicKey: "GTESTPUBLICKEY",
    subentryCount: 0,
  },
};
jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => mockActiveAccount,
}));

// One `t`, as the real hook keeps: a new one per render would re-run every
// effect that depends on it, and one that sets state would never settle.
const mockTranslation = { t: (key: string) => key };
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => mockTranslation,
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

// The real Earn swap hook, wrapped to capture what the picker passes it and
// what it returns, and to let a test stand in for parts of its result, such
// as a ready quote.
let mockEarnSwapParams: { onQuoteExpired?: () => void } = {};
let mockEarnSwapResult: Record<string, unknown> = {};
let mockEarnSwapOverrides: Record<string, unknown> = {};
jest.mock("components/screens/EarnScreen/hooks/useEarnSwap", () => {
  const actual = jest.requireActual(
    "components/screens/EarnScreen/hooks/useEarnSwap",
  );
  return {
    ...actual,
    useEarnSwap: (params: { onQuoteExpired?: () => void }) => {
      mockEarnSwapParams = params;
      mockEarnSwapResult = {
        ...actual.useEarnSwap(params),
        ...mockEarnSwapOverrides,
      };
      return mockEarnSwapResult;
    },
  };
});

// Records each useSwapFooter call (a plain function, so mock resets keep it),
// as main Swap's test does.
const mockFooterCalls: { transactionXDR?: string | null }[] = [];
jest.mock("components/screens/SwapScreen/hooks/useSwapFooter", () => {
  const actual = jest.requireActual(
    "components/screens/SwapScreen/hooks/useSwapFooter",
  );
  return {
    ...actual,
    useSwapFooter: (args: { transactionXDR?: string | null }) => {
      mockFooterCalls.push(args);
      return actual.useSwapFooter(args);
    },
  };
});

// Blockaid's token scan, which off mainnet always fails as the real one does.
const mockScanToken = jest.fn<Promise<unknown>, unknown[]>(() =>
  Promise.reject(new Error("Network not supported")),
);
jest.mock("services/blockaid/api", () => ({
  ...jest.requireActual("services/blockaid/api"),
  scanToken: (...args: unknown[]) => mockScanToken(...args),
}));

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

// The Earn swap buys a reserve only through the classic asset whose SAC is
// the reserve's address, and these tests run on testnet, so EURC (the
// reserve the swap tests buy) carries its real testnet SAC.
const EURC_ISSUER = "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2";
const EURC_TESTNET_SAC = new Asset("EURC", EURC_ISSUER).contractId(
  Networks.TESTNET,
);

const makeOption = (code: string, total = "0") => ({
  assetId: code === "EURC" ? EURC_TESTNET_SAC : `C${code}FAKESACADDRESS`,
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

    // As in the extension, the funnel's earn_select_token follows the
    // intro: it counts the picker being seen, not the screen mounting.
    it("reports earn_select_token only once the intro is out of the way", () => {
      const { track: mockTrack } = jest.requireMock("services/analytics/core");
      const isPickerView = ([, props]: [string, { screen_name?: string }]) =>
        props?.screen_name === "earn_select_token";
      usePreferencesStore.getState().setHasSeenEarnIntro(false);

      renderScreen();
      expect(mockTrack.mock.calls.filter(isPickerView)).toHaveLength(0);

      act(() => {
        usePreferencesStore.getState().setHasSeenEarnIntro(true);
      });
      expect(mockTrack.mock.calls.filter(isPickerView)).toEqual([
        ["screen.viewed", { screen_name: "earn_select_token", flow: "earn" }],
      ]);
    });

    it("reports earn_select_token when it opens on the picker", () => {
      const { track: mockTrack } = jest.requireMock("services/analytics/core");
      usePreferencesStore.getState().setHasSeenEarnIntro(true);

      renderScreen();

      expect(mockTrack).toHaveBeenCalledWith("screen.viewed", {
        screen_name: "earn_select_token",
        flow: "earn",
      });
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

    // X, a tap outside and a swipe down all end in gorhom calling the swap
    // sheet's onDismiss once it has closed.
    it("clears the swap once the swap sheet has closed, however it closed", () => {
      renderScreen();
      act(() => {
        useSwapStore.getState().setSourceToken("XLM", "XLM");
        useSwapStore.getState().setSourceAmount("12");
        useTransactionBuilderStore.setState({
          transactionXDR: "unsubmitted-swap-xdr",
        });
      });

      // eslint-disable-next-line no-underscore-dangle
      const swapSheet = globalThis.__earnTokenPickerMockSheets.find(
        ({ props }) => props.analyticsEvent === "swap_amount",
      );
      const { onDismiss } = swapSheet?.props.bottomSheetModalProps as {
        onDismiss: () => void;
      };
      act(() => {
        onDismiss();
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
        protocol: "blend",
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
        {
          protocol: "blend",
          asset_code: "EURC",
          variant: "transfer-only",
        },
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
        protocol: "blend",
        asset_code: "EURC",
        action: "transfer",
      });

      act(() => {
        notEnoughSheetProps().onBuy();
      });
      expect(mockTrack).toHaveBeenCalledWith("earn.funding_action_selected", {
        protocol: "blend",
        asset_code: "EURC",
        action: "buy",
      });

      act(() => {
        notEnoughSheetProps().onSwap();
      });
      expect(mockTrack).toHaveBeenCalledWith("earn.funding_action_selected", {
        protocol: "blend",
        asset_code: "EURC",
        action: "swap",
      });
    });

    // Swap follows the `swap_enabled` flag, as Home's Swap button does.
    describe("with XLM to swap from", () => {
      beforeEach(() => {
        mockPricedBalances.native = {
          token: { type: "native", code: "XLM" },
          total: new BigNumber("100"),
          available: new BigNumber("100"),
          minimumBalance: new BigNumber("1"),
        };
      });

      afterEach(() => {
        delete mockPricedBalances.native;
        useRemoteConfigStore.setState({ swap_enabled: true });
      });

      it("offers Swap while swap_enabled is on", () => {
        useRemoteConfigStore.setState({ swap_enabled: true });
        mockUseEarnTokens.supported = [makeOption("EURC")];
        const { getByTestId } = renderScreen();

        fireEvent.press(getByTestId("earn-token-option-EURC"));

        expect(mockTrack).toHaveBeenCalledWith(
          "earn.balance_insufficient_shown",
          {
            protocol: "blend",
            asset_code: "EURC",
            variant: "swap-or-transfer",
          },
        );
      });

      it("hides Swap while swap_enabled is off", () => {
        useRemoteConfigStore.setState({ swap_enabled: false });
        mockUseEarnTokens.supported = [makeOption("EURC")];
        const { getByTestId } = renderScreen();

        fireEvent.press(getByTestId("earn-token-option-EURC"));

        expect(mockTrack).toHaveBeenCalledWith(
          "earn.balance_insufficient_shown",
          {
            protocol: "blend",
            asset_code: "EURC",
            variant: "transfer-only",
          },
        );
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
        ({ props }) => props.analyticsEvent === "swap_amount",
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

  describe("the swap's processing sheet", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    // Its X, Close and Done run the close handler that ends the swap: the
    // toast, the refresh and resetting the swap. A swipe or a tap outside
    // would close it without that.
    it("closes only from its own buttons", () => {
      renderScreen();
      // eslint-disable-next-line no-underscore-dangle
      const processingSheet = globalThis.__earnTokenPickerMockSheets.find(
        ({ props }) => props.enablePanDownToClose === false,
      );

      expect(processingSheet?.props.shouldCloseOnPressBackdrop).toBe(false);
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

    // XLM held only as its minimum balance is listed as not held.
    it("shows 0 for XLM listed as not held, not its minimum balance", () => {
      mockUseEarnTokens.supported = [
        {
          ...makeOption("XLM", "1.5"),
          isNative: true,
          balance: {
            token: { type: "native", code: "XLM" },
            total: new BigNumber("1.5"),
            available: new BigNumber("0"),
            minimumBalance: new BigNumber("1.5"),
          },
        },
      ];

      const { getByText, queryByText } = renderScreen();

      expect(getByText("0 XLM")).toBeTruthy();
      expect(queryByText(formatTokenForDisplay("1.5", "XLM"))).toBeNull();
    });
  });

  // As on main Swap: a swap Blockaid couldn't scan opens the security sheet
  // before Review, and a clean one opens Review.
  describe("the Earn swap's Blockaid gate", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    afterEach(() => {
      mockEarnSwapOverrides = {};
    });

    const findByContent = (type: unknown) =>
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__earnTokenPickerMockSheets.find(
        ({ props }) =>
          (props.customContent as React.ReactElement | undefined)?.type ===
          type,
      );

    // Opens the Earn swap with a quote ready and presses its Review button.
    const pressReview = async (
      scanResult: unknown,
      overrides: Record<string, unknown> = {},
    ) => {
      mockEarnSwapOverrides = {
        ctaState: { kind: "review" },
        isCtaDisabled: false,
        isTokenUnableToScan: false,
        setupSwapTransaction: jest.fn(() => Promise.resolve({ scanResult })),
        ...overrides,
      };
      mockUseEarnTokens.supported = [
        {
          ...makeOption("EURC"),
          canonicalId:
            "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        },
      ];
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId("earn-token-option-EURC"));
      act(() => {
        (
          findByContent(NotEnoughTokenBottomSheet)?.props
            .customContent as React.ReactElement<{ onSwap: () => void }>
        ).props.onSwap();
      });
      const { onReview } = (
        findByContent(EarnSwapBottomSheet)?.props
          .customContent as React.ReactElement<{
          onReview: (() => Promise<void>) | null;
        }>
      ).props;
      await act(async () => {
        await onReview?.();
      });

      return {
        security: findByContent(SecurityDetailBottomSheet),
        // eslint-disable-next-line no-underscore-dangle
        review: globalThis.__earnTokenPickerMockSheets.find(
          ({ props }) => props.analyticsEvent === "swap_confirm",
        ),
      };
    };

    // A destination the account doesn't hold has no verdict from the
    // balances, so the swap scans it, as main Swap does its default one.
    it("scans a destination the account doesn't hold", async () => {
      mockScanToken.mockImplementationOnce(() =>
        Promise.resolve({ result_type: "Malicious" }),
      );
      mockUseEarnTokens.supported = [
        {
          ...makeOption("EURC"),
          canonicalId:
            "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        },
      ];
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId("earn-token-option-EURC"));
      await act(async () => {
        (
          findByContent(NotEnoughTokenBottomSheet)?.props
            .customContent as React.ReactElement<{ onSwap: () => void }>
        ).props.onSwap();
        await Promise.resolve();
      });

      expect(mockScanToken).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenCode: "EURC",
          tokenIssuer:
            "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        }),
      );
      expect(useSwapStore.getState().destinationToken?.securityLevel).toBe(
        "MALICIOUS",
      );
    });

    it("opens the security sheet first when the swap couldn't be scanned", async () => {
      const { security, review } = await pressReview(undefined);

      expect(security?.ref.present).toHaveBeenCalledTimes(1);
      expect(review?.ref.present).not.toHaveBeenCalled();
    });

    it("opens the security sheet first when a token couldn't be scanned", async () => {
      const { security, review } = await pressReview(
        { validation: { result_type: "Benign" } },
        { isTokenUnableToScan: true },
      );

      expect(security?.ref.present).toHaveBeenCalledTimes(1);
      expect(review?.ref.present).not.toHaveBeenCalled();
    });

    it("opens Review when the scan comes back clean", async () => {
      const { security, review } = await pressReview({
        validation: { result_type: "Benign" },
      });

      expect(review?.ref.present).toHaveBeenCalledTimes(1);
      expect(security?.ref.present).not.toHaveBeenCalled();
    });

    it("goes on to Review from the unable-to-scan sheet", async () => {
      const { security, review } = await pressReview(undefined, {
        isUnableToScan: true,
      });

      act(() => {
        (
          security?.props.customContent as React.ReactElement<{
            onProceedAnyway: () => void;
          }>
        ).props.onProceedAnyway();
      });

      expect(review?.ref.present).toHaveBeenCalledTimes(1);
    });

    // As on main Swap: a rebuild, such as a Save from Review's settings,
    // stores its transaction before its scan lands, and until then the
    // verdict shown is the previous transaction's.
    it.each([
      ["keeps Confirm disabled", "old-xdr", undefined],
      ["enables Confirm", "new-xdr", "new-xdr"],
    ])(
      "%s until the scan for the stored transaction is in (scanned %s)",
      (_, scannedXdr, footerXdr) => {
        mockEarnSwapOverrides = {
          transactionXDR: "new-xdr",
          scannedTransactionXDR: scannedXdr,
        };

        renderScreen();

        expect(mockFooterCalls.at(-1)?.transactionXDR).toBe(footerXdr);
      },
    );

    it.each([
      [
        "the stored transaction's scan is pending",
        { scannedTransactionXDR: "old-xdr" },
      ],
      ["the transaction is being built", { isBuilding: true }],
    ])("doesn't sign from the sheet while %s", async (_, pending) => {
      const executeSwap = jest.fn();
      const { security } = await pressReview(
        { validation: { result_type: "Malicious" } },
        {
          isUnableToScan: false,
          isMalicious: true,
          executeSwap,
          transactionXDR: "new-xdr",
          scannedTransactionXDR: "new-xdr",
          ...pending,
        },
      );

      act(() => {
        (
          security?.props.customContent as React.ReactElement<{
            onProceedAnyway: () => void;
          }>
        ).props.onProceedAnyway();
      });

      expect(executeSwap).not.toHaveBeenCalled();
    });

    it("signs from the sheet on a malicious verdict, as Review's Confirm anyway does", async () => {
      const executeSwap = jest.fn();
      const { security } = await pressReview(
        { validation: { result_type: "Malicious" } },
        {
          isUnableToScan: false,
          isMalicious: true,
          executeSwap,
          transactionXDR: "new-xdr",
          scannedTransactionXDR: "new-xdr",
        },
      );

      act(() => {
        (
          security?.props.customContent as React.ReactElement<{
            onProceedAnyway: () => void;
          }>
        ).props.onProceedAnyway();
      });

      expect(executeSwap).toHaveBeenCalledTimes(1);
      // Review goes before the sheet over it: closing the sheet first brings
      // Review back, and gorhom ignores Review's own dismiss while that
      // happens, which left Review under the processing sheet.
      const review = // eslint-disable-next-line no-underscore-dangle
        globalThis.__earnTokenPickerMockSheets.find(
          ({ props }) => props.analyticsEvent === "swap_confirm",
        );
      expect(review?.ref.dismiss).toHaveBeenCalled();
      expect(review!.ref.dismiss.mock.invocationCallOrder[0]).toBeLessThan(
        security!.ref.dismiss.mock.invocationCallOrder[0],
      );
    });

    // Opens the Earn swap and presses Review, leaving the build pending
    // until `finishSetup` is called. `pressReviewAgain` starts another
    // build, which `finishSetup(1)` ends.
    const startReviewBuild = () => {
      const setups: ((setup: unknown) => void)[] = [];
      const reviewPresses: (Promise<void> | undefined)[] = [];
      mockEarnSwapOverrides = {
        ctaState: { kind: "review" },
        isCtaDisabled: false,
        isTokenUnableToScan: false,
        setupSwapTransaction: jest.fn(
          () =>
            new Promise((resolve) => {
              setups.push(resolve);
            }),
        ),
      };
      mockUseEarnTokens.supported = [
        {
          ...makeOption("EURC"),
          canonicalId:
            "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        },
      ];
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId("earn-token-option-EURC"));
      act(() => {
        (
          findByContent(NotEnoughTokenBottomSheet)?.props
            .customContent as React.ReactElement<{ onSwap: () => void }>
        ).props.onSwap();
      });
      const swapSheetContent = () =>
        (
          findByContent(EarnSwapBottomSheet)?.props
            .customContent as React.ReactElement<{
            onReview: (() => Promise<void>) | null;
            onClose: () => void;
            isBuildingReview?: boolean;
            isReviewLoading?: boolean;
          }>
        ).props;
      const pressReviewAgain = () => {
        act(() => {
          reviewPresses.push(swapSheetContent().onReview?.());
        });
      };
      pressReviewAgain();

      return {
        swapSheetContent,
        pressReviewAgain,
        finishSetup: async (build = 0) => {
          await act(async () => {
            setups[build]({
              scanResult: { validation: { result_type: "Benign" } },
            });
            await reviewPresses[build];
          });
        },
      };
    };

    // gorhom's calls on the swap sheet, which the stubbed sheet doesn't make.
    const swapSheetModalProps = () =>
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__earnTokenPickerMockSheets.find(
        ({ props }) => props.analyticsEvent === "swap_amount",
      )?.props.bottomSheetModalProps as {
        onAnimate: (fromIndex: number, toIndex: number) => void;
        onDismiss: () => void;
      };

    it("locks the swap sheet while Review is being built", async () => {
      const { swapSheetContent, finishSetup } = startReviewBuild();

      expect(swapSheetContent().isBuildingReview).toBe(true);
      expect(swapSheetContent().isReviewLoading).toBe(true);

      await finishSetup();

      expect(swapSheetContent().isBuildingReview).toBe(false);
    });

    it.each([
      [
        "X",
        (content: { onClose: () => void }) => {
          content.onClose();
        },
      ],
      // A tap outside or a swipe down starts the close on gorhom's side.
      [
        "a tap outside or a swipe down",
        () => {
          swapSheetModalProps().onAnimate(0, -1);
        },
      ],
      [
        "a close that has already finished",
        () => {
          swapSheetModalProps().onDismiss();
        },
      ],
    ])(
      "opens nothing once the swap is built if the user left it by %s",
      async (_exit, leave) => {
        const { swapSheetContent, finishSetup } = startReviewBuild();
        // eslint-disable-next-line no-underscore-dangle
        const review = globalThis.__earnTokenPickerMockSheets.find(
          ({ props }) => props.analyticsEvent === "swap_confirm",
        );

        act(() => {
          leave(swapSheetContent());
        });
        await finishSetup();

        expect(review?.ref.present).not.toHaveBeenCalled();
        expect(
          findByContent(SecurityDetailBottomSheet)?.ref.present,
        ).not.toHaveBeenCalled();
      },
    );

    it("unlocks a swap reopened before the build the user left has ended", async () => {
      const { swapSheetContent, pressReviewAgain, finishSetup } =
        startReviewBuild();

      act(() => {
        swapSheetModalProps().onAnimate(0, -1);
      });

      expect(swapSheetContent().isBuildingReview).toBe(false);

      // The next swap's own build, which the old one ending mustn't unlock.
      pressReviewAgain();
      await finishSetup(0);

      expect(swapSheetContent().isBuildingReview).toBe(true);

      await finishSetup(1);
    });

    it("keeps the swap when Confirm closes the swap sheet to submit it", async () => {
      const reset = jest.fn();
      const { security } = await pressReview(
        { validation: { result_type: "Malicious" } },
        {
          isUnableToScan: false,
          isMalicious: true,
          executeSwap: jest.fn(),
          transactionXDR: "new-xdr",
          scannedTransactionXDR: "new-xdr",
          reset,
        },
      );
      // gorhom calls onDismiss once the swap sheet has closed.
      const swapSheetClosed = () => {
        // eslint-disable-next-line no-underscore-dangle
        const swapSheet = globalThis.__earnTokenPickerMockSheets.find(
          ({ props }) => props.analyticsEvent === "swap_amount",
        );
        (
          swapSheet?.props.bottomSheetModalProps as { onDismiss: () => void }
        ).onDismiss();
      };

      act(() => {
        (
          security?.props.customContent as React.ReactElement<{
            onProceedAnyway: () => void;
          }>
        ).props.onProceedAnyway();
        swapSheetClosed();
      });

      expect(reset).not.toHaveBeenCalled();

      // The next close, as after an expired quote brings the swap sheet
      // back, is the user leaving the swap.
      act(() => {
        swapSheetClosed();
      });

      expect(reset).toHaveBeenCalledTimes(1);
    });
  });

  // The swap inside Earn reports Swap's own events, tagged as opened from
  // Earn, as the extension's does.
  describe("the Earn swap's analytics", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    // The swap store outlives a render; a source picked here would stop the
    // next swap from choosing its own.
    afterEach(() => {
      act(() => {
        useSwapStore.getState().resetSwap();
      });
    });

    it("reports Swap's screens, tagged as opened from Earn", () => {
      renderScreen();
      // eslint-disable-next-line no-underscore-dangle
      const sheets = globalThis.__earnTokenPickerMockSheets;
      const screens = sheets
        .filter(({ props }) =>
          ["swap_amount", "swap_from_asset", "swap_confirm"].includes(
            props.analyticsEvent as string,
          ),
        )
        .map(({ props }) => [props.analyticsEvent, props.analyticsProps]);

      expect(screens).toEqual(
        expect.arrayContaining([
          ["swap_amount", { source: "earn" }],
          ["swap_from_asset", { source: "earn" }],
          ["swap_confirm", { source: "earn" }],
        ]),
      );
      expect(screens).toHaveLength(3);
    });

    // The sell chip opens "Swap from", and picking there selects the source,
    // as Swap's own picker reports both.
    it("reports opening the source picker and picking a source", () => {
      const { analytics: mockAnalytics } =
        jest.requireMock("services/analytics");
      mockUseEarnTokens.supported = [
        {
          ...makeOption("EURC"),
          canonicalId:
            "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        },
      ];
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId("earn-token-option-EURC"));
      // eslint-disable-next-line no-underscore-dangle
      const sheets = globalThis.__earnTokenPickerMockSheets;
      const contentOf = <P,>(type: unknown) =>
        (
          sheets.find(
            ({ props }) =>
              (props.customContent as React.ReactElement | undefined)?.type ===
              type,
          )?.props.customContent as React.ReactElement<P>
        ).props;

      act(() => {
        contentOf<{ onSwap: () => void }>(NotEnoughTokenBottomSheet).onSwap();
      });
      act(() => {
        contentOf<{ onSourcePickerPress: () => void }>(
          EarnSwapBottomSheet,
        ).onSourcePickerPress();
      });
      act(() => {
        contentOf<{ onSelect: (balance: unknown) => void }>(
          EarnSwapFromBottomSheet,
        ).onSelect({
          id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          tokenCode: "USDC",
          tokenType: "credit_alphanum4",
          token: {
            type: "credit_alphanum4",
            code: "USDC",
            issuer: {
              key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            },
          },
          total: new BigNumber("10"),
        });
      });

      expect(mockAnalytics.track).toHaveBeenCalledWith("swap.picker_opened", {
        side: "from",
        trigger: "dropdown",
        source: "earn",
      });
      expect(mockAnalytics.track).toHaveBeenCalledWith("swap.source_selected", {
        asset_code: "USDC",
        asset_issuer:
          "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        list: "balances",
        source: "earn",
      });
    });

    it("tags the swap's own events as opened from Earn", () => {
      mockUseEarnTokens.supported = [
        {
          ...makeOption("EURC"),
          canonicalId:
            "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        },
      ];
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId("earn-token-option-EURC"));
      // eslint-disable-next-line no-underscore-dangle
      const sheets = globalThis.__earnTokenPickerMockSheets;
      act(() => {
        (
          sheets.find(
            ({ props }) =>
              (props.customContent as React.ReactElement | undefined)?.type ===
              NotEnoughTokenBottomSheet,
          )?.props.customContent as React.ReactElement<{ onSwap: () => void }>
        ).props.onSwap();
      });

      expect(useSwapStore.getState().entrySource).toBe("earn");
    });
  });

  // The sell card reads like main Swap's: the spendable balance, and the
  // amount in the other unit.
  describe("the Earn swap's sell card", () => {
    const { useBalancesList: mockUseBalancesList } = jest.requireMock(
      "hooks/useBalancesList",
    );
    const defaultBalancesList = mockUseBalancesList.getMockImplementation();

    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
      mockUseBalancesList.mockReturnValue({
        balanceItems: [
          {
            id: "native",
            tokenType: "native",
            token: { type: "native", code: "XLM" },
            tokenCode: "XLM",
            total: new BigNumber("100"),
            available: new BigNumber("100"),
            minimumBalance: new BigNumber("1"),
          },
        ],
        hiddenBalanceItems: [],
        scanResults: {},
      });
    });

    afterEach(() => {
      mockUseBalancesList.mockImplementation(defaultBalancesList);
      act(() => {
        useSwapStore.getState().resetSwap();
        useTransactionBuilderStore.getState().resetTransaction();
      });
    });

    const findByContent = (type: unknown) =>
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__earnTokenPickerMockSheets.find(
        ({ props }) =>
          (props.customContent as React.ReactElement | undefined)?.type ===
          type,
      );

    // Opens the Earn swap for EURC, which the account doesn't hold.
    const openEarnSwap = () => {
      mockUseEarnTokens.supported = [
        {
          ...makeOption("EURC"),
          canonicalId:
            "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        },
      ];
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId("earn-token-option-EURC"));
      act(() => {
        (
          findByContent(NotEnoughTokenBottomSheet)?.props
            .customContent as React.ReactElement<{ onSwap: () => void }>
        ).props.onSwap();
      });
    };

    it("shows the spendable XLM and the amount in the other unit", () => {
      openEarnSwap();

      const { availableBalanceText, sourceSecondaryText } = (
        findByContent(EarnSwapBottomSheet)?.props
          .customContent as React.ReactElement<{
          availableBalanceText: string | null;
          sourceSecondaryText: string;
        }>
      ).props;

      // 100 XLM, less the 1 XLM minimum balance, the 0.5 XLM the EURC
      // trustline locks and the swap fee.
      expect(availableBalanceText).toBe(
        `${formatTokenForDisplay("98.49754", "XLM")} common.available`,
      );
      // No amount typed yet, in token mode: its fiat value.
      expect(sourceSecondaryText).toBe("$0.00");
    });

    // In fiat mode the card's main line is the fiat amount, which setting the
    // token amount alone leaves as it was.
    it("fills in the fiat amount on Max in fiat mode, as on main Swap", () => {
      mockUseBalancesList.mockReturnValue({
        balanceItems: [
          {
            id: "native",
            tokenType: "native",
            token: { type: "native", code: "XLM" },
            tokenCode: "XLM",
            total: new BigNumber("100"),
            available: new BigNumber("100"),
            minimumBalance: new BigNumber("1"),
            currentPrice: new BigNumber("0.5"),
          },
        ],
        hiddenBalanceItems: [],
        scanResults: {},
      });
      openEarnSwap();
      const sheetProps = () =>
        (
          findByContent(EarnSwapBottomSheet)?.props
            .customContent as React.ReactElement<{
            converter: {
              tokenAmount: string;
              fiatAmountDisplay: string;
              setShowFiatAmount: (show: boolean) => void;
            };
            onPercentagePress: (percentage: number) => void;
          }>
        ).props;

      act(() => {
        sheetProps().converter.setShowFiatAmount(true);
      });
      act(() => {
        sheetProps().onPercentagePress(100);
      });

      // The spendable 98.49754 XLM is $49.24877; $49.25 would be 98.5 XLM,
      // more than spendable, so the fiat drops a cent, as on main Swap, and
      // the token amount is what that buys.
      const { converter } = sheetProps();
      expect(converter.fiatAmountDisplay).toBe("49.24");
      expect(converter.tokenAmount).toBe("98.48");
    });

    // The receive card keeps its fiat line from the start, as on main Swap,
    // so the card doesn't grow when the first quote arrives.
    describe("the receive card's fiat line before there is a quote", () => {
      const receiveFiatText = () =>
        (
          findByContent(EarnSwapBottomSheet)?.props
            .customContent as React.ReactElement<{
            destinationSecondaryText?: string;
          }>
        ).props.destinationSecondaryText;

      it("reads $0.00 for a token with a price", () => {
        mockUseEarnTokens.pool = {
          name: "Fixed",
          reserves: [{ assetId: EURC_TESTNET_SAC, priceUsd: 1.08 }],
        };
        openEarnSwap();

        expect(receiveFiatText()).toBe(formatFiatAmount("0"));
      });

      it("reads -- for a token without a price", () => {
        openEarnSwap();

        expect(receiveFiatText()).toBe("--");
      });
    });

    // As on main Swap: switching the sell card to fiat switches the receive
    // card too, so both cards lead with the same unit.
    describe("the receive card in fiat mode", () => {
      afterEach(() => {
        mockEarnSwapOverrides = {};
      });

      const sheetProps = () =>
        (
          findByContent(EarnSwapBottomSheet)?.props
            .customContent as React.ReactElement<{
            converter: { setShowFiatAmount: (show: boolean) => void };
            destinationAmount: string;
            destinationSecondaryText?: string;
          }>
        ).props;

      // Fiat mode needs a priced source: the converter leaves it for an
      // unpriced one, whose card has no toggle.
      const openWithEurcPrice = () => {
        mockUseBalancesList.mockReturnValue({
          balanceItems: [
            {
              id: "native",
              tokenType: "native",
              token: { type: "native", code: "XLM" },
              tokenCode: "XLM",
              total: new BigNumber("100"),
              available: new BigNumber("100"),
              minimumBalance: new BigNumber("1"),
              currentPrice: new BigNumber("0.5"),
            },
          ],
          hiddenBalanceItems: [],
          scanResults: {},
        });
        mockUseEarnTokens.pool = {
          name: "Fixed",
          reserves: [{ assetId: EURC_TESTNET_SAC, priceUsd: 1.08 }],
        };
        openEarnSwap();
      };

      it("leads with the fiat value before there is a quote", () => {
        openWithEurcPrice();

        act(() => {
          sheetProps().converter.setShowFiatAmount(true);
        });

        expect(sheetProps().destinationAmount).toBe(formatFiatAmount("0"));
        expect(sheetProps().destinationSecondaryText).toBe(
          `${formatTokenForDisplay("0")} EURC`,
        );
      });

      it("leads with the quote's fiat value, and back with its token amount", () => {
        mockEarnSwapOverrides = { pathResult: { destinationAmount: "10" } };
        openWithEurcPrice();

        act(() => {
          sheetProps().converter.setShowFiatAmount(true);
        });

        expect(sheetProps().destinationAmount).toBe(
          formatFiatAmount(new BigNumber("10.8")),
        );
        expect(sheetProps().destinationSecondaryText).toBe(
          `${formatTokenForDisplay("10")} EURC`,
        );

        act(() => {
          sheetProps().converter.setShowFiatAmount(false);
        });

        expect(sheetProps().destinationAmount).toBe(
          formatTokenForDisplay("10"),
        );
        expect(sheetProps().destinationSecondaryText).toBe(
          formatFiatAmount(new BigNumber("10.8")),
        );
      });
    });

    // Review reads the receive token's fiat from the prices store, and an
    // unheld token has no balance price to fall back on.
    describe("the receive token's price", () => {
      const { fetchPricesForTokenIds } = usePricesStore.getState();
      afterEach(() => {
        usePricesStore.setState({ fetchPricesForTokenIds });
      });

      it("is fetched as on main Swap", () => {
        const mockFetchPrices = jest.fn(() => Promise.resolve(true));
        usePricesStore.setState({ fetchPricesForTokenIds: mockFetchPrices });

        openEarnSwap();

        expect(mockFetchPrices).toHaveBeenCalledWith({
          tokens: [
            "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
          ],
          network: NETWORKS.TESTNET,
        });
      });
    });

    // A route's Soroban resource fee comes out of what can be swapped, as on
    // main Swap. Before the quote for these inputs, the pair's last one does.
    it("leaves the route's network fee out of the spendable XLM", () => {
      openEarnSwap();
      const { destinationToken } = useSwapStore.getState();
      const sourceBalance =
        mockUseBalancesList.mock.results[0]?.value?.balanceItems[0];
      const pairKey = swapPairKey({
        sourceBalance,
        destinationBalance: descriptorAsPathBalance(destinationToken!),
        network: NETWORKS.TESTNET,
        publicKey: "GTESTPUBLICKEY",
      });
      act(() => {
        useSwapStore.setState({
          lastResourceFee: { pairKey: pairKey ?? "", fee: "1" },
        });
      });

      const { availableBalanceText } = (
        findByContent(EarnSwapBottomSheet)?.props
          .customContent as React.ReactElement<{
          availableBalanceText: string | null;
        }>
      ).props;

      // The 98.49754 above, less the 1 XLM resource fee.
      expect(availableBalanceText).toBe(
        `${formatTokenForDisplay("97.49754", "XLM")} common.available`,
      );
    });

    describe("its quote, as on main Swap", () => {
      afterEach(() => {
        mockEarnSwapOverrides = {};
      });

      const swapSheetProps = () =>
        (
          findByContent(EarnSwapBottomSheet)?.props
            .customContent as React.ReactElement<{
            isReceiveLoading?: boolean;
            networkFee?: string | null;
            onSeeDetails?: () => void;
            showQuoteUnavailable?: boolean;
            onQuoteUnavailablePress?: () => void;
          }>
        ).props;

      it("shimmers the receive amount while the quote is on its way", () => {
        mockEarnSwapOverrides = { isQuotePending: true };
        openEarnSwap();

        expect(swapSheetProps().isReceiveLoading).toBe(true);
      });

      it("opens the details over the swap sheet", async () => {
        mockEarnSwapOverrides = {
          isQuoteCurrent: true,
          networkFeeText: "0.00246 XLM",
          networkFeeFiatText: undefined,
        };
        openEarnSwap();

        expect(swapSheetProps().networkFee).toBe("0.00246 XLM");
        await act(async () => {
          swapSheetProps().onSeeDetails?.();
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          });
        });

        expect(
          findByContent(SwapDetailsBottomSheet)?.ref.present,
        ).toHaveBeenCalled();
      });

      it("explains a quote that is unavailable", async () => {
        mockEarnSwapOverrides = { showQuoteUnavailable: true };
        openEarnSwap();

        expect(swapSheetProps().showQuoteUnavailable).toBe(true);
        await act(async () => {
          swapSheetProps().onQuoteUnavailablePress?.();
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          });
        });

        expect(
          findByContent(InformationBottomSheet)?.ref.present,
        ).toHaveBeenCalled();
      });
    });

    // A landed swap leaves its amount on the sell card until the sheet
    // closes, while the balance refresh takes that amount out of the
    // account.
    it("stops calling the amount more than is spendable once the swap is submitted", () => {
      openEarnSwap();
      act(() => {
        useSwapStore.getState().setSourceAmount("99");
      });

      expect(mockEarnSwapResult.amountError).toBe(
        "swapScreen.errors.insufficientBalance",
      );

      act(() => {
        useTransactionBuilderStore.setState({ transactionHash: "swap-hash" });
      });

      expect(mockEarnSwapResult.amountError).toBeNull();
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
        ({ props }) => props.analyticsEvent === "swap_amount",
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

    // As on main Swap, the swap fee starts at the network's recommendation,
    // scaled by the operations: opening the EURC trustline makes it two.
    it("starts the swap at the recommended fee", () => {
      act(() => {
        useSwapSettingsStore.getState().resetToDefaults();
      });
      mockUseEarnTokens.supported = [
        {
          ...makeOption("EURC"),
          canonicalId:
            "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        },
      ];
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId("earn-token-option-EURC"));
      act(() => {
        notEnoughSheetPropsFor().onSwap();
      });

      expect(useSwapSettingsStore.getState().swapFee).toBe("0.00246");
    });

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
        ({ props }) => props.analyticsEvent === "swap_confirm",
      );
      expect(
        findByContent(SecurityDetailBottomSheet)?.ref.present,
      ).not.toHaveBeenCalled();
      expect(reviewSheet?.ref.present).not.toHaveBeenCalled();
    });
  });

  // As on main Swap: leaving the Earn swap's Review without confirming is
  // reported as a rejection.
  describe("leaving the Earn swap's Review", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    it("reports a rejection", () => {
      const { analytics: mockAnalytics } =
        jest.requireMock("services/analytics");
      renderScreen();
      // eslint-disable-next-line no-underscore-dangle
      const sheets = globalThis.__earnTokenPickerMockSheets;
      const reviewSheet = sheets.find(
        ({ props }) => props.analyticsEvent === "swap_confirm",
      );
      const { onDismiss } = reviewSheet?.props.bottomSheetModalProps as {
        onDismiss: () => void;
      };

      act(() => {
        onDismiss();
      });

      expect(
        mockAnalytics.trackInternalSignedTransactionRejected,
      ).toHaveBeenCalledTimes(1);
    });
  });
});

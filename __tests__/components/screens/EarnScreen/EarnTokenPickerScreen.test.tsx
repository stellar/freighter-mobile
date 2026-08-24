/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, fireEvent } from "@testing-library/react-native";
import EarnTokenPickerScreen from "components/screens/EarnScreen/screens/EarnTokenPickerScreen";
import { EARN_ROUTES, EarnStackParamList } from "config/routes";
import { usePreferencesStore } from "ducks/preferences";
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
    ReactModule.useImperativeHandle(modalRef, () => {
      const spy: SheetRefSpy = { present: jest.fn(), dismiss: jest.fn() };
      // eslint-disable-next-line no-underscore-dangle
      globalThis.__earnTokenPickerMockSheets.push({ ref: spy, props });
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
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "TESTNET" }),
}));

jest.mock("ducks/balances", () => ({
  useBalancesStore: () => ({ pricedBalances: {} }),
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

let mockUseEarnTokens: {
  isLoading: boolean;
  error: string | null;
  held: unknown[];
  supported: unknown[];
  pool: unknown;
  refetch: jest.Mock;
};

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
  // Figma `13701:332629`: the held section is replaced by explanatory prose
  // when the user holds none of the pool's reserves -- the only variant the
  // mock draws.
  describe("list structure", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);
    });

    it("shows the empty-held prose instead of an 'in your account' section", () => {
      mockUseEarnTokens.supported = [makeOption("USDC")];

      const { getByTestId, queryByText } = renderScreen();

      expect(getByTestId("earn-token-picker-empty-held")).toBeTruthy();
      expect(queryByText("earnTokenPicker.inYourAccount")).toBeNull();
      expect(getByTestId("earn-token-option-USDC")).toBeTruthy();
    });

    it("shows the held section, and no empty-held prose, when the user holds a reserve", () => {
      mockUseEarnTokens.held = [makeOption("XLM", "100")];
      mockUseEarnTokens.supported = [makeOption("USDC")];

      const { getByText, queryByTestId } = renderScreen();

      expect(getByText("earnTokenPicker.inYourAccount")).toBeTruthy();
      expect(queryByTestId("earn-token-picker-empty-held")).toBeNull();
    });

    it("renders the disclaimer and the ambient glow", () => {
      mockUseEarnTokens.supported = [makeOption("USDC")];

      const { getByText, getByTestId } = renderScreen();

      expect(getByText("earnTokenPicker.apyDisclaimer")).toBeTruthy();
      expect(getByTestId("earn-glow")).toBeTruthy();
    });
  });
});

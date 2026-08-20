/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act } from "@testing-library/react-native";
import EarnTokenPickerScreen from "components/screens/EarnScreen/screens/EarnTokenPickerScreen";
import { EARN_ROUTES, EarnStackParamList } from "config/routes";
import { usePreferencesStore } from "ducks/preferences";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// This screen presents the first-run Earn intro sheet on mount, gated on
// `usePreferencesStore.hasSeenEarnIntro` -- Task 13 removed the dead
// `EARN_ROUTES` intro entry, so this is a bottom sheet over the token
// picker rather than its own route/screen. Mocking approach modeled on
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
    // Don't render customContent -- the real EarnIntroBottomSheet/
    // PoolDetailsBottomSheet/NotEnoughTokenBottomSheet are covered by their
    // own component tests.
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

// Sidesteps CustomHeaderButton/ContextMenuButton's native dependencies --
// this screen's pool-info header button is unrelated to the intro sheet
// under test here.
jest.mock("hooks/useRightHeader");

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

const makeNavigation = () =>
  ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }) as unknown as Props["navigation"];

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

/** The earn-intro `<BottomSheet>` is declared first in the JSX, so it's
 * always index 0 in mount order. */
const getEarnIntroSheet = () =>
  // eslint-disable-next-line no-underscore-dangle
  globalThis.__earnTokenPickerMockSheets[0];

describe("EarnTokenPickerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line no-underscore-dangle
    globalThis.__earnTokenPickerMockSheets = [];
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
    it("presents the intro sheet on mount when the flag is unset", () => {
      usePreferencesStore.getState().setHasSeenEarnIntro(false);

      renderScreen();

      expect(getEarnIntroSheet().ref.present).toHaveBeenCalledTimes(1);
    });

    it("does NOT present the intro sheet when the flag is already set", () => {
      usePreferencesStore.getState().setHasSeenEarnIntro(true);

      renderScreen();

      expect(getEarnIntroSheet().ref.present).not.toHaveBeenCalled();
    });

    it("does not present while the token list is still loading", () => {
      usePreferencesStore.getState().setHasSeenEarnIntro(false);
      mockUseEarnTokens.isLoading = true;

      renderScreen();

      // The loading branch returns before the BottomSheet tree mounts at
      // all, so there is nothing captured to present.
      // eslint-disable-next-line no-underscore-dangle
      expect(globalThis.__earnTokenPickerMockSheets).toHaveLength(0);
    });

    it("does not present when the token fetch errored", () => {
      usePreferencesStore.getState().setHasSeenEarnIntro(false);
      mockUseEarnTokens.error = "boom";

      renderScreen();

      // eslint-disable-next-line no-underscore-dangle
      expect(globalThis.__earnTokenPickerMockSheets).toHaveLength(0);
    });
  });

  describe("dismiss wiring", () => {
    beforeEach(() => {
      usePreferencesStore.getState().setHasSeenEarnIntro(false);
    });

    it("marks the intro seen when the sheet's onDismiss fires (CTA or close, from inside EarnIntroBottomSheet)", () => {
      renderScreen();

      const introSheet = getEarnIntroSheet();
      const customContent = introSheet.props
        .customContent as React.ReactElement<{
        onDismiss: () => void;
      }>;

      expect(usePreferencesStore.getState().hasSeenEarnIntro).toBe(false);

      act(() => {
        customContent.props.onDismiss();
      });

      expect(usePreferencesStore.getState().hasSeenEarnIntro).toBe(true);
    });

    it("also marks the intro seen via the sheet's native onDismiss (swipe/backdrop dismissal)", () => {
      renderScreen();

      const introSheet = getEarnIntroSheet();
      const bottomSheetModalProps = introSheet.props.bottomSheetModalProps as {
        onDismiss: () => void;
      };

      expect(usePreferencesStore.getState().hasSeenEarnIntro).toBe(false);

      act(() => {
        bottomSheetModalProps.onDismiss();
      });

      expect(usePreferencesStore.getState().hasSeenEarnIntro).toBe(true);
    });
  });
});

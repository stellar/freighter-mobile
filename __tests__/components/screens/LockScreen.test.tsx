import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { LockScreen } from "components/screens/LockScreen";
import { getButtonColors } from "components/sds/Button/theme";
import { LoginType } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import {
  AppState,
  BackHandler,
  EmitterSubscription,
  Keyboard,
  StyleSheet,
} from "react-native";
import * as Keychain from "react-native-keychain";

// The real hook, not the global stub: the lock screen leans on it to settle
// the sign-in method when it mounts.
jest.mock("hooks/useBiometrics", () =>
  jest.requireActual("hooks/useBiometrics"),
);

// Stands in for the BottomSheet wrapper: renders the sheet's content so its
// buttons can be pressed, and records present/dismiss on the modal ref. The
// latest ref is kept in mockSheet; fireDismiss mirrors gorhom reporting the
// sheet closed (swipe, backdrop or a programmatic dismiss): onChange(-1), then
// onDismiss. fireDismissWhileOpening mirrors a close that cuts the opening
// animation short, which gorhom reports through onDismiss alone.
type SheetSpy = {
  present: jest.Mock;
  dismiss: jest.Mock;
  fireDismiss: () => void;
  fireDismissWhileOpening: () => void;
};
let mockSheet: SheetSpy | undefined;
jest.mock("components/BottomSheet", () => {
  /* eslint-disable global-require, @typescript-eslint/no-var-requires */
  const ReactModule = require("react");
  const RNModule = require("react-native");
  /* eslint-enable global-require, @typescript-eslint/no-var-requires */

  const SheetStub = ({
    modalRef,
    customContent,
    bottomSheetModalProps,
  }: {
    modalRef: React.RefObject<unknown>;
    customContent?: React.ReactNode;
    bottomSheetModalProps?: {
      onChange?: (index: number) => void;
      onDismiss?: () => void;
    };
  }) => {
    const onChangeRef = ReactModule.useRef(bottomSheetModalProps?.onChange);
    onChangeRef.current = bottomSheetModalProps?.onChange;
    const onDismissRef = ReactModule.useRef(bottomSheetModalProps?.onDismiss);
    onDismissRef.current = bottomSheetModalProps?.onDismiss;

    ReactModule.useImperativeHandle(modalRef, () => {
      mockSheet = {
        present: jest.fn(() => onChangeRef.current?.(0)),
        dismiss: jest.fn(),
        fireDismiss: () => {
          onChangeRef.current?.(-1);
          onDismissRef.current?.();
        },
        fireDismissWhileOpening: () => onDismissRef.current?.(),
      };
      return mockSheet;
    }, []);

    return ReactModule.createElement(RNModule.View, null, customContent);
  };

  return { __esModule: true, default: SheetStub };
});

jest.mock("services/autoLock", () => ({
  persistAutoLockTimer: jest.fn().mockResolvedValue(undefined),
}));

// Controllable privacy-shield state so we can assert the prompt is held until
// the shield drops on return from background.
let mockShieldVisible = false;
const mockShieldHiddenListeners = new Set<() => void>();
const emitShieldHidden = () => {
  mockShieldVisible = false;
  mockShieldHiddenListeners.forEach((listener) => listener());
};
jest.mock("helpers/privacyShield", () => ({
  isPrivacyShieldVisible: () => mockShieldVisible,
  onPrivacyShieldHidden: (listener: () => void) => {
    mockShieldHiddenListeners.add(listener);
    return () => mockShieldHiddenListeners.delete(listener);
  },
  markPrivacyShieldVisible: jest.fn(),
  hidePrivacyShield: jest.fn(),
}));

const LIGHT_BUTTON_COLORS = getButtonColors("light");

type LockScreenNavigationProp = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN
>["navigation"];

type LockScreenRouteProp = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN
>["route"];

const mockNavigation = {
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as unknown as LockScreenNavigationProp;

const mockRoute = {
  key: "lock-screen",
  name: ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN,
} as unknown as LockScreenRouteProp;

describe("LockScreen", () => {
  const mockSignIn = jest.fn();
  const mockLogout = jest.fn();
  const mockVerifyActionWithBiometrics = jest.fn(
    (callback: (password?: string) => Promise<unknown>) =>
      callback("biometric-password"),
  );

  const previousAppState = AppState.currentState;

  beforeEach(() => {
    jest.clearAllMocks();
    (AppState as { currentState: string }).currentState = "active";
    mockShieldVisible = false;
    mockShieldHiddenListeners.clear();
    (Keychain.getSupportedBiometryType as jest.Mock).mockResolvedValue(
      Keychain.BIOMETRY_TYPE.FACE_ID,
    );

    useAuthenticationStore.setState({
      signIn: mockSignIn,
      logout: mockLogout,
      verifyActionWithBiometrics:
        mockVerifyActionWithBiometrics as unknown as ReturnType<
          typeof useAuthenticationStore.getState
        >["verifyActionWithBiometrics"],
      signInMethod: LoginType.FACE,
      isLoading: false,
      error: null,
      suppressBiometricAutoPrompt: false,
    });
    usePreferencesStore.setState({ isBiometricsEnabled: true });
  });

  afterAll(() => {
    (AppState as { currentState: typeof previousAppState }).currentState =
      previousAppState;
  });

  const renderLockScreen = async (route: LockScreenRouteProp = mockRoute) => {
    const screen = renderWithProviders(
      <LockScreen navigation={mockNavigation} route={route} />,
    );

    // Lets useBiometrics settle the sign-in method inside act()
    await act(async () => {});

    return screen;
  };

  it("sets its heading in Funnel Sans, the Varial display face", async () => {
    const { getByText } = await renderLockScreen();

    expect(
      StyleSheet.flatten(getByText("Welcome back").props.style),
    ).toMatchObject({ fontFamily: "FunnelSans-Medium" });
  });

  it("auto-prompts biometrics on mount and unlocks with the stored password", async () => {
    await renderLockScreen();

    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(1);
    });
    expect(mockSignIn).toHaveBeenCalledWith({
      password: "biometric-password",
    });
  });

  it("does not auto-prompt when biometrics are disabled", async () => {
    usePreferencesStore.setState({ isBiometricsEnabled: false });
    useAuthenticationStore.setState({ signInMethod: LoginType.PASSWORD });

    await renderLockScreen();

    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).not.toHaveBeenCalled();
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("does not auto-prompt on mount when the lock was user-initiated (idle or manual)", async () => {
    // The user stayed in the app and idled out, or locked manually — no
    // unprompted Face ID
    useAuthenticationStore.setState({ suppressBiometricAutoPrompt: true });

    await renderLockScreen();

    // Give the mount effect a chance to (not) fire
    await waitFor(() => {
      expect(mockSignIn).not.toHaveBeenCalled();
    });
    expect(mockVerifyActionWithBiometrics).not.toHaveBeenCalled();
  });

  it("still re-prompts on return from background after a user-initiated lock", async () => {
    useAuthenticationStore.setState({ suppressBiometricAutoPrompt: true });

    await renderLockScreen();

    // No mount prompt for the idle lock...
    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).not.toHaveBeenCalled();
    });

    // ...but returning from the background still prompts (coming from bg)
    const appStateHandlers = (
      AppState.addEventListener as jest.Mock
    ).mock.calls.map(([, handler]) => handler as (state: string) => void);

    appStateHandlers.forEach((handler) => handler("background"));
    appStateHandlers.forEach((handler) => handler("active"));

    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(1);
    });
  });

  it("re-prompts biometrics when the app returns from the background", async () => {
    await renderLockScreen();

    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(1);
    });

    // Simulate the app going to the background and returning to the foreground
    const appStateHandlers = (
      AppState.addEventListener as jest.Mock
    ).mock.calls.map(([, handler]) => handler as (state: string) => void);

    appStateHandlers.forEach((handler) => handler("background"));
    appStateHandlers.forEach((handler) => handler("active"));

    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(2);
    });
  });

  it("holds the biometric prompt until the privacy shield drops on return from background", async () => {
    await renderLockScreen();

    // Mount prompt fires immediately — the shield isn't up at mount
    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(1);
    });

    // App backgrounds (shield raised) and returns to the foreground
    mockShieldVisible = true;
    const appStateHandlers = (
      AppState.addEventListener as jest.Mock
    ).mock.calls.map(([, handler]) => handler as (state: string) => void);

    appStateHandlers.forEach((handler) => handler("background"));
    appStateHandlers.forEach((handler) => handler("active"));

    // The prompt is held while the shield still covers the wallet
    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(1);
    });

    // Once the shield drops, the held prompt fires so Face ID appears over
    // the now-visible lock screen
    emitShieldHidden();

    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(2);
    });
  });

  describe("password field focus", () => {
    beforeEach(() => {
      usePreferencesStore.setState({ isBiometricsEnabled: false });
      useAuthenticationStore.setState({ signInMethod: LoginType.PASSWORD });
    });

    it("does not auto-focus when the app launches into it", async () => {
      // The navigator's initial route carries no params, and on a cold start
      // it mounts under the launch splash.
      const { getByPlaceholderText } = await renderLockScreen();

      expect(getByPlaceholderText("Password").props.autoFocus).toBe(false);
    });

    it("auto-focuses when navigated to (e.g. logout)", async () => {
      const { getByPlaceholderText } = await renderLockScreen({
        ...mockRoute,
        params: { autoFocus: true },
      });

      expect(getByPlaceholderText("Password").props.autoFocus).toBe(true);
    });

    it("never auto-focuses for biometric users, who unlock with biometrics first", async () => {
      usePreferencesStore.setState({ isBiometricsEnabled: true });
      useAuthenticationStore.setState({ signInMethod: LoginType.FACE });

      const { getByTestId } = await renderLockScreen({
        ...mockRoute,
        params: { autoFocus: true },
      });

      expect(getByTestId("password-input").props.autoFocus).toBe(false);
    });
  });

  it("does not re-prompt on inactive-to-active transitions (e.g. the biometric overlay itself)", async () => {
    await renderLockScreen();

    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(1);
    });

    const appStateHandlers = (
      AppState.addEventListener as jest.Mock
    ).mock.calls.map(([, handler]) => handler as (state: string) => void);

    appStateHandlers.forEach((handler) => handler("inactive"));
    appStateHandlers.forEach((handler) => handler("active"));

    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(1);
    });
  });

  describe("with biometrics enabled", () => {
    it("shows the password field with a biometrics button beside it", async () => {
      const { getByTestId, getByLabelText, queryByLabelText } =
        await renderLockScreen();

      expect(getByTestId("password-input")).toBeTruthy();
      expect(getByLabelText("Unlock with biometrics")).toBeTruthy();
      expect(queryByLabelText("Show password")).toBeNull();
    });

    it("keeps the biometrics button once a password is typed", async () => {
      const { getByTestId, getByLabelText, queryByLabelText } =
        await renderLockScreen();

      fireEvent.changeText(getByTestId("password-input"), "half-typed");

      expect(getByLabelText("Unlock with biometrics")).toBeTruthy();
      expect(queryByLabelText("Show password")).toBeNull();
    });

    it("prompts again when the biometrics button is tapped after the auto-prompt", async () => {
      const { getByLabelText } = await renderLockScreen();

      await waitFor(() => {
        expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(1);
      });

      fireEvent.press(getByLabelText("Unlock with biometrics"));

      await waitFor(() => {
        expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(2);
      });
      expect(mockSignIn).toHaveBeenLastCalledWith({
        password: "biometric-password",
      });
    });

    it("unlocks with the typed password rather than biometrics", async () => {
      // No auto-prompt, so any biometric call would come from the button
      useAuthenticationStore.setState({ suppressBiometricAutoPrompt: true });
      const { getByTestId } = await renderLockScreen();

      fireEvent.changeText(getByTestId("password-input"), "correct horse");
      fireEvent.press(getByTestId("unlock-button"));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({ password: "correct horse" });
      });
      expect(mockVerifyActionWithBiometrics).not.toHaveBeenCalled();
    });

    it("offers biometrics again after the user switched to password elsewhere", async () => {
      // e.g. "Use password instead" on Show Recovery Phrase left this behind
      useAuthenticationStore.setState({ signInMethod: LoginType.PASSWORD });

      const { findByLabelText } = await renderLockScreen();

      expect(await findByLabelText("Unlock with biometrics")).toBeTruthy();
    });
  });

  describe("with biometrics disabled", () => {
    beforeEach(() => {
      usePreferencesStore.setState({ isBiometricsEnabled: false });
      useAuthenticationStore.setState({ signInMethod: LoginType.PASSWORD });
    });

    it("has no biometrics button", async () => {
      const { queryByLabelText } = await renderLockScreen();

      expect(queryByLabelText("Unlock with biometrics")).toBeNull();
    });

    it("masks the password until the user asks to see it", async () => {
      const { getByTestId, getByLabelText } = await renderLockScreen();

      expect(getByTestId("password-input").props.secureTextEntry).toBe(true);

      fireEvent.press(getByLabelText("Show password"));
      expect(getByTestId("password-input").props.secureTextEntry).toBe(false);

      fireEvent.press(getByLabelText("Hide password"));
      expect(getByTestId("password-input").props.secureTextEntry).toBe(true);
    });
  });

  describe("unlock button", () => {
    it.each([
      ["an empty", true, ""],
      ["a 7-character", true, "1234567"],
      ["an 8-character", false, "12345678"],
      ["a 2048-character", false, "x".repeat(2048)],
      ["a 2049-character", true, "x".repeat(2049)],
    ])(
      "with %s password, disabled is %s",
      async (_label, expectedDisabled, password) => {
        // Biometric users too: Unlock no longer stands in for the prompt
        const { getByTestId } = await renderLockScreen();

        fireEvent.changeText(getByTestId("password-input"), password);

        expect(
          getByTestId("unlock-button").props.accessibilityState?.disabled,
        ).toBe(expectedDisabled);
      },
    );

    it("unlocks from the keyboard's return key only once the password is valid", async () => {
      useAuthenticationStore.setState({ suppressBiometricAutoPrompt: true });
      const { getByTestId } = await renderLockScreen();
      const input = getByTestId("password-input");

      fireEvent.changeText(input, "short");
      fireEvent(input, "submitEditing");
      expect(mockSignIn).not.toHaveBeenCalled();

      fireEvent.changeText(input, "long enough");
      fireEvent(input, "submitEditing");

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({ password: "long enough" });
      });
    });
  });

  describe("forgot password sheet", () => {
    beforeEach(() => {
      useAuthenticationStore.setState({ suppressBiometricAutoPrompt: true });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    // The sheet opens a promise after the press, once the keyboard is down
    const pressForgotPassword = (
      getByTestId: Awaited<ReturnType<typeof renderLockScreen>>["getByTestId"],
    ) =>
      act(async () => {
        fireEvent.press(getByTestId("forgot-password-button"));
        await Promise.resolve();
      });

    it("opens from Forgot password straight away when no keyboard is up", async () => {
      jest.spyOn(Keyboard, "isVisible").mockReturnValue(false);
      const { getByTestId } = await renderLockScreen();

      await pressForgotPassword(getByTestId);

      expect(mockSheet?.present).toHaveBeenCalledTimes(1);
    });

    it("puts the keyboard away and opens only once it has finished hiding", async () => {
      jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
      const dismissKeyboard = jest.spyOn(Keyboard, "dismiss");
      const { getByTestId } = await renderLockScreen();
      let keyboardDidHide: (() => void) | undefined;
      jest
        .spyOn(Keyboard, "addListener")
        .mockImplementation((...args: unknown[]) => {
          if (args[0] === "keyboardDidHide") {
            keyboardDidHide = args[1] as () => void;
          }
          return { remove: jest.fn() } as unknown as EmitterSubscription;
        });

      await pressForgotPassword(getByTestId);

      expect(dismissKeyboard).toHaveBeenCalled();
      expect(mockSheet?.present).not.toHaveBeenCalled();

      await act(async () => {
        keyboardDidHide?.();
        await Promise.resolve();
      });

      expect(mockSheet?.present).toHaveBeenCalledTimes(1);
    });

    it("draws Reset wallet in red, the size of Unlock", async () => {
      const { getByTestId } = await renderLockScreen();
      const { height } = getByTestId("unlock-button").props.style;

      expect(height).toEqual(expect.any(Number));
      expect(
        getByTestId("forgot-password-warning-continue-button").props.style,
      ).toMatchObject({
        backgroundColor: LIGHT_BUTTON_COLORS.destructive.background,
        height,
      });
    });

    // Captures the Android back listeners the screen registers, newest last
    const captureBackPresses = () => {
      const listeners: { onBack: () => boolean; remove: jest.Mock }[] = [];
      jest
        .spyOn(BackHandler, "addEventListener")
        .mockImplementation((_event, handler) => {
          const listener = {
            onBack: handler as () => boolean,
            remove: jest.fn(),
          };
          listeners.push(listener);

          return { remove: listener.remove };
        });

      return listeners;
    };

    it("closes on Android's Back instead of letting it through", async () => {
      const listeners = captureBackPresses();
      const { getByTestId } = await renderLockScreen();

      await pressForgotPassword(getByTestId);
      const backPress = listeners[listeners.length - 1];

      expect(backPress).toBeDefined();
      // `true` tells React Native the press was handled, so it never reaches
      // the navigator, which would send the app to the background
      expect(backPress?.onBack()).toBe(true);
      expect(mockSheet?.dismiss).toHaveBeenCalledTimes(1);
    });

    it("stops catching Android's Back once it closes", async () => {
      const listeners = captureBackPresses();
      const { getByTestId } = await renderLockScreen();
      await pressForgotPassword(getByTestId);
      const backPress = listeners[listeners.length - 1];

      act(() => mockSheet?.fireDismiss());

      expect(backPress?.remove).toHaveBeenCalled();
    });

    it("closes from its close button without resetting", async () => {
      const { getByTestId } = await renderLockScreen();

      await pressForgotPassword(getByTestId);
      fireEvent.press(getByTestId("forgot-password-warning-cancel-button"));

      expect(mockSheet?.dismiss).toHaveBeenCalledTimes(1);
      expect(mockLogout).not.toHaveBeenCalled();
    });

    it("wipes the wallet from Reset wallet", async () => {
      const { getByTestId } = await renderLockScreen();

      await pressForgotPassword(getByTestId);
      fireEvent.press(getByTestId("forgot-password-warning-continue-button"));

      expect(mockLogout).toHaveBeenCalledWith(true);
    });

    it("holds the biometric prompt while it is open, then prompts once it closes", async () => {
      useAuthenticationStore.setState({ suppressBiometricAutoPrompt: false });
      const { getByTestId } = await renderLockScreen();
      await waitFor(() => {
        expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(1);
      });
      // The screen subscribes again whenever its prompt guards change, so the
      // newest AppState listener is the live one; older ones hold stale state
      const returnFromBackground = () => {
        const { calls } = (AppState.addEventListener as jest.Mock).mock;
        const [, listener] = calls[calls.length - 1] as [
          string,
          (state: string) => void,
        ];
        act(() => {
          listener("background");
          listener("active");
        });
      };

      await pressForgotPassword(getByTestId);
      returnFromBackground();

      expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(1);

      // Swiped away: the prompt held on the return from the background fires
      act(() => mockSheet?.fireDismiss());

      await waitFor(() => {
        expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(2);
      });
    });

    it("lets biometrics prompt again when closed before it finished opening", async () => {
      const { getByTestId, getByLabelText } = await renderLockScreen();
      // gorhom reports onChange only once an animation completes, so a sheet
      // closed mid-opening (e.g. a double-tap landing on the backdrop) never
      // reports opening or closing through it
      mockSheet?.present.mockImplementation(() => undefined);

      await pressForgotPassword(getByTestId);
      act(() => mockSheet?.fireDismissWhileOpening());
      fireEvent.press(getByLabelText("Unlock with biometrics"));

      await waitFor(() => {
        expect(mockVerifyActionWithBiometrics).toHaveBeenCalledTimes(1);
      });
    });
  });
});

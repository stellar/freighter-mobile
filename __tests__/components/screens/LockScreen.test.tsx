import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { waitFor } from "@testing-library/react-native";
import { LockScreen } from "components/screens/LockScreen";
import { LoginType } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { AppState } from "react-native";

jest.mock("ducks/auth", () => {
  const actual = jest.requireActual("ducks/auth");
  return {
    ...actual,
    getActiveAccountPublicKey: jest.fn().mockResolvedValue(null),
  };
});

jest.mock("services/autoLock", () => ({
  persistAutoLockTimer: jest.fn().mockResolvedValue(undefined),
  applyAutoLockTimerToHashKey: jest.fn().mockResolvedValue(undefined),
}));

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
  const mockVerifyActionWithBiometrics = jest.fn(
    (callback: (password?: string) => Promise<unknown>) =>
      callback("biometric-password"),
  );

  const previousAppState = AppState.currentState;

  beforeEach(() => {
    jest.clearAllMocks();
    (AppState as { currentState: string }).currentState = "active";

    useAuthenticationStore.setState({
      signIn: mockSignIn,
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

  const renderLockScreen = () =>
    renderWithProviders(
      <LockScreen navigation={mockNavigation} route={mockRoute} />,
    );

  it("auto-prompts biometrics on mount and unlocks with the stored password", async () => {
    renderLockScreen();

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

    renderLockScreen();

    await waitFor(() => {
      expect(mockVerifyActionWithBiometrics).not.toHaveBeenCalled();
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("does not auto-prompt on mount when the lock was user-initiated (idle or manual)", async () => {
    // The user stayed in the app and idled out, or locked manually — no
    // unprompted Face ID
    useAuthenticationStore.setState({ suppressBiometricAutoPrompt: true });

    renderLockScreen();

    // Give the mount effect a chance to (not) fire
    await waitFor(() => {
      expect(mockSignIn).not.toHaveBeenCalled();
    });
    expect(mockVerifyActionWithBiometrics).not.toHaveBeenCalled();
  });

  it("still re-prompts on return from background after a user-initiated lock", async () => {
    useAuthenticationStore.setState({ suppressBiometricAutoPrompt: true });

    renderLockScreen();

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
    renderLockScreen();

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

  it("does not re-prompt on inactive-to-active transitions (e.g. the biometric overlay itself)", async () => {
    renderLockScreen();

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
});

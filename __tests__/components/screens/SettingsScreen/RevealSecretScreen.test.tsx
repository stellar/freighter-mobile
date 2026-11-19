import { act, fireEvent, waitFor } from "@testing-library/react-native";
import RevealSecretScreen from "components/screens/SettingsScreen/RevealSecretScreen";
import { AnalyticsEvent } from "config/analyticsConfig";
import { RevealSecretParams } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { track } from "services/analytics/core";

// The real hook needs a navigator; the screen's handler is captured instead.
const mockUsePreventRemove = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  usePreventRemove: (...args: unknown[]) => mockUsePreventRemove(...args),
}));

jest.mock("components/sds/BiometricToggleButton", () => ({
  BiometricToggleButton: () => null,
}));

jest.mock("services/analytics/core", () => ({
  track: jest.fn(),
}));

jest.mock("services/analytics", () => ({
  analytics: { trackCopyBackupPhrase: jest.fn() },
}));

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useSecureClipboard", () => ({
  useSecureClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}));

const mockRevealAccountSecretKey = jest.fn();
const mockRevealRecoveryPhrase = jest.fn();
jest.mock("ducks/auth", () => ({
  revealAccountSecretKey: (...args: unknown[]) =>
    mockRevealAccountSecretKey(...args),
  revealRecoveryPhrase: (...args: unknown[]) =>
    mockRevealRecoveryPhrase(...args),
  // The biometric button runs the action straight away with no stored
  // password, as it does when biometrics are off.
  useAuthenticationStore: () => ({
    signInMethod: "password",
    verifyActionWithBiometrics: (callback: (password?: string) => unknown) =>
      callback(undefined),
  }),
}));

jest.mock("hooks/useBiometrics", () => ({
  useBiometrics: () => ({ getBiometricButtonIcon: () => null }),
}));

const PHRASE =
  "abandon ability able about above absent absorb abstract absurd abuse access accident";
const SECRET = "SBUV3MRWKNS6AYKZ6E6MOUVF2OYMON3MIUASWL3JLY5E3ISDJFELYBRZ";

const navigation = {
  setOptions: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};

type PreventRemoveHandler = (event: {
  data: { action: { type: string } };
}) => void;

const lastPreventRemove = () => {
  const [enabled, handler] = mockUsePreventRemove.mock.calls[
    mockUsePreventRemove.mock.calls.length - 1
  ] as [boolean, PreventRemoveHandler];
  return { enabled, handler };
};

const renderScreen = (params: RevealSecretParams) =>
  renderWithProviders(
    <RevealSecretScreen
      navigation={navigation as never}
      route={{ params } as never}
    />,
  );

const passConsent = (
  screen: ReturnType<typeof renderScreen>,
  testID: string,
) => {
  fireEvent.press(screen.getByTestId(`${testID}-acknowledge`));
  fireEvent.press(screen.getByTestId(`${testID}-continue`));
};

const submitPassword = async (
  screen: ReturnType<typeof renderScreen>,
  testID: string,
  password: string,
) => {
  fireEvent.changeText(screen.getByTestId(`${testID}-password`), password);
  fireEvent.press(screen.getByTestId(`${testID}-submit`));
  // Lets the reveal's promise settle and the step change render.
  await act(() => Promise.resolve());
};

describe("RevealSecretScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("secret key", () => {
    const params: RevealSecretParams = {
      kind: "secretKey",
      accountId: "account-1",
    };

    it("asks for consent before the password", () => {
      const screen = renderScreen(params);

      expect(
        screen.getByText("Your secret key controls this wallet"),
      ).toBeTruthy();
      expect(
        screen.getByTestId("reveal-secret-key-continue").props
          .accessibilityState?.disabled,
      ).toBe(true);

      passConsent(screen, "reveal-secret-key");

      expect(screen.getByTestId("reveal-secret-key-password")).toBeTruthy();
      expect(mockRevealAccountSecretKey).not.toHaveBeenCalled();
    });

    it("reveals the account's key after the password and copies it", async () => {
      mockRevealAccountSecretKey.mockResolvedValue(SECRET);
      const screen = renderScreen(params);

      passConsent(screen, "reveal-secret-key");
      await submitPassword(screen, "reveal-secret-key", "hunter2");

      expect(mockRevealAccountSecretKey).toHaveBeenCalledWith({
        accountId: "account-1",
        password: "hunter2",
      });
      expect(screen.getByTestId("reveal-secret-key-value")).toHaveTextContent(
        SECRET,
      );

      fireEvent.press(screen.getByTestId("reveal-secret-key-copy"));
      expect(mockCopyToClipboard).toHaveBeenCalledWith(SECRET);
    });

    it("stays on the password step with the error for a wrong password", async () => {
      mockRevealAccountSecretKey.mockRejectedValue(
        new Error("Invalid password. Please try again."),
      );
      const screen = renderScreen(params);

      passConsent(screen, "reveal-secret-key");
      await submitPassword(screen, "reveal-secret-key", "wrong");

      expect(
        screen.getByText("Invalid password. Please try again."),
      ).toBeTruthy();
      expect(screen.queryByTestId("reveal-secret-key-value")).toBeNull();
    });

    // A reveal is counted only once the password is accepted.
    it("names the screen from the step it's on", async () => {
      mockRevealAccountSecretKey.mockResolvedValue(SECRET);
      const screen = renderScreen(params);

      expect(track).toHaveBeenLastCalledWith(
        AnalyticsEvent.SCREEN_VIEWED,
        expect.objectContaining({ screen_name: "unlock_secret_key" }),
      );

      passConsent(screen, "reveal-secret-key");
      await submitPassword(screen, "reveal-secret-key", "hunter2");

      await waitFor(() =>
        expect(track).toHaveBeenLastCalledWith(
          AnalyticsEvent.SCREEN_VIEWED,
          expect.objectContaining({
            screen_name: "show_secret_key",
            flow: "security",
          }),
        ),
      );
    });
  });

  describe("back", () => {
    const params: RevealSecretParams = {
      kind: "secretKey",
      accountId: "account-1",
    };

    it("only holds the screen on the password step", async () => {
      mockRevealAccountSecretKey.mockResolvedValue(SECRET);
      const screen = renderScreen(params);

      expect(lastPreventRemove().enabled).toBe(false);

      passConsent(screen, "reveal-secret-key");
      expect(lastPreventRemove().enabled).toBe(true);

      await submitPassword(screen, "reveal-secret-key", "hunter2");
      expect(lastPreventRemove().enabled).toBe(false);
    });

    it("returns from the password step to consent and clears the field", () => {
      const screen = renderScreen(params);

      passConsent(screen, "reveal-secret-key");
      fireEvent.changeText(
        screen.getByTestId("reveal-secret-key-password"),
        "half-typed",
      );

      act(() =>
        lastPreventRemove().handler({ data: { action: { type: "GO_BACK" } } }),
      );

      expect(screen.getByTestId("reveal-secret-key-consent")).toBeTruthy();
      expect(navigation.dispatch).not.toHaveBeenCalled();

      fireEvent.press(screen.getByTestId("reveal-secret-key-continue"));
      expect(screen.getByTestId("reveal-secret-key-password").props.value).toBe(
        "",
      );
    });

    it("lets any other removal through", () => {
      const screen = renderScreen(params);

      passConsent(screen, "reveal-secret-key");
      const action = { type: "RESET" };
      act(() => lastPreventRemove().handler({ data: { action } }));

      expect(navigation.dispatch).toHaveBeenCalledWith(action);
      expect(screen.getByTestId("reveal-secret-key-password")).toBeTruthy();
    });
  });

  describe("recovery phrase", () => {
    it("reveals the named source's phrase as a numbered grid", async () => {
      mockRevealRecoveryPhrase.mockResolvedValue(PHRASE);
      const screen = renderScreen({
        kind: "recoveryPhrase",
        sourceId: "phrase-1",
      });

      passConsent(screen, "reveal-recovery-phrase");
      await submitPassword(screen, "reveal-recovery-phrase", "hunter2");

      expect(mockRevealRecoveryPhrase).toHaveBeenCalledWith({
        password: "hunter2",
        sourceId: "phrase-1",
      });
      expect(screen.getByTestId("reveal-recovery-phrase-value")).toBeTruthy();
      expect(screen.getByText("accident")).toBeTruthy();

      fireEvent.press(screen.getByTestId("reveal-recovery-phrase-copy"));
      expect(mockCopyToClipboard).toHaveBeenCalledWith(PHRASE);
    });
  });
});

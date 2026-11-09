/* eslint-disable @typescript-eslint/naming-convention */
import { act, fireEvent, within } from "@testing-library/react-native";
import { ChoosePasswordScreen } from "components/screens/ChoosePasswordScreen";
import { BiometricsSource } from "config/constants";
import { AUTH_STACK_ROUTES } from "config/routes";
import { useLoginDataStore } from "ducks/loginData";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Keyboard, TextInput } from "react-native";

const mockFinishWalletSetup = jest.fn();
jest.mock("hooks/useFinishWalletSetup", () => ({
  useFinishWalletSetup: () => mockFinishWalletSetup,
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: (
    selector: (state: { isLoading: boolean }) => unknown,
  ) => selector({ isLoading: false }),
}));

const MISMATCH = "Passwords don't match";
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());

const renderScreen = (isImporting = false) =>
  renderWithProviders(
    <ChoosePasswordScreen
      navigation={
        {
          navigate: mockNavigate,
          goBack: mockGoBack,
          addListener: mockAddListener,
        } as never
      }
      route={{ params: { isImporting } } as never}
    />,
  );

/** Ends the screen's slide, as the stack reports it. */
const endTransition = (closing = false) => {
  const [, onTransitionEnd] = (mockAddListener.mock.calls as unknown[][]).find(
    ([event]) => event === "transitionEnd",
  ) as [string, (event: { data: { closing: boolean } }) => void];
  act(() => onTransitionEnd({ data: { closing } }));
};

/**
 * The focus calls each field's input has had. The inputs share one mock
 * focus, so its calls are told apart by the input they were made on.
 */
const focusesOf = ({
  UNSAFE_getAllByType,
}: ReturnType<typeof renderScreen>) => {
  const inputs = UNSAFE_getAllByType(TextInput).map((input) => input.instance);
  const { contexts } = (inputs[0].focus as jest.Mock).mock;
  return inputs.map(
    (input) => contexts.filter((context) => context === input).length,
  );
};

const fillPasswords = ({ getByTestId }: ReturnType<typeof renderScreen>) => {
  fireEvent.changeText(getByTestId("password-input"), "password1");
  fireEvent.changeText(getByTestId("confirm-password-input"), "password1");
};

/** Presses the button and lets the screen move on, the keyboard being down. */
const pressContinue = async ({
  getByTestId,
}: ReturnType<typeof renderScreen>) => {
  fireEvent.press(getByTestId("default-action-button"));
  await act(async () => {});
};

/**
 * Puts the keyboard up, and returns what makes it finish hiding: the
 * listener a dismissal waits on.
 */
const withKeyboardUp = () => {
  jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
  const addListener = jest.spyOn(Keyboard, "addListener");
  return async () => {
    const hidden = addListener.mock.calls
      .filter(([event]) => event === "keyboardDidHide")
      .map(([, listener]) => listener);
    act(() => {
      hidden.forEach((listener) => listener({} as never));
    });
    await act(async () => {});
  };
};

describe("ChoosePasswordScreen (Set Password)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLoginDataStore.setState({ password: null, mnemonicPhrase: null });
  });
  afterEach(() => jest.restoreAllMocks());

  describe("creating a wallet", () => {
    it("asks for the password the user will sign in with", () => {
      const { getByText } = renderScreen();

      expect(getByText("Set Password")).toBeTruthy();
      expect(
        getByText("You'll use this password to sign in to your account."),
      ).toBeTruthy();
      expect(getByText("Must be at least 8 characters long")).toBeTruthy();
    });

    it("masks both fields", () => {
      const { getByTestId } = renderScreen();

      expect(getByTestId("password-input").props.secureTextEntry).toBe(true);
      expect(getByTestId("confirm-password-input").props.secureTextEntry).toBe(
        true,
      );
    });

    // Raising the keyboard while the screen still slides in looks rushed.
    it("focuses the password once the screen has slid in", () => {
      const screen = renderScreen();
      const [passwordFocuses] = focusesOf(screen);
      expect(passwordFocuses).toBe(0);
      expect(screen.getByTestId("password-input").props.autoFocus).toBeFalsy();

      endTransition();

      expect(focusesOf(screen)).toEqual([1, 0]);
    });

    it("leaves the keyboard down when the screen slides away", () => {
      const screen = renderScreen();

      endTransition(true);

      expect(focusesOf(screen)).toEqual([0, 0]);
    });

    it("keeps Next disabled until both passwords are valid and the same", () => {
      const { getByTestId } = renderScreen();

      fireEvent.changeText(getByTestId("password-input"), "password1");
      fireEvent.press(getByTestId("default-action-button"));
      fireEvent.changeText(getByTestId("confirm-password-input"), "password2");
      fireEvent.press(getByTestId("default-action-button"));
      fireEvent.changeText(getByTestId("password-input"), "short");
      fireEvent.changeText(getByTestId("confirm-password-input"), "short");
      fireEvent.press(getByTestId("default-action-button"));

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("keeps the password in memory and shows the recovery phrase", async () => {
      const screen = renderScreen();

      fillPasswords(screen);
      await pressContinue(screen);

      expect(useLoginDataStore.getState().password).toBe("password1");
      expect(mockNavigate).toHaveBeenCalledWith(
        AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN,
      );
      expect(mockFinishWalletSetup).not.toHaveBeenCalled();
    });

    it("says the passwords don't match once the confirmation is as long as the password", () => {
      const { getByTestId, queryByText } = renderScreen();

      fireEvent.changeText(getByTestId("password-input"), "password1");
      fireEvent.changeText(getByTestId("confirm-password-input"), "passw");
      expect(queryByText(MISMATCH)).toBeNull();

      fireEvent.changeText(getByTestId("confirm-password-input"), "password2");
      expect(queryByText(MISMATCH)).toBeTruthy();

      fireEvent.changeText(getByTestId("confirm-password-input"), "password1");
      expect(queryByText(MISMATCH)).toBeNull();
    });

    it("says the passwords don't match when the confirmation runs longer", () => {
      const { getByTestId, queryByText } = renderScreen();

      fireEvent.changeText(getByTestId("password-input"), "password1");
      fireEvent.changeText(getByTestId("confirm-password-input"), "password12");

      expect(queryByText(MISMATCH)).toBeTruthy();
    });

    it("re-checks the match when the first password changes", () => {
      const { getByTestId, queryByText } = renderScreen();

      fireEvent.changeText(getByTestId("password-input"), "password1");
      fireEvent.changeText(getByTestId("confirm-password-input"), "password1");
      expect(queryByText(MISMATCH)).toBeNull();

      fireEvent.changeText(getByTestId("password-input"), "password2");
      expect(queryByText(MISMATCH)).toBeTruthy();

      fireEvent.changeText(getByTestId("password-input"), "password12");
      expect(queryByText(MISMATCH)).toBeNull();
    });

    // With the keyboard up on a small screen, the button follows the fields
    // as close as the space allows.
    it("keeps 20pt between the fields and the button below them", () => {
      const { getByTestId } = renderScreen();

      expect(getByTestId("set-password-fields").props.className).toContain(
        "pb-[20px]",
      );
    });

    it("flags a password over 2048 characters", () => {
      const { getByTestId, getByText } = renderScreen();

      fireEvent.changeText(getByTestId("password-input"), "a".repeat(2049));

      expect(getByText("Must be less than 2048 characters")).toBeTruthy();
    });
  });

  // Next is one step: it stays disabled until both fields are filled in,
  // match and show no error. The keyboard's return key moves between them.
  describe("creating a wallet, when Next is enabled", () => {
    it("keeps Next disabled with only the password filled in", () => {
      const { getByTestId, UNSAFE_getAllByType } = renderScreen();
      const confirmation = UNSAFE_getAllByType(TextInput)[1].instance;
      const focus = confirmation.focus as jest.Mock;
      focus.mockClear();

      fireEvent.changeText(getByTestId("password-input"), "password1");
      fireEvent.press(getByTestId("default-action-button"));

      expect(
        getByTestId("default-action-button").props.accessibilityState?.disabled,
      ).toBe(true);
      expect(focus).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("keeps Next disabled while the confirmation doesn't match", () => {
      const { getByTestId } = renderScreen();

      fireEvent.changeText(getByTestId("password-input"), "password1");
      fireEvent.changeText(getByTestId("confirm-password-input"), "password");

      expect(
        getByTestId("default-action-button").props.accessibilityState?.disabled,
      ).toBe(true);
    });

    it("enables Next once both passwords are filled in and match", async () => {
      const screen = renderScreen();

      fillPasswords(screen);
      expect(
        screen.getByTestId("default-action-button").props.accessibilityState
          ?.disabled,
      ).toBe(false);
      await pressContinue(screen);

      expect(mockNavigate).toHaveBeenCalledWith(
        AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN,
      );
    });

    it("moves to the confirmation from the keyboard's return key", () => {
      const { getByTestId, UNSAFE_getAllByType } = renderScreen();
      const confirmation = UNSAFE_getAllByType(TextInput)[1].instance;
      const focus = confirmation.focus as jest.Mock;
      focus.mockClear();

      fireEvent.changeText(getByTestId("password-input"), "password1");
      fireEvent(getByTestId("password-input"), "submitEditing");

      expect(focus.mock.contexts).toContain(confirmation);
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("importing a wallet", () => {
    beforeEach(() => {
      useLoginDataStore.setState({ mnemonicPhrase: "abandon ability able" });
    });

    it("focuses the password once the screen has slid in", () => {
      const screen = renderScreen(true);
      expect(focusesOf(screen)).toEqual([0, 0]);

      endTransition();

      expect(focusesOf(screen)).toEqual([1, 0]);
    });

    it("asks the user to acknowledge the phrase can't be recovered before importing", async () => {
      const screen = renderScreen(true);

      fillPasswords(screen);
      await pressContinue(screen);
      expect(mockFinishWalletSetup).not.toHaveBeenCalled();

      fireEvent.press(screen.getByTestId("import-acknowledgement-checkbox"));
      await pressContinue(screen);

      expect(useLoginDataStore.getState().password).toBe("password1");
      expect(mockFinishWalletSetup).toHaveBeenCalledWith(
        BiometricsSource.IMPORT_WALLET,
      );
    });

    // Done typing, the user sees the whole screen again, with Import wallet
    // back at the bottom.
    it("closes the keyboard when the acknowledgement is tapped", () => {
      const dismiss = jest.spyOn(Keyboard, "dismiss");
      const { getByTestId } = renderScreen(true);

      fireEvent.press(getByTestId("import-acknowledgement-checkbox"));

      expect(dismiss).toHaveBeenCalledTimes(1);
    });

    // Figma's 20pt above the acknowledgement is the fields' own padding, and
    // 16pt below it keeps the whole button above the keyboard on a 6.3"
    // iPhone.
    it("sits the acknowledgement 20pt under the fields and 16pt above the button", () => {
      const { getByTestId } = renderScreen(true);
      const { className } = getByTestId("import-acknowledgement").props;

      expect(getByTestId("set-password-fields").props.className).toContain(
        "pb-[20px]",
      );
      expect(className).not.toMatch(/\bpt-/);
      expect(className).toContain("pb-[16px]");
    });

    it("keeps the form at its full height, so a small screen can scroll to the acknowledgement", () => {
      const { getByTestId } = renderScreen(true);
      const { className } = getByTestId("set-password-form").props;

      expect(className).toContain("grow");
      expect(className).not.toContain("flex-1");
    });

    it("goes back to Import Wallet if the phrase is gone", async () => {
      useLoginDataStore.setState({ mnemonicPhrase: null });
      const screen = renderScreen(true);

      fillPasswords(screen);
      fireEvent.press(screen.getByTestId("import-acknowledgement-checkbox"));
      await pressContinue(screen);

      expect(mockGoBack).toHaveBeenCalledTimes(1);
      expect(mockFinishWalletSetup).not.toHaveBeenCalled();
    });
  });

  // Importing, the button says "Import wallet" throughout (Figma
  // ?node-id=2091-40291), and waits for matching passwords and the
  // acknowledgement.
  describe("importing a wallet, the button", () => {
    beforeEach(() => {
      useLoginDataStore.setState({ mnemonicPhrase: "abandon ability able" });
    });

    it("says Import wallet from the start, disabled while only the password is filled in", () => {
      const { getByTestId } = renderScreen(true);

      expect(
        within(getByTestId("default-action-button")).getByText("Import wallet"),
      ).toBeTruthy();
      fireEvent.changeText(getByTestId("password-input"), "password1");

      expect(
        getByTestId("default-action-button").props.accessibilityState?.disabled,
      ).toBe(true);
    });

    it("stays disabled until the acknowledgement is ticked too", () => {
      const screen = renderScreen(true);
      const isDisabled = () =>
        screen.getByTestId("default-action-button").props.accessibilityState
          ?.disabled;

      fillPasswords(screen);
      expect(isDisabled()).toBe(true);

      fireEvent.press(screen.getByTestId("import-acknowledgement-checkbox"));
      expect(isDisabled()).toBe(false);
    });

    it("stays disabled while the passwords don't match, even with the acknowledgement ticked", () => {
      const { getByTestId } = renderScreen(true);
      const isDisabled = () =>
        getByTestId("default-action-button").props.accessibilityState?.disabled;

      fireEvent.press(getByTestId("import-acknowledgement-checkbox"));
      fireEvent.changeText(getByTestId("password-input"), "password1");
      fireEvent.changeText(getByTestId("confirm-password-input"), "password2");
      expect(isDisabled()).toBe(true);

      fireEvent.changeText(getByTestId("confirm-password-input"), "password1");
      expect(isDisabled()).toBe(false);
    });

    it("says Import wallet whether or not the passwords match", () => {
      const { getByTestId } = renderScreen(true);
      const button = () => within(getByTestId("default-action-button"));

      fireEvent.changeText(getByTestId("password-input"), "password1");
      fireEvent.changeText(getByTestId("confirm-password-input"), "password");
      expect(button().getByText("Import wallet")).toBeTruthy();

      fireEvent.changeText(getByTestId("confirm-password-input"), "password1");
      expect(button().getByText("Import wallet")).toBeTruthy();

      fireEvent.changeText(getByTestId("confirm-password-input"), "password12");
      expect(button().getByText("Import wallet")).toBeTruthy();
      expect(button().queryByText("Next")).toBeNull();
    });
  });

  // The next screen comes in once the keyboard is down, rather than while
  // it's still sliding away.
  describe("leaving with the keyboard up", () => {
    beforeEach(() => {
      useLoginDataStore.setState({ mnemonicPhrase: "abandon ability able" });
    });

    it("shows the recovery phrase once the keyboard has hidden", async () => {
      const hideKeyboard = withKeyboardUp();
      const dismiss = jest.spyOn(Keyboard, "dismiss");
      const screen = renderScreen();

      fillPasswords(screen);
      await pressContinue(screen);
      expect(dismiss).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();

      await hideKeyboard();

      expect(mockNavigate).toHaveBeenCalledWith(
        AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN,
      );
    });

    it("imports once the keyboard has hidden, however often Import wallet is tapped", async () => {
      const hideKeyboard = withKeyboardUp();
      const screen = renderScreen(true);

      fillPasswords(screen);
      fireEvent.press(screen.getByTestId("import-acknowledgement-checkbox"));
      await pressContinue(screen);
      await pressContinue(screen);
      expect(mockFinishWalletSetup).not.toHaveBeenCalled();

      await hideKeyboard();

      expect(mockFinishWalletSetup).toHaveBeenCalledTimes(1);
    });
  });
});

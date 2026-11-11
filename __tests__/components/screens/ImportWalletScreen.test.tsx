import { act, fireEvent } from "@testing-library/react-native";
import { ImportWalletScreen } from "components/screens/ImportWalletScreen";
import { AUTH_STACK_ROUTES } from "config/routes";
import { useLoginDataStore } from "ducks/loginData";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Keyboard, TextInput } from "react-native";

// Runs the focus effect on mount, and lets a test run it again, as coming
// back from Set Password does.
let mockRefocus: () => void = () => {};
jest.mock("@react-navigation/native", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    useFocusEffect: (effect: () => void) => {
      mockRefocus = effect;
      useEffect(effect, [effect]);
    },
  };
});

const mockVerifyMnemonicPhrase = jest.fn();
const mockClearError = jest.fn();
let mockError: string | null = null;
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    error: mockError,
    clearError: mockClearError,
    verifyMnemonicPhrase: mockVerifyMnemonicPhrase,
  }),
}));

const PHRASE =
  "abandon ability able about above absent absorb abstract absurd abuse access accident";
const mockNavigate = jest.fn();
const mockAddListener = jest.fn<
  () => void,
  [event: string, listener: (event: { data: { closing: boolean } }) => void]
>(() => jest.fn());

const renderScreen = () =>
  renderWithProviders(
    <ImportWalletScreen
      navigation={
        { navigate: mockNavigate, addListener: mockAddListener } as never
      }
      route={{} as never}
    />,
  );

/** Ends the screen's push transition, as the navigator reports it. */
const finishSlidingIn = () => {
  const [, onTransitionEnd] =
    mockAddListener.mock.calls.find(([event]) => event === "transitionEnd") ??
    [];
  act(() => onTransitionEnd?.({ data: { closing: false } }));
};

/**
 * Lets the check run once the keyboard is down: the button's spinner
 * paints, then the phrase is checked and the screen moves on.
 */
const finishCheck = async () => {
  await act(async () => {});
  act(() => {
    jest.runAllTimers();
  });
  await act(async () => {});
};

/** Presses Next and lets the check run and the screen move on. */
const pressNext = async ({ getByTestId }: ReturnType<typeof renderScreen>) => {
  fireEvent.press(getByTestId("default-action-button"));
  await finishCheck();
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

describe("ImportWalletScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockError = null;
    useLoginDataStore.setState({ password: null, mnemonicPhrase: null });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("asks for the phrase with one description and Paste inside the field", () => {
    const { getByText, getByPlaceholderText, getByTestId, queryByText } =
      renderScreen();

    expect(getByText("Import Wallet")).toBeTruthy();
    expect(
      getByText("Import your wallet with the 12 or 24-word recovery phrase"),
    ).toBeTruthy();
    expect(getByPlaceholderText("Enter your recovery phrase")).toBeTruthy();
    expect(getByTestId("clipboard-button")).toBeTruthy();
    expect(queryByText("Paste from clipboard")).toBeNull();
    expect(queryByText("Phrases are usually 12 or 24 words")).toBeNull();
  });

  // Raising the keyboard while the screen is still sliding in glitches, so
  // the field waits for the screen to settle.
  it("focuses the phrase field once the screen has slid in", () => {
    const screen = renderScreen();
    const input = screen.UNSAFE_getByType(TextInput).instance;
    const focus = input.focus as jest.Mock;
    focus.mockClear();

    expect(
      screen.getByTestId("import-wallet-input").props.autoFocus,
    ).toBeFalsy();
    expect(focus).not.toHaveBeenCalled();

    finishSlidingIn();

    expect(focus.mock.contexts).toContain(input);
  });

  // With the keyboard up on a small screen, Next follows the field as close
  // as the space allows.
  it("keeps 20pt between the field and Next", () => {
    const { getByTestId } = renderScreen();

    expect(getByTestId("import-wallet-input-field").props.className).toContain(
      "pb-[20px]",
    );
  });

  it("keeps Next disabled until a phrase is entered", async () => {
    const screen = renderScreen();

    await pressNext(screen);

    expect(mockVerifyMnemonicPhrase).not.toHaveBeenCalled();
  });

  it("keeps a valid phrase in memory and asks for a password", async () => {
    mockVerifyMnemonicPhrase.mockReturnValue(true);
    const screen = renderScreen();

    fireEvent.changeText(screen.getByTestId("import-wallet-input"), PHRASE);
    await pressNext(screen);

    expect(mockVerifyMnemonicPhrase).toHaveBeenCalledWith(PHRASE);
    expect(useLoginDataStore.getState().mnemonicPhrase).toBe(PHRASE);
    expect(mockNavigate).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN,
      { isImporting: true },
    );
  });

  it("drops a space typed after the last word", async () => {
    mockVerifyMnemonicPhrase.mockReturnValue(true);
    const screen = renderScreen();
    const input = () => screen.getByTestId("import-wallet-input");

    fireEvent.changeText(input(), PHRASE);
    // One keystroke more, as typing word by word leaves it; the field shows
    // dots, so the user can't see it.
    fireEvent.changeText(input(), `${input().props.value} `);
    await pressNext(screen);

    expect(mockVerifyMnemonicPhrase).toHaveBeenCalledWith(PHRASE);
    expect(useLoginDataStore.getState().mnemonicPhrase).toBe(PHRASE);
  });

  it("stays put on an invalid phrase", async () => {
    mockVerifyMnemonicPhrase.mockReturnValue(false);
    const screen = renderScreen();

    fireEvent.changeText(screen.getByTestId("import-wallet-input"), PHRASE);
    await pressNext(screen);

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(useLoginDataStore.getState().mnemonicPhrase).toBeNull();
  });

  it("shows the store's error under the field", () => {
    mockError = "Invalid recovery phrase";
    const { getByText } = renderScreen();

    expect(getByText("Invalid recovery phrase")).toBeTruthy();
  });

  it("clears the error as soon as the phrase changes", () => {
    mockError = "Invalid recovery phrase";
    const screen = renderScreen();
    // Coming into view clears it once; only the edit counts here.
    mockClearError.mockClear();

    fireEvent.changeText(screen.getByTestId("import-wallet-input"), PHRASE);

    expect(mockClearError).toHaveBeenCalledTimes(1);
  });

  it("starts over whenever it comes back into view", async () => {
    mockVerifyMnemonicPhrase.mockReturnValue(true);
    const screen = renderScreen();
    fireEvent.changeText(screen.getByTestId("import-wallet-input"), PHRASE);
    await pressNext(screen);
    expect(useLoginDataStore.getState().mnemonicPhrase).toBe(PHRASE);

    act(() => {
      mockRefocus();
    });

    expect(useLoginDataStore.getState().mnemonicPhrase).toBeNull();
    expect(screen.getByTestId("clipboard-button")).toBeTruthy();
    expect(mockClearError).toHaveBeenCalled();
  });

  // Set Password comes in once the keyboard is down. Arriving with it still
  // up left the acknowledgement and the button under it.
  describe("leaving with the keyboard up", () => {
    beforeEach(() => {
      mockVerifyMnemonicPhrase.mockReturnValue(true);
    });

    // The keyboard goes as soon as Next is tapped, so the button has
    // settled at the bottom before its spinner shows and the check runs.
    it("closes the keyboard at once, then checks the phrase with the button at the bottom", async () => {
      const hideKeyboard = withKeyboardUp();
      const dismiss = jest.spyOn(Keyboard, "dismiss");
      const screen = renderScreen();
      const spinner = () => screen.queryByTestId("button-loading-indicator");

      fireEvent.changeText(screen.getByTestId("import-wallet-input"), PHRASE);
      await pressNext(screen);
      expect(dismiss).toHaveBeenCalled();
      expect(spinner()).toBeNull();
      expect(mockVerifyMnemonicPhrase).not.toHaveBeenCalled();

      await hideKeyboard();
      expect(spinner()).not.toBeNull();

      await finishCheck();
      expect(mockVerifyMnemonicPhrase).toHaveBeenCalledWith(PHRASE);
      expect(mockNavigate).toHaveBeenCalledWith(
        AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN,
        { isImporting: true },
      );
    });

    it("moves on once, however often Next is tapped while it hides", async () => {
      const hideKeyboard = withKeyboardUp();
      const screen = renderScreen();

      fireEvent.changeText(screen.getByTestId("import-wallet-input"), PHRASE);
      await pressNext(screen);
      await pressNext(screen);
      await hideKeyboard();
      await finishCheck();

      expect(mockVerifyMnemonicPhrase).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });
});

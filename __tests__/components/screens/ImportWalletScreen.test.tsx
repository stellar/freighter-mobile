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

// A valid 12-word phrase, and a secret key that isn't one.
const PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const SECRET_KEY = "SBUV3MRWKNS6AYKZ6E6MOUVF2OYMON3MIUASWL3JLY5E3ISDJFELYBRZ";
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

/** Lets a pending keyboard dismissal and the move on settle. */
const settle = async () => {
  await act(async () => {});
  act(() => {
    jest.runAllTimers();
  });
  await act(async () => {});
};

/** Presses Next and lets the screen move on. */
const pressNext = async ({ getByTestId }: ReturnType<typeof renderScreen>) => {
  fireEvent.press(getByTestId("default-action-button"));
  await settle();
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
    useLoginDataStore.setState({
      password: null,
      mnemonicPhrase: null,
      secretKey: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("asks for a phrase or secret key with one description and Paste inside the field", () => {
    const { getByText, getByPlaceholderText, getByTestId, queryByText } =
      renderScreen();

    expect(getByText("Import Wallet")).toBeTruthy();
    expect(
      getByText("Import your wallet using a recovery phrase or secret key"),
    ).toBeTruthy();
    expect(
      getByPlaceholderText("Enter your recovery phrase or secret key"),
    ).toBeTruthy();
    expect(getByTestId("clipboard-button")).toBeTruthy();
    expect(queryByText("Paste from clipboard")).toBeNull();
  });

  // Raising the keyboard while the screen is still sliding in glitches, so
  // the field waits for the screen to settle.
  it("focuses the field once the screen has slid in", () => {
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

  it("keeps Next disabled until something is entered", async () => {
    const screen = renderScreen();

    await pressNext(screen);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps a valid phrase in memory and asks for a password", async () => {
    const screen = renderScreen();

    fireEvent.changeText(screen.getByTestId("import-wallet-input"), PHRASE);
    await pressNext(screen);

    expect(useLoginDataStore.getState().mnemonicPhrase).toBe(PHRASE);
    expect(useLoginDataStore.getState().secretKey).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN,
      { isImporting: true },
    );
  });

  it("keeps a valid secret key in memory, case intact, and asks for a password", async () => {
    const screen = renderScreen();

    fireEvent.changeText(screen.getByTestId("import-wallet-input"), SECRET_KEY);
    await pressNext(screen);

    expect(useLoginDataStore.getState().secretKey).toBe(SECRET_KEY);
    expect(useLoginDataStore.getState().mnemonicPhrase).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN,
      { isImporting: true },
    );
  });

  it("lowercases a phrase typed with capitals before keeping it", async () => {
    const screen = renderScreen();

    fireEvent.changeText(
      screen.getByTestId("import-wallet-input"),
      PHRASE.toUpperCase(),
    );
    await pressNext(screen);

    expect(useLoginDataStore.getState().mnemonicPhrase).toBe(PHRASE);
  });

  it("drops a space typed after the last word", async () => {
    const screen = renderScreen();
    const input = () => screen.getByTestId("import-wallet-input");

    fireEvent.changeText(input(), PHRASE);
    // One keystroke more, as typing word by word leaves it; the field shows
    // dots, so the user can't see it.
    fireEvent.changeText(input(), `${input().props.value} `);
    await pressNext(screen);

    expect(useLoginDataStore.getState().mnemonicPhrase).toBe(PHRASE);
  });

  it.each([
    ["a phrase with a bad checksum", PHRASE.replace(/about$/, "abandon")],
    ["a secret key with a bad checksum", `${SECRET_KEY.slice(0, -1)}A`],
    ["something else", "hello"],
  ])("stays put with an error on %s", async (_label, text) => {
    const screen = renderScreen();

    fireEvent.changeText(screen.getByTestId("import-wallet-input"), text);
    await pressNext(screen);

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(useLoginDataStore.getState().mnemonicPhrase).toBeNull();
    expect(useLoginDataStore.getState().secretKey).toBeNull();
    expect(
      screen.getByText("Enter a valid recovery phrase or secret key"),
    ).toBeTruthy();
  });

  it("clears the error as soon as the text changes", async () => {
    const screen = renderScreen();
    const input = () => screen.getByTestId("import-wallet-input");
    fireEvent.changeText(input(), "hello");
    await pressNext(screen);
    const error = "Enter a valid recovery phrase or secret key";
    expect(screen.getByText(error)).toBeTruthy();

    fireEvent.changeText(input(), "hello there");

    expect(screen.queryByText(error)).toBeNull();
  });

  it("starts over whenever it comes back into view", async () => {
    const screen = renderScreen();
    fireEvent.changeText(screen.getByTestId("import-wallet-input"), SECRET_KEY);
    await pressNext(screen);
    expect(useLoginDataStore.getState().secretKey).toBe(SECRET_KEY);

    act(() => {
      mockRefocus();
    });

    expect(useLoginDataStore.getState().secretKey).toBeNull();
    expect(useLoginDataStore.getState().mnemonicPhrase).toBeNull();
    expect(screen.getByTestId("clipboard-button")).toBeTruthy();
  });

  // Set Password comes in once the keyboard is down. Arriving with it still
  // up left the acknowledgement and the button under it.
  describe("leaving with the keyboard up", () => {
    it("closes the keyboard, then asks for a password", async () => {
      const hideKeyboard = withKeyboardUp();
      const dismiss = jest.spyOn(Keyboard, "dismiss");
      const screen = renderScreen();

      fireEvent.changeText(screen.getByTestId("import-wallet-input"), PHRASE);
      await pressNext(screen);
      expect(dismiss).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();

      await hideKeyboard();
      await settle();
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
      await settle();

      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });
});

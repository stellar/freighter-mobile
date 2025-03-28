import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { userEvent, screen, act, waitFor } from "@testing-library/react-native";
import { ValidateRecoveryPhraseScreen } from "components/screens/ValidateRecoveryPhraseScreen";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock the useWordSelection hook to always return the first three words
jest.mock("hooks/useWordSelection", () => ({
  useWordSelection: (recoveryPhrase: string) => {
    const words = recoveryPhrase.split(" ");
    return {
      words,
      selectedIndices: [0, 1, 2], // Always select first three words
    };
  },
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string, params?: { number?: number }) => {
    const translations: Record<string, string> = {
      "validateRecoveryPhraseScreen.title": `Enter word #${params?.number || 1}`,
      "validateRecoveryPhraseScreen.inputPlaceholder": "Type the correct word",
      "validateRecoveryPhraseScreen.defaultActionButtonText": "Continue",
      "validateRecoveryPhraseScreen.errorText":
        "Incorrect word. Please try again.",
    };
    return translations[key] || key;
  },
}));

const DELAY_MS = 500;
const mockSignUp = jest.fn();
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({
    signUp: mockSignUp,
    error: null,
    isLoading: false,
  })),
}));

const mockRoute = {
  params: {
    password: "test-password",
    recoveryPhrase:
      "test phrase one two three four five six seven eight nine ten eleven twelve",
  },
};

const user = userEvent.setup();

type ValidateRecoveryPhraseScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN
>;

type ValidateRecoveryPhraseScreenRouteProp = RouteProp<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN
>;

const renderScreen = () =>
  renderWithProviders(
    <ValidateRecoveryPhraseScreen
      navigation={{} as ValidateRecoveryPhraseScreenNavigationProp}
      route={mockRoute as unknown as ValidateRecoveryPhraseScreenRouteProp}
    />,
  );

describe("ValidateRecoveryPhraseScreen", () => {
  const words = mockRoute.params.recoveryPhrase.split(" ");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ legacyFakeTimers: false });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders correctly with initial state", () => {
    renderScreen();

    expect(screen.getByText(/enter word #1/i)).toBeTruthy();
    expect(screen.getByPlaceholderText("Type the correct word")).toBeTruthy();
    expect(screen.getByTestId("default-action-button")).toBeTruthy();
  });

  it("proceeds to next word when correct word is entered", async () => {
    renderScreen();

    const input = screen.getByPlaceholderText("Type the correct word");
    const continueButton = screen.getByTestId("default-action-button");

    await user.type(input, words[0]);
    await user.press(continueButton);

    act(() => {
      jest.advanceTimersByTime(DELAY_MS);
    });

    await waitFor(() => {
      expect(screen.getByText(/enter word #2/i)).toBeTruthy();
    });
  }, 10000);

  it("completes validation flow with all 3 correct words and calls signUp", async () => {
    renderScreen();

    // First word
    let input = screen.getByPlaceholderText("Type the correct word");
    let button = screen.getByTestId("default-action-button");
    await user.type(input, words[0]);
    await user.press(button);

    act(() => jest.advanceTimersByTime(DELAY_MS));
    await waitFor(() => {
      expect(screen.getByText(/enter word #2/i)).toBeTruthy();
    });

    // Second word
    input = screen.getByPlaceholderText("Type the correct word");
    button = screen.getByTestId("default-action-button");
    await user.type(input, words[1]);
    await user.press(button);

    act(() => jest.advanceTimersByTime(DELAY_MS));
    await waitFor(() => {
      expect(screen.getByText(/enter word #3/i)).toBeTruthy();
    });

    // Third word
    input = screen.getByPlaceholderText("Type the correct word");
    button = screen.getByTestId("default-action-button");
    await user.type(input, words[2]);
    await user.press(button);

    act(() => jest.advanceTimersByTime(DELAY_MS));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        password: "test-password",
        mnemonicPhrase: mockRoute.params.recoveryPhrase,
      });
    });
  }, 15000);

  it("shows error when incorrect word is entered", async () => {
    renderScreen();

    const input = screen.getByPlaceholderText("Type the correct word");
    const continueButton = screen.getByTestId("default-action-button");

    await user.type(input, "wrongword");
    await user.press(continueButton);

    await waitFor(() => {
      expect(
        screen.getByText("Incorrect word. Please try again."),
      ).toBeTruthy();
    });
  });

  it("clears error when user starts typing", async () => {
    renderScreen();

    const input = screen.getByPlaceholderText("Type the correct word");
    const continueButton = screen.getByTestId("default-action-button");

    await user.type(input, "wrongword");
    await user.press(continueButton);

    await waitFor(() => {
      expect(
        screen.getByText("Incorrect word. Please try again."),
      ).toBeTruthy();
    });

    await user.type(input, "a");

    await waitFor(() => {
      expect(
        screen.queryByText("Incorrect word. Please try again."),
      ).toBeNull();
    });
  });

  it("disables continue button when input is empty", async () => {
    renderScreen();

    const continueButton = screen.getByTestId("default-action-button");
    expect(continueButton.props.accessibilityState.disabled).toBeTruthy();

    const input = screen.getByPlaceholderText("Type the correct word");
    await user.type(input, "one");

    await waitFor(() => {
      expect(continueButton.props.accessibilityState.disabled).toBeFalsy();
    });
  });
});

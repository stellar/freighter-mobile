import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { userEvent, screen, act } from "@testing-library/react-native";
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
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders correctly with initial state", () => {
    renderScreen();

    expect(screen.getByText(/enter word #/i)).toBeTruthy();
    expect(screen.getByPlaceholderText("Type the correct word")).toBeTruthy();
    expect(screen.getByTestId("default-action-button")).toBeTruthy();
  });

  it("proceeds to next word when correct word is entered", async () => {
    renderScreen();

    expect(screen.getByText(/enter word #1/i)).toBeTruthy();

    const input = screen.getByPlaceholderText("Type the correct word");
    const continueButton = screen.getByTestId("default-action-button");

    await user.type(input, words[0]);
    await user.press(continueButton);

    // Wait for loading indicator
    await screen.findByTestId("button-loading-indicator");

    // Run timers and wait for next screen
    act(() => {
      jest.runAllTimers();
    });

    await screen.findByText(/enter word #2/i);
  }, 10000);

  it("completes validation flow with all 3 correct words and calls signUp", async () => {
    const selectedWords = [words[0], words[1], words[2]];
    renderScreen();

    expect(screen.getByText(/enter word #1/i)).toBeTruthy();

    // First word
    const firstInput = screen.getByPlaceholderText("Type the correct word");
    const firstButton = screen.getByTestId("default-action-button");
    await user.type(firstInput, selectedWords[0]);
    await user.press(firstButton);
    await screen.findByTestId("button-loading-indicator");

    act(() => {
      jest.runAllTimers();
    });

    await screen.findByText(/enter word #2/i);

    // Second word
    const secondInput = screen.getByPlaceholderText("Type the correct word");
    const secondButton = screen.getByTestId("default-action-button");
    await user.type(secondInput, selectedWords[1]);
    await user.press(secondButton);
    await screen.findByTestId("button-loading-indicator");

    act(() => {
      jest.runAllTimers();
    });

    await screen.findByText(/enter word #3/i);

    // Third word
    const thirdInput = screen.getByPlaceholderText("Type the correct word");
    const thirdButton = screen.getByTestId("default-action-button");
    await user.type(thirdInput, selectedWords[2]);
    await user.press(thirdButton);
    await screen.findByTestId("button-loading-indicator");

    act(() => {
      jest.runAllTimers();
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      password: "test-password",
      mnemonicPhrase: mockRoute.params.recoveryPhrase,
    });
  }, 15000);

  it("shows error when incorrect word is entered", async () => {
    renderScreen();

    const input = screen.getByPlaceholderText("Type the correct word");
    const continueButton = screen.getByTestId("default-action-button");

    await user.type(input, "wrongword");
    await user.press(continueButton);
    expect(screen.getByText("Incorrect word. Please try again.")).toBeTruthy();
  });

  it("clears error when user starts typing", async () => {
    renderScreen();

    const input = screen.getByPlaceholderText("Type the correct word");
    const continueButton = screen.getByTestId("default-action-button");

    await user.type(input, "wrongword");
    await user.press(continueButton);
    expect(screen.getByText("Incorrect word. Please try again.")).toBeTruthy();

    await user.type(input, "a");
    expect(screen.queryByText("Incorrect word. Please try again.")).toBeNull();
  });

  it("disables continue button when input is empty", async () => {
    renderScreen();

    const continueButton = screen.getByTestId("default-action-button");
    expect(continueButton.props.accessibilityState.disabled).toBeTruthy();

    const input = screen.getByPlaceholderText("Type the correct word");
    await user.type(input, "one");
    expect(continueButton.props.accessibilityState.disabled).toBeFalsy();
  });
});

import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { userEvent, screen, waitFor } from "@testing-library/react-native";
import { ValidateRecoveryPhraseScreen } from "components/screens/ValidateRecoveryPhraseScreen";
import type { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock InteractionManager to execute callbacks immediately
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.InteractionManager.runAfterInteractions = jest.fn((callback) => {
    callback();
    return { cancel: jest.fn() };
  });
  return rn;
});

// Mock the useWordSelection hook for deterministic options
jest.mock("hooks/useWordSelection", () => {
  const cache = new Map<
    string,
    {
      words: string[];
      selectedIndexes: number[];
      generateWordOptionsForRound: (roundIndex: number) => string[];
    }
  >();

  return {
    useWordSelection: (recoveryPhrase: string) => {
      const cached = cache.get(recoveryPhrase);

      if (cached) return cached;

      const words = recoveryPhrase.split(" ");
      const selectedIndexes = [0, 1, 2];
      const generateWordOptionsForRound = (roundIndex: number) => {
        const correctWord = words[selectedIndexes[roundIndex]];
        return [correctWord, "decoyA", "decoyB"];
      };
      const value = { words, selectedIndexes, generateWordOptionsForRound };

      cache.set(recoveryPhrase, value);

      return value;
    },
  };
});

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
let mockIsLoading = false;
let mockError: string | null = null;

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn((selector) => {
    if (typeof selector === "function") {
      return selector({
        signUp: mockSignUp,
        error: mockError,
        isLoading: mockIsLoading,
      });
    }
    return {
      signUp: mockSignUp,
      error: mockError,
      isLoading: mockIsLoading,
    };
  }),
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
      navigation={
        {
          setOptions: jest.fn(),
          goBack: jest.fn(),
        } as unknown as ValidateRecoveryPhraseScreenNavigationProp
      }
      route={mockRoute as unknown as ValidateRecoveryPhraseScreenRouteProp}
    />,
  );

describe("ValidateRecoveryPhraseScreen", () => {
  const words = mockRoute.params.recoveryPhrase.split(" ");

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoading = false;
    mockError = null;
  });

  it("renders correctly with initial state", () => {
    renderScreen();

    expect(screen.getByText(/enter word #1/i)).toBeTruthy();
    expect(screen.getByTestId(`word-bubble-${words[0]}`)).toBeTruthy();
    expect(screen.getByTestId("default-action-button")).toBeTruthy();
  });

  it("proceeds to next word when correct word is selected", async () => {
    renderScreen();

    const continueButton = screen.getByTestId("default-action-button");

    await user.press(screen.getByTestId(`word-bubble-${words[0]}`));
    await user.press(continueButton);

    await waitFor(() => {
      expect(screen.getByText(/enter word #2/i)).toBeTruthy();
    });
  }, 30000);

  it("completes validation flow with all 3 correct selections and calls signUp", async () => {
    renderScreen();

    // First word
    let button = screen.getByTestId("default-action-button");
    await user.press(screen.getByTestId(`word-bubble-${words[0]}`));
    await user.press(button);

    await waitFor(() => {
      expect(screen.getByText(/enter word #2/i)).toBeTruthy();
    });

    // Second word
    button = screen.getByTestId("default-action-button");
    await user.press(screen.getByTestId(`word-bubble-${words[1]}`));
    await user.press(button);

    await waitFor(() => {
      expect(screen.getByText(/enter word #3/i)).toBeTruthy();
    });

    // Third word
    button = screen.getByTestId("default-action-button");
    await user.press(screen.getByTestId(`word-bubble-${words[2]}`));
    await user.press(button);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        password: "test-password",
        mnemonicPhrase: mockRoute.params.recoveryPhrase,
      });
    });
  }, 30000);

  it("shows error when incorrect word is selected", async () => {
    renderScreen();

    const continueButton = screen.getByTestId("default-action-button");

    // pick a decoy instead of the correct word
    await user.press(screen.getByTestId("word-bubble-decoyA"));
    await user.press(continueButton);

    await waitFor(() => {
      expect(
        screen.getByText("Incorrect word. Please try again."),
      ).toBeTruthy();
    });
  });
});

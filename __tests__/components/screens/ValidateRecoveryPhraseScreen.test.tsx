import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { userEvent, screen, waitFor } from "@testing-library/react-native";
import { ValidateRecoveryPhraseScreen } from "components/screens/ValidateRecoveryPhraseScreen";
import { AUTH_STACK_ROUTES } from "config/routes";
import type { AuthStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React, { act } from "react";

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

// Mock the useBiometrics hook
jest.mock("hooks/useBiometrics", () => ({
  useBiometrics: () => ({
    biometryType: null,
    setIsBiometricsEnabled: jest.fn(),
    isBiometricsEnabled: false,
    enableBiometrics: jest.fn(() => Promise.resolve(true)),
    disableBiometrics: jest.fn(() => Promise.resolve(true)),
    checkBiometrics: jest.fn(() => Promise.resolve(null)),
    handleEnableBiometrics: jest.fn(() => Promise.resolve(true)),
    handleDisableBiometrics: jest.fn(() => Promise.resolve(true)),
    verifyBiometrics: jest.fn(() => Promise.resolve(true)),
    getButtonIcon: jest.fn(() => null),
    getButtonText: jest.fn(() => ""),
    getButtonColor: jest.fn(() => "#000000"),
  }),
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string, params?: { number?: number }) => {
    const translations: Record<string, string> = {
      "validateRecoveryPhraseScreen.title": `Enter word #${params?.number || 1}`,
      "validateRecoveryPhraseScreen.defaultActionButtonText": "Continue",
      "validateRecoveryPhraseScreen.errorText":
        "Incorrect word. Please try again.",
    };
    return translations[key] || key;
  },
}));

const mockSignUp = jest.fn(() => Promise.resolve());
let mockIsLoading = false;
let mockError: string | null = null;

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn((selector) => {
    if (typeof selector === "function") {
      return selector({
        signUp: mockSignUp,
        error: mockError,
        isLoading: mockIsLoading,
        setSignInMethod: jest.fn(),
        storeBiometricPassword: jest.fn(() => Promise.resolve()),
      });
    }
    return {
      signUp: mockSignUp,
      error: mockError,
      isLoading: mockIsLoading,
      setSignInMethod: jest.fn(),
      storeBiometricPassword: jest.fn(() => Promise.resolve()),
    };
  }),
  getLoginType: jest.fn((biometryType) => {
    if (!biometryType) return "password";
    if (biometryType === "FaceID" || biometryType === "Face") return "face";
    if (biometryType === "TouchID" || biometryType === "Fingerprint")
      return "fingerprint";
    return "password";
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

const mockNavigation = {
  setOptions: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
  push: jest.fn(),
  pop: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  getId: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  dispatch: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  setParams: jest.fn(),
};

const renderScreen = () =>
  renderWithProviders(
    <ValidateRecoveryPhraseScreen
      navigation={
        mockNavigation as unknown as ValidateRecoveryPhraseScreenNavigationProp
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

  it("completes validation flow with all 3 correct words and navigates to biometrics when available", async () => {
    // Mock useBiometrics to return a biometryType for this test
    const useBiometricsModule = jest.requireMock("hooks/useBiometrics");
    useBiometricsModule.useBiometrics = jest.fn(() => ({
      biometryType: "FaceID",
      setIsBiometricsEnabled: jest.fn(),
      isBiometricsEnabled: false,
      enableBiometrics: jest.fn(() => Promise.resolve(true)),
      disableBiometrics: jest.fn(() => Promise.resolve(true)),
      checkBiometrics: jest.fn(() => Promise.resolve("FaceID")),
      handleEnableBiometrics: jest.fn(() => Promise.resolve(true)),
      handleDisableBiometrics: jest.fn(() => Promise.resolve(true)),
      verifyBiometrics: jest.fn(() => Promise.resolve(true)),
      getButtonIcon: jest.fn(() => null),
      getButtonText: jest.fn(() => ""),
      getButtonColor: jest.fn(() => "#000000"),
    }));

    renderScreen();

    // First word
    let button = screen.getByTestId("default-action-button");
    await user.press(screen.getByTestId(`word-bubble-${words[0]}`));
    await user.press(button);

    // Run all timers
    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(screen.getByText(/enter word #2/i)).toBeTruthy();
    });

    // Second word
    button = screen.getByTestId("default-action-button");
    await user.press(screen.getByTestId(`word-bubble-${words[1]}`));
    await user.press(button);

    // Run all timers
    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(screen.getByText(/enter word #3/i)).toBeTruthy();
    });

    // Third word
    button = screen.getByTestId("default-action-button");
    await user.press(screen.getByTestId(`word-bubble-${words[2]}`));
    await user.press(button);

    // Run all timers
    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN,
        {
          password: "test-password",
          mnemonicPhrase: mockRoute.params.recoveryPhrase,
        },
      );
    });

    // Verify signUp was NOT called since we navigated to biometrics instead
    expect(mockSignUp).not.toHaveBeenCalled();
  }, 30000);

  it("shows error when incorrect word is entered", async () => {
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

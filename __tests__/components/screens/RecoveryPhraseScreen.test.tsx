import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fireEvent, render } from "@testing-library/react-native";
import { RecoveryPhraseScreen } from "components/screens/RecoveryPhraseScreen";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import React from "react";
import StellarHDWallet from "stellar-hd-wallet";

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
  }),
}));

jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("stellar-hd-wallet", () => ({
  generateMnemonic: jest.fn(
    () =>
      "test phrase one two three four five six seven eight nine ten eleven twelve",
  ),
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "recoveryPhraseScreen.title": "Recovery Phrase",
      "recoveryPhraseScreen.warning":
        "Write down these words in order and store them in a safe place",
      "recoveryPhraseScreen.defaultActionButtonText": "Continue",
      "recoveryPhraseScreen.footerNoteText": "Keep your recovery phrase safe",
      "recoveryPhraseScreen.copyButtonText": "Copy",
      "onboarding.skip": "Skip",
      "onboarding.continue": "Continue",
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

const mockNavigation = {
  navigate: jest.fn(),
};

const mockRoute = {
  params: {
    password: "test-password",
  },
};

type RecoveryPhraseScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN
>;

type RecoveryPhraseScreenRouteProp = RouteProp<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN
>;

describe("RecoveryPhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders correctly", () => {
    const { getByText, queryByText } = render(
      <RecoveryPhraseScreen
        navigation={
          mockNavigation as unknown as RecoveryPhraseScreenNavigationProp
        }
        route={mockRoute as unknown as RecoveryPhraseScreenRouteProp}
      />,
    );

    expect(getByText("Recovery Phrase")).toBeTruthy();
    expect(
      getByText(
        "Write down these words in order and store them in a safe place",
      ),
    ).toBeTruthy();
    expect(getByText("Continue")).toBeTruthy();
    expect(getByText("Copy")).toBeTruthy();

    expect(
      getByText(
        "test phrase one two three four five six seven eight nine ten eleven twelve",
      ),
    ).toBeTruthy();

    expect(queryByText("Error message")).toBeNull();
  });

  it("handles clipboard copy when copy button is pressed", () => {
    const { getByText } = render(
      <RecoveryPhraseScreen
        navigation={
          mockNavigation as unknown as RecoveryPhraseScreenNavigationProp
        }
        route={mockRoute as unknown as RecoveryPhraseScreenRouteProp}
      />,
    );

    fireEvent.press(getByText("Copy"));

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      "test phrase one two three four five six seven eight nine ten eleven twelve",
    );
  });

  it("should not call signUp if there is no recovery phrase", () => {
    (StellarHDWallet.generateMnemonic as jest.Mock).mockReturnValueOnce("");

    const { getByText } = render(
      <RecoveryPhraseScreen
        navigation={
          mockNavigation as unknown as RecoveryPhraseScreenNavigationProp
        }
        route={mockRoute as unknown as RecoveryPhraseScreenRouteProp}
      />,
    );

    const skipButton = getByText("Skip");
    fireEvent.press(skipButton);

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it("navigates to validate recovery phrase screen when continue is pressed", () => {
    const mockNavigate = jest.fn();
    const { getByText } = render(
      <RecoveryPhraseScreen
        navigation={{ navigate: mockNavigate } as never}
        route={mockRoute as unknown as RecoveryPhraseScreenRouteProp}
      />,
    );

    fireEvent.press(getByText("Continue"));

    jest.runAllTimers();

    expect(mockNavigate).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN,
      {
        password: "test-password",
        recoveryPhrase:
          "test phrase one two three four five six seven eight nine ten eleven twelve",
      },
    );
  });

  it("disables the continue and skip buttons when loading", () => {
    jest
      .requireMock("ducks/auth")
      .useAuthenticationStore.mockImplementation(() => ({
        signUp: mockSignUp,
        error: null,
        isLoading: true,
      }));

    const { getByTestId } = render(
      <RecoveryPhraseScreen
        navigation={
          mockNavigation as unknown as RecoveryPhraseScreenNavigationProp
        }
        route={mockRoute as unknown as RecoveryPhraseScreenRouteProp}
      />,
    );

    const continueButton = getByTestId("continue-button");
    const skipButton = getByTestId("skip-button");
    expect(continueButton).toBeTruthy();
    expect(continueButton.props.accessibilityState.disabled).toBeTruthy();
    expect(skipButton).toBeTruthy();
    expect(skipButton.props.accessibilityState.disabled).toBeTruthy();
  });

  it("renders error message when there is an error", () => {
    jest
      .requireMock("ducks/auth")
      .useAuthenticationStore.mockImplementation(() => ({
        signUp: mockSignUp,
        error: "Test error message",
        isLoading: false,
      }));

    const { getByText, queryByText } = render(
      <RecoveryPhraseScreen
        navigation={
          mockNavigation as unknown as RecoveryPhraseScreenNavigationProp
        }
        route={mockRoute as unknown as RecoveryPhraseScreenRouteProp}
      />,
    );

    expect(getByText("Test error message")).toBeTruthy();

    expect(
      queryByText(
        "test phrase one two three four five six seven eight nine ten eleven twelve",
      ),
    ).toBeNull();
  });
});

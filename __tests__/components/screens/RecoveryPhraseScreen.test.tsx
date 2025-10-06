import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fireEvent, render } from "@testing-library/react-native";
import { RecoveryPhraseScreen } from "components/screens/RecoveryPhraseScreen";
import {
  AUTH_STACK_ROUTES,
  AuthStackParamList,
  RootStackParamList,
} from "config/routes";
import React from "react";
import StellarHDWallet from "stellar-hd-wallet";

// Mock the RecoveryPhraseSkipBottomSheet component
jest.mock(
  "components/screens/RecoveryPhraseSkipBottomSheet",
  () =>
    function MockRecoveryPhraseSkipBottomSheet() {
      return null;
    },
);

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useSecureClipboard", () => ({
  useSecureClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
    getClipboardText: jest.fn(),
    clearClipboard: jest.fn(),
  }),
}));

jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

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
      "onboarding.doThisLaterButtonText": "Do this later",
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
    setSignInMethod: jest.fn(),
  })),
  getLoginType: jest.fn((biometryType) => {
    if (!biometryType) return "password";
    if (biometryType === "FaceID" || biometryType === "Face") return "face";
    if (biometryType === "TouchID" || biometryType === "Fingerprint")
      return "fingerprint";
    return "password";
  }),
}));

const mockSetMnemonicPhrase = jest.fn();
const mockSetPassword = jest.fn();
jest.mock("ducks/loginData", () => ({
  useLoginDataStore: jest.fn(() => ({
    password: "test-password",
    mnemonicPhrase: null,
    setMnemonicPhrase: mockSetMnemonicPhrase,
    setPassword: mockSetPassword,
    clearMnemonicPhrase: jest.fn(),
    clearPassword: jest.fn(),
    clearAll: jest.fn(),
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
  AuthStackParamList & RootStackParamList,
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

    const skipButton = getByText("Do this later");
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

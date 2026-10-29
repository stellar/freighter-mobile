import { act, fireEvent, waitFor, within } from "@testing-library/react-native";
import { BiometricsOnboardingScreen } from "components/screens/BiometricsEnableScreen/BiometricsEnableScreen";
import { BiometricsSource } from "config/constants";
import { useWalletSetupOverlayStore } from "ducks/walletSetupOverlay";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { BIOMETRY_TYPE } from "react-native-keychain";

jest.mock("@react-native-community/blur", () => ({ BlurView: "BlurView" }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: { setItem: jest.fn(() => Promise.resolve()) },
}));

const mockSignUp = jest.fn();
const mockImportWallet = jest.fn();
const mockEnableBiometrics = jest.fn();
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    isLoading: false,
    signUp: mockSignUp,
    importWallet: mockImportWallet,
    enableBiometrics: mockEnableBiometrics,
  }),
}));

const mockClearLoginData = jest.fn();
jest.mock("ducks/loginData", () => ({
  useLoginDataStore: () => ({
    mnemonicPhrase: "abandon ability able",
    password: "password1",
    clearLoginData: mockClearLoginData,
  }),
}));

const mockNotifySetupFailed = jest.fn();
jest.mock("hooks/useSetupFailedToast", () => ({
  useSetupFailedToast: () => mockNotifySetupFailed,
}));

let mockBiometryType: BIOMETRY_TYPE = BIOMETRY_TYPE.FACE_ID;
const mockSetIsBiometricsEnabled = jest.fn();
jest.mock("hooks/useBiometrics", () => ({
  useBiometrics: () => ({
    biometryType: mockBiometryType,
    setIsBiometricsEnabled: mockSetIsBiometricsEnabled,
  }),
}));

const renderScreen = (source = BiometricsSource.ONBOARDING) =>
  renderWithProviders(
    <BiometricsOnboardingScreen
      route={{ params: { source } } as never}
      navigation={{} as never}
    />,
  );

const overlay = () => useWalletSetupOverlayStore.getState();

/** Settles a pending step inside act, then lets what follows it run. */
const settle = (step: () => void) =>
  act(() => {
    step();
    return Promise.resolve();
  });

/** A promise the test settles, for a step still in progress. */
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

describe("BiometricsOnboardingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnableBiometrics.mockReset();
    mockBiometryType = BIOMETRY_TYPE.FACE_ID;
    useWalletSetupOverlayStore.setState(
      useWalletSetupOverlayStore.getInitialState(),
      true,
    );
  });

  it("offers to unlock with Face ID", () => {
    const { getByText } = renderScreen();

    expect(getByText("Unlock with Face ID")).toBeTruthy();
    expect(
      getByText(
        "Unlock your wallet and approve transactions faster with Face ID.",
      ),
    ).toBeTruthy();
    expect(getByText("Enable Face ID")).toBeTruthy();
    expect(getByText("Skip for now")).toBeTruthy();
  });

  it("words Touch ID the same way", () => {
    mockBiometryType = BIOMETRY_TYPE.TOUCH_ID;
    const { getByText } = renderScreen();

    expect(getByText("Unlock with Touch ID")).toBeTruthy();
    expect(
      getByText(
        "Unlock your wallet and approve transactions faster with Touch ID.",
      ),
    ).toBeTruthy();
    expect(getByText("Enable Touch ID")).toBeTruthy();
  });

  // The keychain mock has no OPTIC_ID, so Iris stands for the two types
  // that used to show the footer note as their description.
  it("gives Iris a description of its own", () => {
    mockBiometryType = BIOMETRY_TYPE.IRIS;
    const { getByText } = renderScreen();

    expect(
      getByText(
        "Unlock your wallet and approve transactions faster with Iris.",
      ),
    ).toBeTruthy();
  });

  it("drops the Enable button's icon and the old footer note", () => {
    const { getByTestId, queryByText } = renderScreen();

    expect(
      within(getByTestId("default-action-button")).queryByTestId("SvgMock"),
    ).toBeNull();
    expect(queryByText("You can change this later in Settings.")).toBeNull();
  });

  it("clears the in-memory phrase and password once Skip creates the wallet", async () => {
    mockSignUp.mockResolvedValue(true);
    const { getByText } = renderScreen();

    fireEvent.press(getByText("Skip for now"));

    await waitFor(() => expect(mockClearLoginData).toHaveBeenCalledTimes(1));
    expect(mockSignUp).toHaveBeenCalledWith({
      mnemonicPhrase: "abandon ability able",
      password: "password1",
    });
  });

  it("keeps them when Skip fails, so the user can retry", async () => {
    mockSignUp.mockResolvedValue(false);
    const { getByText } = renderScreen();

    fireEvent.press(getByText("Skip for now"));

    await waitFor(() => expect(mockNotifySetupFailed).toHaveBeenCalledTimes(1));
    expect(mockClearLoginData).not.toHaveBeenCalled();
  });

  it("imports instead when the flow came from Import Wallet", async () => {
    mockImportWallet.mockResolvedValue(true);
    const { getByText } = renderScreen(BiometricsSource.IMPORT_WALLET);

    fireEvent.press(getByText("Skip for now"));

    await waitFor(() => expect(mockImportWallet).toHaveBeenCalledTimes(1));
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  // Enable sets the wallet up with the password the biometric check hands
  // back. Only a setup that succeeds may turn biometrics on and drop the
  // phrase and password from memory.
  describe("enabling biometrics", () => {
    /** The biometric check passes and hands the callback this password. */
    const passBiometricCheck = (biometricPassword?: string) =>
      mockEnableBiometrics.mockImplementation(
        (callback: (password?: string) => Promise<unknown>) =>
          callback(biometricPassword),
      );

    it("creates the wallet with the password the check returns, then turns biometrics on", async () => {
      passBiometricCheck("biometric-password");
      mockSignUp.mockResolvedValue(true);
      const { getByText } = renderScreen();

      fireEvent.press(getByText("Enable Face ID"));

      await waitFor(() =>
        expect(mockSetIsBiometricsEnabled).toHaveBeenCalledWith(true),
      );
      expect(mockSignUp).toHaveBeenCalledWith({
        mnemonicPhrase: "abandon ability able",
        password: "biometric-password",
      });
      expect(mockClearLoginData).toHaveBeenCalledTimes(1);
      expect(mockNotifySetupFailed).not.toHaveBeenCalled();
    });

    it("uses the typed password when the check returns none", async () => {
      passBiometricCheck();
      mockSignUp.mockResolvedValue(true);
      const { getByText } = renderScreen();

      fireEvent.press(getByText("Enable Face ID"));

      await waitFor(() =>
        expect(mockSetIsBiometricsEnabled).toHaveBeenCalledWith(true),
      );
      expect(mockSignUp).toHaveBeenCalledWith({
        mnemonicPhrase: "abandon ability able",
        password: "password1",
      });
    });

    it("imports with the password the check returns when the flow came from Import Wallet", async () => {
      passBiometricCheck("biometric-password");
      mockImportWallet.mockResolvedValue(true);
      const { getByText } = renderScreen(BiometricsSource.IMPORT_WALLET);

      fireEvent.press(getByText("Enable Face ID"));

      await waitFor(() =>
        expect(mockSetIsBiometricsEnabled).toHaveBeenCalledWith(true),
      );
      expect(mockImportWallet).toHaveBeenCalledWith({
        mnemonicPhrase: "abandon ability able",
        password: "biometric-password",
      });
      expect(mockSignUp).not.toHaveBeenCalled();
      expect(mockClearLoginData).toHaveBeenCalledTimes(1);
    });

    it("leaves biometrics off and keeps the phrase when setup fails", async () => {
      passBiometricCheck("biometric-password");
      mockSignUp.mockResolvedValue(false);
      const { getByText } = renderScreen();

      fireEvent.press(getByText("Enable Face ID"));

      await waitFor(() =>
        expect(mockNotifySetupFailed).toHaveBeenCalledTimes(1),
      );
      expect(mockSetIsBiometricsEnabled).not.toHaveBeenCalled();
      expect(mockClearLoginData).not.toHaveBeenCalled();
    });

    it("leaves biometrics off and keeps the phrase when the check is cancelled", async () => {
      mockEnableBiometrics.mockRejectedValue(new Error("User canceled"));
      const { getByText } = renderScreen();

      fireEvent.press(getByText("Enable Face ID"));

      await waitFor(() =>
        expect(mockNotifySetupFailed).toHaveBeenCalledTimes(1),
      );
      expect(mockSignUp).not.toHaveBeenCalled();
      expect(mockSetIsBiometricsEnabled).not.toHaveBeenCalled();
      expect(mockClearLoginData).not.toHaveBeenCalled();
    });

    // Setup moves the app to Home before signUp resolves, which unmounts
    // this screen mid-call. What follows only calls stores, so it still runs.
    it("turns biometrics on even if this screen has unmounted meanwhile", async () => {
      passBiometricCheck("biometric-password");
      const signUp = deferred<boolean>();
      mockSignUp.mockReturnValue(signUp.promise);
      const { getByText, unmount } = renderScreen();

      fireEvent.press(getByText("Enable Face ID"));
      await waitFor(() => expect(overlay().phase).toBe("settingUp"));
      unmount();

      await settle(() => signUp.resolve(true));

      await waitFor(() => expect(overlay().phase).toBe("ready"));
      expect(mockSetIsBiometricsEnabled).toHaveBeenCalledWith(true);
      expect(mockClearLoginData).toHaveBeenCalledTimes(1);
    });
  });

  describe("the wallet setup screen", () => {
    it("shows Creating your wallet as soon as Skip starts setting up", async () => {
      const signUp = deferred<boolean>();
      mockSignUp.mockReturnValue(signUp.promise);
      const { getByText } = renderScreen();

      fireEvent.press(getByText("Skip for now"));

      await waitFor(() => expect(overlay().phase).toBe("settingUp"));
      expect(overlay().flow).toBe("create");

      await settle(() => signUp.resolve(true));
      expect(overlay().phase).toBe("ready");
    });

    it("shows Importing your wallet when Skip imports", async () => {
      mockImportWallet.mockResolvedValue(true);
      const { getByText } = renderScreen(BiometricsSource.IMPORT_WALLET);

      fireEvent.press(getByText("Skip for now"));

      await waitFor(() => expect(overlay().phase).toBe("ready"));
      expect(overlay().flow).toBe("import");
    });

    it("fades it away with the toast when Skip's setup fails", async () => {
      mockSignUp.mockResolvedValue(false);
      const { getByText } = renderScreen();

      fireEvent.press(getByText("Skip for now"));

      await waitFor(() => expect(mockNotifySetupFailed).toHaveBeenCalled());
      expect(overlay().phase).toBe("leaving");
    });

    // Enabling reads the password through the biometric prompt first. The
    // screen comes up only once that passes.
    it("shows it only after the biometric check passes", async () => {
      const check = deferred<void>();
      mockEnableBiometrics.mockImplementation(
        async (callback: (password?: string) => Promise<unknown>) => {
          await check.promise;
          return callback("password1");
        },
      );
      mockSignUp.mockResolvedValue(true);
      const { getByText } = renderScreen();

      fireEvent.press(getByText("Enable Face ID"));
      await act(async () => {});
      expect(overlay().phase).toBe("hidden");

      await settle(() => check.resolve());

      await waitFor(() => expect(overlay().phase).toBe("ready"));
      expect(mockSignUp).toHaveBeenCalledTimes(1);
    });

    it("never shows it when the biometric check is cancelled", async () => {
      mockEnableBiometrics.mockRejectedValue(new Error("User canceled"));
      const { getByText } = renderScreen();

      fireEvent.press(getByText("Enable Face ID"));

      await waitFor(() => expect(mockNotifySetupFailed).toHaveBeenCalled());
      expect(overlay().phase).toBe("hidden");
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it("fades it away with the toast when setup fails after the check", async () => {
      mockEnableBiometrics.mockImplementation(
        (callback: (password?: string) => Promise<unknown>) =>
          callback("password1"),
      );
      mockSignUp.mockResolvedValue(false);
      const { getByText } = renderScreen();

      fireEvent.press(getByText("Enable Face ID"));

      await waitFor(() => expect(mockNotifySetupFailed).toHaveBeenCalled());
      expect(overlay().phase).toBe("leaving");
    });

    // Setup moves the app to Home before signUp resolves, which unmounts
    // this screen mid-call.
    it("turns ready even if this screen has unmounted meanwhile", async () => {
      const signUp = deferred<boolean>();
      mockSignUp.mockReturnValue(signUp.promise);
      const { getByText, unmount } = renderScreen();

      fireEvent.press(getByText("Skip for now"));
      await waitFor(() => expect(overlay().phase).toBe("settingUp"));
      unmount();

      await settle(() => signUp.resolve(true));

      expect(overlay().phase).toBe("ready");
    });

    it("leaves it hidden when Biometrics is offered after onboarding", async () => {
      mockEnableBiometrics.mockImplementation(
        (callback: (password?: string) => Promise<unknown>) => callback(),
      );
      const { getByText } = renderScreen(BiometricsSource.POST_ONBOARDING);

      fireEvent.press(getByText("Enable Face ID"));
      await act(async () => {});

      expect(mockEnableBiometrics).toHaveBeenCalledTimes(1);
      expect(overlay().phase).toBe("hidden");
    });
  });
});

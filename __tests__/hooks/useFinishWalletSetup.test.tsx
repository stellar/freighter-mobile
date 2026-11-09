import { act, renderHook } from "@testing-library/react-native";
import { BiometricsSource } from "config/constants";
import { AUTH_STACK_ROUTES } from "config/routes";
import { useLoginDataStore } from "ducks/loginData";
import { useWalletSetupOverlayStore } from "ducks/walletSetupOverlay";
import {
  WalletSetupSource,
  useFinishWalletSetup,
} from "hooks/useFinishWalletSetup";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockSignUp = jest.fn();
const mockImportWallet = jest.fn();
const mockStoreBiometricPassword = jest.fn();
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    signUp: mockSignUp,
    importWallet: mockImportWallet,
    storeBiometricPassword: mockStoreBiometricPassword,
  }),
}));

let mockBiometryType: string | null = null;
jest.mock("hooks/useBiometrics", () => ({
  useBiometrics: () => ({ biometryType: mockBiometryType }),
}));

const mockNotifySetupFailed = jest.fn();
jest.mock("hooks/useSetupFailedToast", () => ({
  useSetupFailedToast: () => mockNotifySetupFailed,
}));

const PHRASE =
  "abandon ability able about above absent absorb abstract absurd abuse access accident";
const PASSWORD = "password1";

const finish = async (source: WalletSetupSource) => {
  const { result } = renderHook(() => useFinishWalletSetup());
  await act(() => result.current(source));
};

const overlay = () => useWalletSetupOverlayStore.getState();

/** A promise the test settles, for a setup still in progress. */
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("useFinishWalletSetup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBiometryType = null;
    useLoginDataStore.setState({ mnemonicPhrase: PHRASE, password: PASSWORD });
    useWalletSetupOverlayStore.setState(
      useWalletSetupOverlayStore.getInitialState(),
      true,
    );
  });

  describe("without biometrics", () => {
    it("creates the wallet and clears the phrase and password", async () => {
      mockSignUp.mockResolvedValue(true);

      await finish(BiometricsSource.ONBOARDING);

      expect(mockSignUp).toHaveBeenCalledWith({
        mnemonicPhrase: PHRASE,
        password: PASSWORD,
      });
      expect(mockImportWallet).not.toHaveBeenCalled();
      expect(useLoginDataStore.getState()).toMatchObject({
        mnemonicPhrase: null,
        password: null,
      });
    });

    it("imports the wallet when the flow is an import", async () => {
      mockImportWallet.mockResolvedValue(true);

      await finish(BiometricsSource.IMPORT_WALLET);

      expect(mockImportWallet).toHaveBeenCalledWith({
        mnemonicPhrase: PHRASE,
        password: PASSWORD,
      });
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it("keeps the phrase and password after a failure, so the user can retry", async () => {
      mockSignUp.mockResolvedValue(false);

      await finish(BiometricsSource.ONBOARDING);

      expect(mockNotifySetupFailed).toHaveBeenCalledTimes(1);
      expect(useLoginDataStore.getState()).toMatchObject({
        mnemonicPhrase: PHRASE,
        password: PASSWORD,
      });
    });
  });

  describe("with biometrics", () => {
    beforeEach(() => {
      mockBiometryType = "FaceID";
    });

    it("saves the password for biometrics and lets Biometrics finish", async () => {
      mockStoreBiometricPassword.mockResolvedValue(undefined);

      await finish(BiometricsSource.IMPORT_WALLET);

      expect(mockStoreBiometricPassword).toHaveBeenCalledWith(PASSWORD);
      expect(mockNavigate).toHaveBeenCalledWith(
        AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN,
        {
          source: BiometricsSource.IMPORT_WALLET,
        },
      );
      expect(mockImportWallet).not.toHaveBeenCalled();
      // Biometrics still needs them to create the wallet.
      expect(useLoginDataStore.getState().mnemonicPhrase).toBe(PHRASE);
    });

    it("stays put with an error when the password can't be saved", async () => {
      mockStoreBiometricPassword.mockRejectedValue(new Error("keychain"));

      await finish(BiometricsSource.ONBOARDING);

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockNotifySetupFailed).toHaveBeenCalledTimes(1);
    });
  });

  it("reports a failure when the phrase is missing", async () => {
    useLoginDataStore.setState({ mnemonicPhrase: null });

    await finish(BiometricsSource.ONBOARDING);

    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockNotifySetupFailed).toHaveBeenCalledTimes(1);
  });

  describe("the wallet setup screen", () => {
    it("shows Creating your wallet while signing up, then turns ready", async () => {
      const signUp = deferred<boolean>();
      mockSignUp.mockReturnValue(signUp.promise);
      const { result } = renderHook(() => useFinishWalletSetup());

      let finishing: Promise<void> = Promise.resolve();
      act(() => {
        finishing = result.current(BiometricsSource.ONBOARDING);
      });
      expect(overlay().phase).toBe("settingUp");
      expect(overlay().flow).toBe("create");

      signUp.resolve(true);
      await act(() => finishing);

      expect(overlay().phase).toBe("ready");
    });

    it("shows Importing your wallet while importing", async () => {
      mockImportWallet.mockResolvedValue(true);

      await finish(BiometricsSource.IMPORT_WALLET);

      expect(overlay().flow).toBe("import");
      expect(overlay().phase).toBe("ready");
    });

    it("fades it away and shows the toast when setup fails", async () => {
      mockSignUp.mockResolvedValue(false);

      await finish(BiometricsSource.ONBOARDING);

      expect(overlay().phase).toBe("leaving");
      expect(mockNotifySetupFailed).toHaveBeenCalledTimes(1);
    });

    it("fades it away and shows the toast when setup throws", async () => {
      mockSignUp.mockRejectedValue(new Error("scrypt failed"));

      await finish(BiometricsSource.ONBOARDING);

      expect(overlay().phase).toBe("leaving");
      expect(mockNotifySetupFailed).toHaveBeenCalledTimes(1);
    });

    it("leaves it hidden on the way to Biometrics", async () => {
      mockBiometryType = "FaceID";
      mockStoreBiometricPassword.mockResolvedValue(undefined);

      await finish(BiometricsSource.ONBOARDING);

      expect(overlay().phase).toBe("hidden");
    });

    it("leaves it hidden when the phrase is missing", async () => {
      useLoginDataStore.setState({ mnemonicPhrase: null });

      await finish(BiometricsSource.ONBOARDING);

      expect(overlay().phase).toBe("hidden");
    });
  });

  it("ignores a second tap while the first is still setting up", async () => {
    let resolveSignUp: (value: boolean) => void = () => {};
    mockSignUp.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveSignUp = resolve;
      }),
    );
    const { result } = renderHook(() => useFinishWalletSetup());

    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current(BiometricsSource.ONBOARDING);
      second = result.current(BiometricsSource.ONBOARDING);
    });
    resolveSignUp(true);
    await act(() => Promise.all([first, second]).then(() => undefined));

    expect(mockSignUp).toHaveBeenCalledTimes(1);
  });
});

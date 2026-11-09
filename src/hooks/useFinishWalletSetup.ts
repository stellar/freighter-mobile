import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BiometricsSource } from "config/constants";
import { logger } from "config/logger";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useLoginDataStore } from "ducks/loginData";
import {
  WalletSetupFlow,
  runWithWalletSetupOverlay,
} from "ducks/walletSetupOverlay";
import { useBiometrics } from "hooks/useBiometrics";
import { useSetupFailedToast } from "hooks/useSetupFailedToast";
import { useCallback, useRef } from "react";

/** Logged, and the Sentry issue's title, when the phrase or password is gone. */
const MISSING_LOGIN_DATA = "Missing the phrase or the password";

/** Which wallet the last onboarding step finishes: a new one or an import. */
export type WalletSetupSource =
  | BiometricsSource.ONBOARDING
  | BiometricsSource.IMPORT_WALLET;

/** What the wallet setup screen says for an onboarding step's source. */
export const walletSetupFlowFor = (
  source: BiometricsSource,
): WalletSetupFlow =>
  source === BiometricsSource.IMPORT_WALLET ? "import" : "create";

/**
 * Finishes creating or importing a wallet, for the last onboarding step:
 * Recovery Phrase when creating, Set Password when importing.
 *
 * With biometrics, it saves the password for them and opens Biometrics,
 * which creates the wallet once the user enables or skips them. Without,
 * it creates or imports the wallet here, behind the wallet setup screen,
 * and clears the in-memory phrase and password. A failure takes the screen
 * away, shows the setup-failed toast and keeps both, so the user can try
 * again.
 *
 * The phrase and password are read from the store when called, not captured
 * at render, so the step never acts on stale values.
 */
export const useFinishWalletSetup = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUp, importWallet, storeBiometricPassword } =
    useAuthenticationStore();
  const { biometryType } = useBiometrics();
  const notifySetupFailed = useSetupFailedToast();
  // A second tap before the first finishes would set the wallet up twice,
  // and signUp and importWallet each wipe the device before storing it.
  const isFinishingRef = useRef(false);

  return useCallback(
    async (source: WalletSetupSource) => {
      if (isFinishingRef.current) return;
      isFinishingRef.current = true;

      try {
        const { mnemonicPhrase, password, clearLoginData } =
          useLoginDataStore.getState();

        if (!mnemonicPhrase || !password) {
          logger.error(
            "useFinishWalletSetup",
            MISSING_LOGIN_DATA,
            new Error(MISSING_LOGIN_DATA),
            { source },
          );
          notifySetupFailed();
          return;
        }

        if (biometryType) {
          await storeBiometricPassword(password);
          navigation.navigate(AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN, {
            source,
          });
          return;
        }

        const succeeded = await runWithWalletSetupOverlay(
          walletSetupFlowFor(source),
          () =>
            source === BiometricsSource.IMPORT_WALLET
              ? importWallet({ mnemonicPhrase, password })
              : signUp({ mnemonicPhrase, password }),
        );

        if (succeeded) {
          clearLoginData();
        } else {
          notifySetupFailed();
        }
      } catch (error) {
        logger.error(
          "useFinishWalletSetup",
          "Failed to finish the wallet setup",
          error,
        );
        notifySetupFailed();
      } finally {
        isFinishingRef.current = false;
      }
    },
    [
      biometryType,
      importWallet,
      navigation,
      notifySetupFailed,
      signUp,
      storeBiometricPassword,
    ],
  );
};

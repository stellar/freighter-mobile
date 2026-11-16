import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BiometricsSource, STORAGE_KEYS } from "config/constants";
import { AUTH_STACK_ROUTES } from "config/routes";
import type { RootStackParamList, AuthStackParamList } from "config/routes";
import { AUTH_STATUS, type AuthStatus } from "config/types";
import * as Keychain from "react-native-keychain";
import { dataStorage } from "services/storage/storageFactory";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList & AuthStackParamList
>;

/**
 * Opens the biometrics prompt three seconds into a launch that starts unlocked,
 * when the device has biometrics, the wallet doesn't use them, and the prompt
 * has never been answered.
 *
 * @param navigation - The root stack's navigation
 * @param authStatus - The auth status the launch started with
 * @param checkBiometrics - Resolves the device's biometry type, or null
 * @param isBiometricsEnabled - Whether the wallet already uses biometrics
 * @param isEthenaLaunchPromoPending - Whether the Ethena launch promo opens on
 * this launch; the prompt then waits for a later one
 */
export const triggerFaceIdOnboarding = (
  navigation: NavigationProp,
  authStatus: AuthStatus,
  checkBiometrics: () => Promise<Keychain.BIOMETRY_TYPE | null>,
  isBiometricsEnabled: boolean,
  isEthenaLaunchPromoPending: boolean,
): void => {
  // The promo opens as the splash ends, and this prompt would push over it
  // mid-entrance. Its flag stays unset, so a later unlocked launch shows it.
  if (isEthenaLaunchPromoPending) {
    return;
  }

  if (authStatus === AUTH_STATUS.AUTHENTICATED) {
    setTimeout(() => {
      dataStorage
        .getItem(STORAGE_KEYS.HAS_SEEN_BIOMETRICS_ENABLE_SCREEN)
        .then(async (hasSeenBiometricsEnableScreenStorage) => {
          const type = await checkBiometrics();
          if (
            !isBiometricsEnabled &&
            hasSeenBiometricsEnableScreenStorage !== "true" &&
            !!type
          ) {
            navigation.navigate(AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN, {
              source: BiometricsSource.POST_ONBOARDING,
            });
          }
        });
    }, 3000);
  }
};

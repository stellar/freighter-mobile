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

export const triggerFaceIdOnboarding = (
  navigation: NavigationProp,
  authStatus: AuthStatus,
  checkBiometrics: () => Promise<Keychain.BIOMETRY_TYPE | null>,
  isBiometricsEnabled: boolean,
): void => {
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

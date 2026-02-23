import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BiometricsSource, STORAGE_KEYS } from "config/constants";
import { AUTH_STACK_ROUTES } from "config/routes";
import type { RootStackParamList, AuthStackParamList } from "config/routes";
import { AUTH_STATUS, type AuthStatus } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import * as Keychain from "react-native-keychain";
import { dataStorage } from "services/storage/storageFactory";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList & AuthStackParamList
>;

export const triggerFaceIdOnboarding = (
  navigation: NavigationProp,
  authStatus: AuthStatus,
  checkBiometrics: () => Promise<Keychain.BIOMETRY_TYPE | null>,
): void => {
  if (authStatus === AUTH_STATUS.AUTHENTICATED) {
    setTimeout(() => {
      // Guard: if the user logged out or deleted their account while the
      // timer was running, abort — no longer in an authenticated session.
      const currentAuthStatus = useAuthenticationStore.getState().authStatus;
      if (currentAuthStatus !== AUTH_STATUS.AUTHENTICATED) return;

      // Read isBiometricsEnabled at runtime from the preferences store
      // rather than relying on a stale closure value captured at call time.
      const { isBiometricsEnabled } = usePreferencesStore.getState();

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

import { NativeModules } from "react-native";

interface PrivacyShieldModule {
  hide?: () => Promise<void>;
}

/**
 * Dismisses the native privacy shield (iOS overlay window / Android overlay
 * view) once the JS auto-lock decision has settled, so the wallet is revealed
 * only after a soft-lock overlay (if any) has mounted. No-op if the native
 * module isn't available — the native side has its own fallback timer.
 */
export const hidePrivacyShield = (): void => {
  const privacyShield = NativeModules.PrivacyShield as
    | PrivacyShieldModule
    | undefined;

  privacyShield?.hide?.().catch(() => {
    // Best effort — the native fallback timer removes the shield regardless
  });
};

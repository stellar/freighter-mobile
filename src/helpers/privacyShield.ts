import { NativeModules } from "react-native";

interface PrivacyShieldModule {
  hide?: () => Promise<void>;
}

const getModule = (): PrivacyShieldModule | undefined =>
  NativeModules.PrivacyShield as PrivacyShieldModule | undefined;

// JS mirror of whether the native shield is currently covering the app. The
// native side shows it deterministically when the app backgrounds; callers
// mark it here so they can tell whether the wallet is still hidden (e.g. to
// hold a biometric prompt until the lock screen is actually visible).
let shieldVisible = false;
const shieldHiddenListeners = new Set<() => void>();

/**
 * Records that the native shield was raised (call on backgrounding). No-op
 * when the native module is unavailable so platforms without a shield don't
 * report a phantom cover.
 */
export const markPrivacyShieldVisible = (): void => {
  if (getModule()?.hide) {
    shieldVisible = true;
  }
};

/** Whether the native shield is believed to be covering the app right now. */
export const isPrivacyShieldVisible = (): boolean => shieldVisible;

/**
 * Subscribes to the moment the shield is dismissed. Returns an unsubscribe
 * function. Fires once per hidePrivacyShield call.
 */
export const onPrivacyShieldHidden = (listener: () => void): (() => void) => {
  shieldHiddenListeners.add(listener);
  return () => {
    shieldHiddenListeners.delete(listener);
  };
};

/**
 * Dismisses the native privacy shield (iOS overlay window / Android overlay
 * view) once the JS auto-lock decision has settled, so the wallet is revealed
 * only after a soft-lock overlay (if any) has mounted. No-op if the native
 * module isn't available — the native side has its own fallback timer.
 * Notifies onPrivacyShieldHidden listeners once the shield is gone.
 */
export const hidePrivacyShield = (): void => {
  const finish = () => {
    shieldVisible = false;
    shieldHiddenListeners.forEach((listener) => listener());
  };

  const privacyShield = getModule();
  if (!privacyShield?.hide) {
    finish();
    return;
  }

  privacyShield
    .hide()
    .catch(() => {
      // Best effort — the native fallback timer removes the shield regardless
    })
    .finally(finish);
};

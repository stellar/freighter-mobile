import { isIOS } from "helpers/device";
import * as Keychain from "react-native-keychain";

/**
 * Secure keychain options for sensitive data (wallet keys, encrypted blobs, passwords, etc.)
 *
 * Platform-specific behavior:
 * - iOS: Uses accessControl to require user presence (biometrics or passcode) on read
 * - Android: Does not use accessControl to avoid unwanted prompts
 *
 * Security features:
 * - WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: Only accessible when device has passcode and is unlocked
 * - Never included in backups or device migration
 */
export const SECURE_KEYCHAIN_OPTIONS = {
  accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  accessControl: isIOS
    ? Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE
    : undefined,
};

/**
 * Options for index/metadata keys (less sensitive - just key IDs, not cryptographic material)
 */
export const INDEX_KEYCHAIN_OPTIONS = {
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  // No accessControl - metadata only, no biometric prompt needed
};

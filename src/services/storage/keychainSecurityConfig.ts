import * as Keychain from "react-native-keychain";

/**
 * Secure keychain options for storing sensitive data (wallet keys, encrypted blobs, passwords, etc.)
 *
 * Security features:
 * - WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: Only accessible when device has passcode and is unlocked
 * - Never included in backups or device migration
 * - Note: accessControl is not included here because setting items with accessControl triggers
 *   the biometric prompt, which causes loops during login when many keys are set
 */
export const SECURE_KEYCHAIN_SET_OPTIONS = {
  accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

/**
 * Secure keychain options for reading sensitive data
 *
 * Platform-specific behavior:
 * - iOS: Uses accessControl to require user presence (biometrics or passcode) on read
 * - Android: Does not use accessControl to avoid unwanted prompts
 *
 * Note: accessControl is only set here (for reading) because setting items with accessControl
 * triggers the biometric prompt, which causes loops during login when many keys are set.
 * By only applying accessControl when reading, we avoid prompts during storage while still
 * requiring authentication when accessing sensitive data.
 */
export const SECURE_KEYCHAIN_GET_OPTIONS = {
  ...SECURE_KEYCHAIN_SET_OPTIONS,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
};

/**
 * Options for index/metadata keys (less sensitive - just key IDs, not cryptographic material)
 */
export const INDEX_KEYCHAIN_OPTIONS = {
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  // No accessControl - metadata only, no biometric prompt needed
};

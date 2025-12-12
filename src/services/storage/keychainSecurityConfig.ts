import * as Keychain from "react-native-keychain";
import type {
  SetOptions,
  GetOptions,
  BaseOptions,
} from "react-native-keychain";

/**
 * Security levels for keychain storage
 *
 * Different types of sensitive data require different levels of protection.
 * This module provides pre-configured security options based on data sensitivity.
 */
export enum SecurityLevel {
  /**
   * HIGHEST: For the most sensitive data like wallet master keys, encrypted seeds,
   * and long-lived cryptographic secrets.
   * - Requires user presence (biometrics/passcode) on every access
   * - Device-only (excluded from backups/migration)
   * - Only accessible when device is unlocked with passcode set
   */
  HIGHEST = "HIGHEST",

  /**
   * HIGH: For sensitive data like encrypted wallet blobs, hash keys, and temporary stores.
   * - Requires user presence (biometrics/passcode) on every access
   * - Device-only (excluded from backups/migration)
   * - Accessible when device is unlocked
   */
  HIGH = "HIGH",

  /**
   * MEDIUM: For moderately sensitive data like session tokens or passwords.
   * - Device-only (excluded from backups/migration)
   * - Accessible when device is unlocked
   * - No explicit user presence requirement (can be used for convenience)
   */
  MEDIUM = "MEDIUM",
}

/**
 * Secure keychain options for different security levels (for set operations)
 *
 * These configurations align with OWASP MASVS recommendations for secure storage
 * of sensitive data at rest, particularly for high-value crypto wallet applications.
 */
export const SECURE_KEYCHAIN_SET_OPTIONS: Record<
  SecurityLevel,
  Omit<SetOptions, "service">
> = {
  /**
   * HIGHEST security level
   *
   * Use for:
   * - Wallet master keys (EncryptedKey objects)
   * - Encrypted seed phrases
   * - Long-lived cryptographic secrets
   *
   * Security features:
   * - WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: Only accessible when device has passcode
   *   and is unlocked, never included in backups or device migration
   * - BIOMETRY_ANY_OR_DEVICE_PASSCODE: Requires biometric authentication or device
   *   passcode on every read operation
   */
  [SecurityLevel.HIGHEST]: {
    accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  },

  /**
   * HIGH security level
   *
   * Use for:
   * - Encrypted wallet blobs (temporary store)
   * - Hash keys used for encryption/decryption
   * - Other sensitive wallet data
   *
   * Security features:
   * - WHEN_UNLOCKED_THIS_DEVICE_ONLY: Accessible when device is unlocked,
   *   never included in backups or device migration
   * - BIOMETRY_ANY_OR_DEVICE_PASSCODE: Requires biometric authentication or device
   *   passcode on every read operation
   */
  [SecurityLevel.HIGH]: {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  },

  /**
   * MEDIUM security level
   *
   * Use for:
   * - Session tokens
   * - Short-lived authentication data
   * - Other moderately sensitive data
   *
   * Security features:
   * - WHEN_UNLOCKED_THIS_DEVICE_ONLY: Accessible when device is unlocked,
   *   never included in backups or device migration
   * - No explicit accessControl: No biometric prompt required (for convenience)
   */
  [SecurityLevel.MEDIUM]: {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    // No accessControl - allows access without biometric prompt for convenience
  },
};

/**
 * Secure keychain options for different security levels (for get operations)
 *
 * Get operations need accessControl but not accessible (that's set during storage).
 */
export const SECURE_KEYCHAIN_GET_OPTIONS: Record<
  SecurityLevel,
  Omit<GetOptions, "service">
> = {
  [SecurityLevel.HIGHEST]: {
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  },
  [SecurityLevel.HIGH]: {
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  },
  [SecurityLevel.MEDIUM]: {
    // No accessControl for medium security
  },
};

/**
 * Secure keychain options for different security levels (for base operations like reset/has)
 *
 * Base operations only need service name, but we keep the structure consistent.
 */
export const SECURE_KEYCHAIN_BASE_OPTIONS: Record<
  SecurityLevel,
  Omit<BaseOptions, "service">
> = {
  [SecurityLevel.HIGHEST]: {},
  [SecurityLevel.HIGH]: {},
  [SecurityLevel.MEDIUM]: {},
};

/**
 * Get secure keychain options for set operations
 *
 * @param level - The security level to get options for
 * @returns Keychain set options configured for the specified security level
 */
export function getSecureKeychainSetOptions(
  level: SecurityLevel,
): Omit<SetOptions, "service"> {
  return SECURE_KEYCHAIN_SET_OPTIONS[level];
}

/**
 * Get secure keychain options for get operations
 *
 * @param level - The security level to get options for
 * @returns Keychain get options configured for the specified security level
 */
export function getSecureKeychainGetOptions(
  level: SecurityLevel,
): Omit<GetOptions, "service"> {
  return SECURE_KEYCHAIN_GET_OPTIONS[level];
}

/**
 * Get secure keychain options for base operations
 *
 * @param level - The security level to get options for
 * @returns Keychain base options configured for the specified security level
 */
export function getSecureKeychainBaseOptions(
  level: SecurityLevel,
): Omit<BaseOptions, "service"> {
  return SECURE_KEYCHAIN_BASE_OPTIONS[level];
}

/**
 * Helper function to create keychain set options with a service name and security level
 *
 * @param service - The service name for the keychain entry
 * @param level - The security level (defaults to HIGHEST)
 * @returns Combined keychain set options with service and security settings
 */
export function createSecureKeychainSetOptions(
  service: string,
  level: SecurityLevel = SecurityLevel.HIGHEST,
): SetOptions {
  return {
    service,
    ...getSecureKeychainSetOptions(level),
  };
}

/**
 * Helper function to create keychain get options with a service name and security level
 *
 * @param service - The service name for the keychain entry
 * @param level - The security level (defaults to HIGHEST)
 * @returns Combined keychain get options with service and security settings
 */
export function createSecureKeychainGetOptions(
  service: string,
  level: SecurityLevel = SecurityLevel.HIGHEST,
): GetOptions {
  return {
    service,
    ...getSecureKeychainGetOptions(level),
  };
}

/**
 * Helper function to create keychain base options with a service name and security level
 *
 * @param service - The service name for the keychain entry
 * @param level - The security level (defaults to HIGHEST)
 * @returns Combined keychain base options with service and security settings
 */
export function createSecureKeychainBaseOptions(
  service: string,
  level: SecurityLevel = SecurityLevel.HIGHEST,
): BaseOptions {
  return {
    service,
    ...getSecureKeychainBaseOptions(level),
  };
}

/**
 * Helper function to create keychain options with a service name and security level
 * This is a convenience function that returns SetOptions (most common use case)
 *
 * @param service - The service name for the keychain entry
 * @param level - The security level (defaults to HIGHEST)
 * @returns Combined keychain options with service and security settings
 * @deprecated Use createSecureKeychainSetOptions, createSecureKeychainGetOptions, or createSecureKeychainBaseOptions instead
 */
export function createSecureKeychainOptions(
  service: string,
  level: SecurityLevel = SecurityLevel.HIGHEST,
): SetOptions {
  return createSecureKeychainSetOptions(service, level);
}

import { logger } from "config/logger";
import ReactNativeBiometrics from "react-native-biometrics";
import * as Keychain from "react-native-keychain";
import {
  SecurityLevel,
  createSecureKeychainSetOptions,
  createSecureKeychainGetOptions,
  createSecureKeychainBaseOptions,
} from "services/storage/keychainSecurityConfig";

/**
 * React Native Biometrics instance for biometric authentication
 *
 * This instance is configured to allow device credentials as a fallback
 * when biometric authentication is not available or fails.
 */
export const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
});

/**
 * Default service name used for the keychain
 */
const DEFAULT_SERVICE = "freighter_secure_storage";

/**
 * Options for storing/retrieving items from secure storage
 */
export interface SecureStorageOptions {
  /**
   * Whether to require an explicit biometric prompt before accessing the item.
   * When true, uses react-native-biometrics to show a custom prompt.
   * When false, relies on the keychain's automatic biometric prompt via accessControl.
   *
   * @default false
   */
  requireExplicitBiometricPrompt?: boolean;

  /**
   * Prompt configuration for explicit biometric authentication
   * Only used when requireExplicitBiometricPrompt is true
   */
  biometricPrompt?: {
    title: string;
    cancel: string;
  };

  /**
   * Security level for the stored item
   * @default SecurityLevel.HIGH
   */
  securityLevel?: SecurityLevel;
}

/**
 * Unified secure storage implementation using react-native-keychain
 *
 * This storage provides a single interface for storing sensitive data with
 * configurable security levels and biometric authentication options.
 *
 * Features:
 * - Device-only storage (excluded from backups/migration)
 * - Configurable security levels (HIGHEST, HIGH, MEDIUM)
 * - Optional explicit biometric prompts or automatic keychain prompts
 * - Supports both simple string storage and credential-based storage
 *
 * Use cases:
 * - HIGHEST: Wallet master keys, encrypted seeds (requires passcode + biometrics)
 * - HIGH: Encrypted wallet blobs, hash keys, passwords (requires biometrics/passcode)
 * - MEDIUM: Session tokens, metadata (device-only, no biometric prompt)
 */
export const unifiedSecureStorage = {
  /**
   * Stores an item in secure storage
   *
   * @param key - The key to store the value under
   * @param value - The value to store
   * @param options - Storage options (security level, etc.)
   */
  setItem: async (
    key: string,
    value: string,
    options?: SecureStorageOptions,
  ): Promise<void> => {
    try {
      const securityLevel = options?.securityLevel ?? SecurityLevel.HIGH;
      await Keychain.setGenericPassword(
        key,
        value,
        createSecureKeychainSetOptions(
          `${DEFAULT_SERVICE}_${key}`,
          securityLevel,
        ),
      );
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.setItem",
        `Error storing item in keychain: ${key}`,
        error,
      );
      throw new Error(`Failed to store item in keychain: ${key}`);
    }
  },

  /**
   * Retrieves an item from secure storage
   *
   * If requireExplicitBiometricPrompt is true, shows a custom biometric prompt first.
   * Otherwise, relies on the keychain's automatic biometric prompt.
   *
   * @param key - The key to retrieve
   * @param options - Retrieval options (biometric prompt, security level, etc.)
   * @returns The stored value as a string, or null if not found or authentication failed
   */
  getItem: async (
    key: string,
    options?: SecureStorageOptions,
  ): Promise<string | null> => {
    try {
      const securityLevel = options?.securityLevel ?? SecurityLevel.HIGH;

      // If explicit biometric prompt is required, show it first
      if (options?.requireExplicitBiometricPrompt && options?.biometricPrompt) {
        const hasVerified = await rnBiometrics.simplePrompt({
          promptMessage: options.biometricPrompt.title,
          cancelButtonText: options.biometricPrompt.cancel,
        });
        if (!hasVerified.success) {
          return null;
        }
      }

      const service = `${DEFAULT_SERVICE}_${key}`;

      const result = await Keychain.getGenericPassword(
        createSecureKeychainGetOptions(service, securityLevel),
      );

      if (result === false) {
        return null;
      }

      return result.password;
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.getItem",
        `Error retrieving key from keychain: ${key}`,
        error,
      );
      return null;
    }
  },

  /**
   * Retrieves an item from secure storage with full credential information
   *
   * Similar to getItem but returns the full UserCredentials object instead of just the password.
   * Useful when you need the username or other credential metadata.
   *
   * @param key - The key to retrieve
   * @param options - Retrieval options (biometric prompt, security level, etc.)
   * @returns The stored credentials, or false if not found or authentication failed
   */
  getItemWithCredentials: async (
    key: string,
    options?: SecureStorageOptions,
  ): Promise<Keychain.UserCredentials | false> => {
    try {
      const securityLevel = options?.securityLevel ?? SecurityLevel.HIGH;

      // If explicit biometric prompt is required, show it first
      if (options?.requireExplicitBiometricPrompt && options?.biometricPrompt) {
        const hasVerified = await rnBiometrics.simplePrompt({
          promptMessage: options.biometricPrompt.title,
          cancelButtonText: options.biometricPrompt.cancel,
        });
        if (!hasVerified.success) {
          return false;
        }
      }

      const service = `${DEFAULT_SERVICE}_${key}`;

      const result = await Keychain.getGenericPassword(
        createSecureKeychainGetOptions(service, securityLevel),
      );

      return result;
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.getItemWithCredentials",
        `Error retrieving key from keychain: ${key}`,
        error,
      );
      return false;
    }
  },

  /**
   * Removes one or more items from secure storage
   *
   * @param keys - The key(s) to remove
   * @param options - Options including security level
   */
  remove: async (
    keys: string | string[],
    options?: SecureStorageOptions,
  ): Promise<void> => {
    try {
      const securityLevel = options?.securityLevel ?? SecurityLevel.HIGH;

      if (Array.isArray(keys)) {
        await Promise.all(
          keys.map((key) =>
            Keychain.resetGenericPassword(
              createSecureKeychainBaseOptions(
                `${DEFAULT_SERVICE}_${key}`,
                securityLevel,
              ),
            ),
          ),
        );
        return;
      }

      await Keychain.resetGenericPassword(
        createSecureKeychainBaseOptions(
          `${DEFAULT_SERVICE}_${keys}`,
          securityLevel,
        ),
      );
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.remove",
        "Error removing keys from keychain",
        error,
      );
      // Don't throw since removal failures shouldn't block execution
    }
  },

  /**
   * Checks if an item exists in secure storage
   *
   * @param key - The storage key to check
   * @param options - Options including security level
   * @returns True if the item exists, false otherwise
   */
  checkIfExists: async (
    key: string,
    options?: SecureStorageOptions,
  ): Promise<boolean> => {
    try {
      const securityLevel = options?.securityLevel ?? SecurityLevel.HIGH;
      const result = await Keychain.hasGenericPassword(
        createSecureKeychainBaseOptions(
          `${DEFAULT_SERVICE}_${key}`,
          securityLevel,
        ),
      );
      return result;
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.checkIfExists",
        `Error checking if key exists: ${key}`,
        error,
      );
      return false;
    }
  },

  /**
   * Clears all secure storage
   *
   * Note: This uses the service name only, which may not match all individual entries
   * depending on how they were stored. For more reliable clearing, use remove() with
   * specific keys.
   */
  clear: async (): Promise<void> => {
    try {
      await Keychain.resetGenericPassword({
        service: DEFAULT_SERVICE,
      });
    } catch (error) {
      logger.error(
        "unifiedSecureStorage.clear",
        "Error clearing keychain",
        error,
      );
    }
  },
};

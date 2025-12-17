/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { EncryptedKey } from "@stellar/typescript-wallet-sdk-km";
import { logger } from "config/logger";
import { isIOS } from "helpers/device";
import * as Keychain from "react-native-keychain";
import {
  SECURE_KEYCHAIN_OPTIONS_ANDROID,
  SECURE_KEYCHAIN_OPTIONS_IOS,
  INDEX_KEYCHAIN_OPTIONS,
} from "services/storage/keychainSecurityConfig";

/**
 * Configuration parameters for ReactNativeKeychainFacade
 */
export interface ReactNativeKeychainConfigParams {
  service?: string;
}

const DEFAULT_SERVICE = "stellarwallet";
const DEFAULT_KEY_INDEX = "index";

/**
 * Facade for secure storage using react-native-keychain
 * This provides a simple interface for storing encrypted keys
 */
export class ReactNativeKeychainFacade {
  private service: string;

  constructor() {
    this.service = DEFAULT_SERVICE;
  }

  /**
   * Configure the keychain storage
   */
  public configure(params: ReactNativeKeychainConfigParams = {}) {
    if (params.service) {
      this.service = params.service;
    }
  }

  /**
   * Check if a key exists in keychain
   */
  public async hasKey(id: string): Promise<boolean> {
    try {
      // iOS: Use accessControl to require user presence
      // Android: Do not use accessControl to avoid unwanted prompts
      const getOptions: Keychain.GetOptions = isIOS
        ? {
            service: `${this.service}_${id}`,
            accessControl: SECURE_KEYCHAIN_OPTIONS_IOS.accessControl,
          }
        : {
            service: `${this.service}_${id}`,
          };

      const result = await Keychain.getGenericPassword(getOptions);
      return result !== false;
    } catch (error) {
      logger.error(
        "ReactNativeKeychainKeyStore.hasKey",
        "Error checking key existence:",
        error,
      );

      return false;
    }
  }

  /**
   * Get a key from keychain
   *
   */
  public async getKey(id: string): Promise<EncryptedKey | null> {
    try {
      // iOS: Use accessControl to require user presence
      // Android: Do not use accessControl to avoid unwanted prompts
      const getOptions: Keychain.GetOptions = isIOS
        ? {
            service: `${this.service}_${id}`,
            accessControl: SECURE_KEYCHAIN_OPTIONS_IOS.accessControl,
          }
        : {
            service: `${this.service}_${id}`,
          };

      const result = await Keychain.getGenericPassword(getOptions);

      if (result === false) {
        return null;
      }

      return JSON.parse(result.password) as EncryptedKey;
    } catch (error) {
      logger.error(
        "ReactNativeKeychainKeyStore.getKey",
        `Error getting key ${id}:`,
        error,
      );

      return null;
    }
  }

  /**
   * Set a key in keychain
   *
   */
  public async setKey(id: string, key: EncryptedKey): Promise<void> {
    try {
      // iOS: Use accessControl to require user presence
      // Android: Do not use accessControl to avoid unwanted prompts
      const setOptions: Keychain.SetOptions = isIOS
        ? {
            service: `${this.service}_${id}`,
            accessible: SECURE_KEYCHAIN_OPTIONS_IOS.accessible,
            accessControl: SECURE_KEYCHAIN_OPTIONS_IOS.accessControl,
          }
        : {
            service: `${this.service}_${id}`,
            accessible: SECURE_KEYCHAIN_OPTIONS_ANDROID.accessible,
          };

      await Keychain.setGenericPassword(id, JSON.stringify(key), setOptions);
    } catch (error) {
      throw new Error(`Failed to set key ${id}`);
    }
  }

  /**
   * Remove a key from keychain
   */
  public async removeKey(id: string): Promise<void> {
    try {
      await Keychain.resetGenericPassword({
        service: `${this.service}_${id}`,
      });
    } catch (error) {
      logger.error(
        "ReactNativeKeychainKeyStore.removeKey",
        `Error removing key ${id}:`,
        error,
      );
      // Don't throw here, as the key might not exist
    }
  }

  /**
   * Get all keys from keychain
   * Uses the special index key to track all stored keys
   */
  public async getAllKeys(): Promise<EncryptedKey[]> {
    const keys: EncryptedKey[] = [];
    try {
      const result = await Keychain.getGenericPassword({
        service: `${this.service}_index`,
        ...INDEX_KEYCHAIN_OPTIONS,
      });

      if (result === false) {
        return [];
      }

      const keyIds: string[] = JSON.parse(result.password);

      for (const id of keyIds) {
        const key = await this.getKey(id);
        if (key !== null) {
          keys.push(key);
        }
      }
    } catch (error) {
      logger.error(
        "ReactNativeKeychainKeyStore.getAllKeys",
        "Error getting all keys:",
        error,
      );
      // No index found, return empty array
    }

    return keys;
  }

  /**
   * Add a key ID to the index
   *
   */
  public async addToKeyIndex(id: string): Promise<void> {
    try {
      const result = await Keychain.getGenericPassword({
        service: `${this.service}_index`,
        ...INDEX_KEYCHAIN_OPTIONS,
      });

      let keyIds: string[] = [];

      if (result !== false) {
        keyIds = JSON.parse(result.password);
      }

      if (!keyIds.includes(id)) {
        keyIds.push(id);
        await Keychain.setGenericPassword(
          DEFAULT_KEY_INDEX,
          JSON.stringify(keyIds),
          {
            service: `${this.service}_index`,
            ...INDEX_KEYCHAIN_OPTIONS,
          },
        );
      }
    } catch (error) {
      // If index doesn't exist yet, create it
      logger.error(
        "ReactNativeKeychainKeyStore.addToKeyIndex",
        "Error adding to key index, creating new index:",
        error,
      );

      await Keychain.setGenericPassword(
        DEFAULT_KEY_INDEX,
        JSON.stringify([id]),
        {
          service: `${this.service}_index`,
          ...INDEX_KEYCHAIN_OPTIONS,
        },
      );
    }
  }

  /**
   * Remove a key ID from the index
   *
   */
  public async removeFromKeyIndex(id: string): Promise<void> {
    try {
      const result = await Keychain.getGenericPassword({
        service: `${this.service}_index`,
        ...INDEX_KEYCHAIN_OPTIONS,
      });

      if (result !== false) {
        const keyIds: string[] = JSON.parse(result.password);
        const newKeyIds = keyIds.filter((keyId) => keyId !== id);

        await Keychain.setGenericPassword(
          DEFAULT_KEY_INDEX,
          JSON.stringify(newKeyIds),
          {
            service: `${this.service}_index`,
            ...INDEX_KEYCHAIN_OPTIONS,
          },
        );
      }
    } catch (error) {
      logger.error(
        "ReactNativeKeychainKeyStore.removeFromKeyIndex",
        "Error removing from key index:",
        error,
      );
      // Index not found, nothing to remove
    }
  }
}

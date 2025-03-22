/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { EncryptedKey } from "@stellar/typescript-wallet-sdk-km";
import { logger } from "config/logger";
import * as Keychain from "react-native-keychain";

/**
 * Configuration parameters for ReactNativeKeychainFacade
 */
export interface ReactNativeKeychainConfigParams {
  service?: string;
  accessControl?: Keychain.ACCESS_CONTROL;
  accessGroup?: string;
  securityLevel?: Keychain.SECURITY_LEVEL;
}

const DEFAULT_SERVICE = "stellarwallet";

/**
 * Sanitizes a key to be compatible with keychain
 * Making sure the key is a valid string for keychain
 */
function sanitizeKey(key: string): string {
  // Replace any non-alphanumeric, non-permitted characters with underscores
  return key.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Facade for secure storage using react-native-keychain
 * This provides a simple interface for storing encrypted keys
 */
export class ReactNativeKeychainFacade {
  private service: string;

  private accessControl?: Keychain.ACCESS_CONTROL;

  private accessGroup?: string;

  private securityLevel?: Keychain.SECURITY_LEVEL;

  private indexKey: string;

  constructor() {
    this.service = DEFAULT_SERVICE;
    this.indexKey = sanitizeKey("stellarkeys_index");
  }

  /**
   * Configure the keychain storage
   */
  public configure(params: ReactNativeKeychainConfigParams = {}) {
    if (params.service) {
      this.service = params.service;
    }
    if (params.accessControl) {
      this.accessControl = params.accessControl;
    }
    if (params.accessGroup) {
      this.accessGroup = params.accessGroup;
    }
    if (params.securityLevel) {
      this.securityLevel = params.securityLevel;
    }
  }

  /**
   * Get keychain options
   */
  private getOptions(): Keychain.GetOptions {
    const options: Keychain.GetOptions = {
      service: this.service,
    };

    if (this.accessControl) {
      options.accessControl = this.accessControl;
    }
    // Note: accessGroup and securityLevel are supported for SetOptions but may not be for GetOptions
    // We'll add conditionally if they are needed in the future

    return options;
  }

  /**
   * Check if a key exists in keychain
   */
  public async hasKey(id: string): Promise<boolean> {
    const key = sanitizeKey(id);
    try {
      const result = await Keychain.getGenericPassword({
        service: `${this.service}_${key}`,
      });
      return result !== false;
    } catch (error) {
      logger.error("Error checking key existence:", error);
      return false;
    }
  }

  /**
   * Get a key from keychain
   */
  public async getKey(id: string): Promise<EncryptedKey | null> {
    const key = sanitizeKey(id);
    try {
      const result = await Keychain.getGenericPassword({
        service: `${this.service}_${key}`,
      });

      if (result === false) {
        return null;
      }

      return JSON.parse(result.password) as EncryptedKey;
    } catch (error) {
      logger.error(`Error getting key ${id}:`, error);
      return null;
    }
  }

  /**
   * Set a key in keychain
   */
  public async setKey(id: string, key: EncryptedKey): Promise<void> {
    const storageKey = sanitizeKey(id);
    try {
      await Keychain.setGenericPassword(storageKey, JSON.stringify(key), {
        service: `${this.service}_${storageKey}`,
      });
    } catch (error) {
      logger.error(`Error setting key ${id}:`, error);
      throw new Error(`Failed to set key ${id}`);
    }
  }

  /**
   * Remove a key from keychain
   */
  public async removeKey(id: string): Promise<void> {
    const key = sanitizeKey(id);
    try {
      await Keychain.resetGenericPassword({
        service: `${this.service}_${key}`,
      });
    } catch (error) {
      logger.error(`Error removing key ${id}:`, error);
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
      // Get the index key with service only
      const result = await Keychain.getGenericPassword({
        service: `${this.service}_index`,
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
      logger.error("Error getting all keys:", error);
      // No index found, return empty array
    }
    return keys;
  }

  /**
   * Add a key ID to the index
   */
  public async addToKeyIndex(id: string): Promise<void> {
    try {
      // Using a specific service name for the index
      const result = await Keychain.getGenericPassword({
        service: `${this.service}_index`,
      });

      let keyIds: string[] = [];

      if (result !== false) {
        keyIds = JSON.parse(result.password);
      }

      if (!keyIds.includes(id)) {
        keyIds.push(id);
        await Keychain.setGenericPassword("index", JSON.stringify(keyIds), {
          service: `${this.service}_index`,
        });
      }
    } catch (error) {
      // If index doesn't exist yet, create it
      logger.error("Error adding to key index, creating new index:", error);
      await Keychain.setGenericPassword("index", JSON.stringify([id]), {
        service: `${this.service}_index`,
      });
    }
  }

  /**
   * Remove a key ID from the index
   */
  public async removeFromKeyIndex(id: string): Promise<void> {
    try {
      const result = await Keychain.getGenericPassword({
        service: `${this.service}_index`,
      });

      if (result !== false) {
        const keyIds: string[] = JSON.parse(result.password);
        const newKeyIds = keyIds.filter((keyId) => keyId !== id);

        await Keychain.setGenericPassword("index", JSON.stringify(newKeyIds), {
          service: `${this.service}_index`,
        });
      }
    } catch (error) {
      logger.error("Error removing from key index:", error);
      // Index not found, nothing to remove
    }
  }
}

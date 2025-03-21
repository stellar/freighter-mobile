/* eslint-disable no-await-in-loop */
/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable no-restricted-syntax */
import {
  EncryptedKey,
  KeyMetadata,
  KeyStore,
} from "@stellar/typescript-wallet-sdk-km";
import { logger } from "config/logger";
import { debug } from "helpers/debug";
import {
  ReactNativeKeychainFacade,
  ReactNativeKeychainConfigParams,
} from "helpers/keyManager/ReactNativeKeychainFacade";

/**
 * Gets key metadata from an encrypted key
 */
export function getKeyMetadata(encryptedKey: EncryptedKey): KeyMetadata {
  const { id } = encryptedKey;
  return { id };
}

/**
 * KeyStore for React Native applications using react-native-keychain
 *
 * This KeyStore provides secure storage of encrypted keys using the device's keychain.
 * It requires the 'react-native-keychain' library to be installed in your project.
 *
 * Usage example:
 * ```javascript
 * import { KeyManager } from '@stellar/typescript-wallet-sdk-km';
 * import { ReactNativeKeychainKeyStore } from 'helpers/keyManager/ReactNativeKeychainKeyStore';
 *
 * // Initialize the keychain store
 * const keychainStore = new ReactNativeKeychainKeyStore();
 * keychainStore.configure({
 *   // Optional custom settings
 *   service: 'my-stellar-app',
 *   accessControl: Keychain.ACCESS_CONTROL.BIOMETRY,
 * });
 *
 * // Create the key manager with the keychain store
 * const keyManager = new KeyManager({
 *   keyStore: keychainStore
 * });
 *
 * // Now you can use the keyManager to handle keys securely
 * ```
 */
export class ReactNativeKeychainKeyStore implements KeyStore {
  public name: string;

  private keyStore: ReactNativeKeychainFacade;

  constructor() {
    this.name = "ReactNativeKeychainKeyStore";
    this.keyStore = new ReactNativeKeychainFacade();
  }

  /**
   * Configure the keychain parameters
   * @param {ReactNativeKeychainConfigParams} params Configuration parameters
   * @returns {Promise} resolved data
   */
  public configure(params: ReactNativeKeychainConfigParams = {}) {
    try {
      this.keyStore.configure(params);
      return Promise.resolve();
    } catch (e) {
      logger.error("Failed to configure keychain store", e);
      return Promise.reject(e);
    }
  }

  /**
   * Store multiple keys in the keychain
   * @param {EncryptedKey[]} keys Array of encrypted keys to store
   * @returns {Promise<KeyMetadata[]>} Array of key metadata for stored keys
   */
  public async storeKeys(keys: EncryptedKey[]) {
    debug(`Storing ${keys.length} keys in keychain`);

    // We can't store keys if they're already there
    const usedKeys: EncryptedKey[] = [];

    for (const encryptedKey of keys) {
      const hasKey = await this.keyStore.hasKey(encryptedKey.id);
      if (hasKey) {
        usedKeys.push(encryptedKey);
      }
    }

    if (usedKeys.length) {
      logger.error(
        `Some keys already exist in keychain: ${usedKeys.map((k) => k.id).join(", ")}`,
      );
      return Promise.reject(
        `Some keys were already stored in the keystore: ${usedKeys
          .map((k) => k.id)
          .join(", ")}`,
      );
    }

    const keysMetadata: KeyMetadata[] = [];

    for (const encryptedKey of keys) {
      await this.keyStore.setKey(encryptedKey.id, encryptedKey);
      await this.keyStore.addToKeyIndex(encryptedKey.id);
      keysMetadata.push(getKeyMetadata(encryptedKey));
    }

    debug(`Successfully stored ${keys.length} keys in keychain`);
    return Promise.resolve(keysMetadata);
  }

  /**
   * Update existing keys in the keychain
   * @param {EncryptedKey[]} keys Array of encrypted keys to update
   * @returns {Promise<KeyMetadata[]>} Array of key metadata for updated keys
   */
  public async updateKeys(keys: EncryptedKey[]) {
    debug(`Updating ${keys.length} keys in keychain`);

    // We need to ensure all keys already exist before updating them
    const notFoundKeys: EncryptedKey[] = [];

    for (const encryptedKey of keys) {
      const hasKey = await this.keyStore.hasKey(encryptedKey.id);
      if (!hasKey) {
        notFoundKeys.push(encryptedKey);
      }
    }

    if (notFoundKeys.length) {
      logger.error(
        `Some keys not found in keychain: ${notFoundKeys.map((k) => k.id).join(", ")}`,
      );
      return Promise.reject(
        `Some keys couldn't be found in the keystore: ${notFoundKeys
          .map((k) => k.id)
          .join(", ")}`,
      );
    }

    const keysMetadata: KeyMetadata[] = [];

    for (const encryptedKey of keys) {
      await this.keyStore.setKey(encryptedKey.id, encryptedKey);
      keysMetadata.push(getKeyMetadata(encryptedKey));
    }

    debug(`Successfully updated ${keys.length} keys in keychain`);
    return Promise.resolve(keysMetadata);
  }

  /**
   * Load a key from the keychain by ID
   * @param {string} id The ID of the key to load
   * @returns {Promise<EncryptedKey>} The encrypted key
   */
  public async loadKey(id: string) {
    debug(`Loading key ${id} from keychain`);
    const key = await this.keyStore.getKey(id);
    if (!key) {
      logger.error(`Key ${id} not found in keychain`);
      return Promise.reject(id);
    }
    debug(`Successfully loaded key ${id} from keychain`);
    return Promise.resolve(key);
  }

  /**
   * Remove a key from the keychain
   * @param {string} id The ID of the key to remove
   * @returns {Promise<KeyMetadata>} Metadata for the removed key
   */
  public async removeKey(id: string) {
    debug(`Removing key ${id} from keychain`);
    const hasKey = await this.keyStore.hasKey(id);
    if (!hasKey) {
      logger.error(`Key ${id} not found in keychain`);
      return Promise.reject(id);
    }

    const key = await this.keyStore.getKey(id);
    if (!key) {
      logger.error(`Key ${id} could not be retrieved from keychain`);
      return Promise.reject(id);
    }
    const metadata: KeyMetadata = getKeyMetadata(key);

    await this.keyStore.removeKey(id);
    await this.keyStore.removeFromKeyIndex(id);

    debug(`Successfully removed key ${id} from keychain`);
    return Promise.resolve(metadata);
  }

  /**
   * Load all keys from the keychain
   * @returns {Promise<EncryptedKey[]>} Array of all encrypted keys
   */
  public async loadAllKeys() {
    debug("Loading all keys from keychain");
    const keys = await this.keyStore.getAllKeys();
    debug(`Loaded ${keys.length} keys from keychain`);
    return Promise.resolve(keys);
  }
}

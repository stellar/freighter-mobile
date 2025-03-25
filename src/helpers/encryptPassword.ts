/* eslint-disable @typescript-eslint/default-param-last */
import {
  encode as base64Encode,
  decode as base64Decode,
} from "@stablelib/base64";
import { encode as utf8Encode, decode as utf8Decode } from "@stablelib/utf8";
import { logger } from "config/logger";
import rnScrypt from "react-native-scrypt";
import nacl from "tweetnacl";

export interface EncryptDataWithPasswordParams {
  data: string;
  password: string;
  salt?: string;
  nonce?: Uint8Array;
}

export interface EncryptDataWithPasswordResponse {
  encryptedData: string;
  salt: string;
}

export interface DecryptDataWithPasswordParams {
  data: string;
  password: string;
  salt: string;
}

export const SALT_BYTES = 32;
export const NONCE_BYTES = nacl.secretbox.nonceLength; // 24 bytes
export const CRYPTO_V1 = 1;
export const CURRENT_CRYPTO_VERSION = CRYPTO_V1;
export const KEY_LEN = nacl.secretbox.keyLength; // 32 bytes

// Helper function to convert hex string to Uint8Array
const hexToUint8Array = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
};

export function generateSalt(saltBytes?: number): string {
  return base64Encode(nacl.randomBytes(saltBytes || SALT_BYTES));
}

/**
 * Convert password from user into a derived key for encryption.
 *
 * @param {Object} params - Parameters object
 * @param {string} params.password - Plaintext password from user
 * @param {string} params.saltParam - Salt (should be randomly generated)
 * @param {number} [params.dkLen] - Length of the derived key to output
 * @returns {Promise<Uint8Array>} Bytes of the derived key
 */
export async function deriveKeyFromPassword({
  password,
  saltParam,
  dkLen = KEY_LEN,
}: {
  password: string;
  saltParam?: string;
  dkLen?: number;
}): Promise<Uint8Array> {
  const salt = saltParam || generateSalt();
  const [n, r, p] = [32768, 8, 1];

  const derivedKeyHex = await rnScrypt(
    password,
    Array.from(utf8Encode(salt)),
    n,
    r,
    p,
    dkLen,
  );

  return hexToUint8Array(derivedKeyHex);
}

/**
 * Encrypt data using password-based encryption.
 *
 * @async
 * @param {Object} params - Parameters object
 * @param {string} params.data - Data to be encrypted
 * @param {string} params.password - Password to encrypt the data with
 * @param {string} [params.salt] - Static salt (use only for testing)
 * @param {Uint8Array} [params.nonce] - Static nonce (use only for testing)
 * @returns {Promise<EncryptDataWithPasswordResponse>} Encrypted data and salt
 */
export async function encryptDataWithPassword({
  data,
  password,
  salt,
  nonce,
}: EncryptDataWithPasswordParams): Promise<EncryptDataWithPasswordResponse> {
  const secretboxSalt = salt || generateSalt();
  const secretboxNonce = nonce || nacl.randomBytes(NONCE_BYTES);

  const derivedKey = await deriveKeyFromPassword({
    password,
    saltParam: secretboxSalt,
  });

  const textBytes = utf8Encode(data);
  const cipherText = nacl.secretbox(textBytes, secretboxNonce, derivedKey);

  if (!cipherText) {
    throw new Error("Encryption failed");
  }

  const bundle = new Uint8Array(1 + secretboxNonce.length + cipherText.length);
  bundle.set([CURRENT_CRYPTO_VERSION]);
  bundle.set(secretboxNonce, 1);
  bundle.set(cipherText, 1 + secretboxNonce.length);

  return {
    encryptedData: base64Encode(bundle),
    salt: secretboxSalt,
  };
}

/**
 * Decrypt data using password-based decryption.
 *
 * @async
 * @param {Object} params - Parameters object
 * @param {string} params.data - Encrypted data to decrypt
 * @param {string} params.password - Password used for encryption
 * @param {string} params.salt - Salt used during encryption
 * @returns {Promise<string>} Decrypted data
 */
export async function decryptDataWithPassword({
  data,
  password,
  salt,
}: DecryptDataWithPasswordParams): Promise<string> {
  try {
    // Derive the key from the password and salt
    const derivedKey = await deriveKeyFromPassword({
      password,
      saltParam: salt,
    });

    // Decode the base64-encoded bundle
    const bundle = base64Decode(data);

    // Get the version from the first byte
    const version = bundle[0];
    let decryptedBytes;

    if (version === CRYPTO_V1) {
      const nonce = bundle.slice(1, 1 + NONCE_BYTES);
      const cipherText = bundle.slice(1 + NONCE_BYTES);

      // Attempt to decrypt
      decryptedBytes = nacl.secretbox.open(cipherText, nonce, derivedKey);
    } else {
      throw new Error(`Cipher version ${version} not supported.`);
    }

    if (!decryptedBytes) {
      throw new Error("Invalid password or corrupted data.");
    }

    return utf8Decode(decryptedBytes);
  } catch (error) {
    logger.error("decryptDataWithPassword", "Error decrypting data:", error);

    // Rethrow the error with a more specific message
    if (error instanceof Error) {
      throw new Error(`Decryption error: ${error.message}`);
    } else {
      throw new Error("Unknown decryption error occurred");
    }
  }
}

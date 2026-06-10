import { decode, encode } from "@stablelib/base64";
import { BROWSER_CONSTANTS } from "config/constants";
import { logger } from "config/logger";
import * as Keychain from "react-native-keychain";
import QuickCrypto from "react-native-quick-crypto";
import type { CryptoKey } from "react-native-quick-crypto";
import { SCREENSHOT_KEYCHAIN_OPTIONS } from "services/storage/keychainSecurityConfig";

const VERSION_BYTE = 0x01;
const IV_LENGTH = 12;

// Module-level in-flight promise — memoized so concurrent first-use callers
// share one Keychain read/generate instead of racing to create different DEKs.
// Cleared on logout wipe, survives the session.
let dekPromise: Promise<CryptoKey> | null = null;

const importDek = (dekBytes: Uint8Array): Promise<CryptoKey> =>
  QuickCrypto.subtle.importKey(
    "raw",
    dekBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

const generateAndStoreDek = async (): Promise<CryptoKey> => {
  const dekBytes = QuickCrypto.getRandomValues(
    new Uint8Array(32),
  ) as Uint8Array;

  // Persist raw bytes (never the key object itself) to Keychain
  await Keychain.setGenericPassword("screenshot_dek", encode(dekBytes), {
    service: BROWSER_CONSTANTS.SCREENSHOT_DEK_SERVICE,
    ...SCREENSHOT_KEYCHAIN_OPTIONS,
  });

  return importDek(dekBytes);
};

const loadOrGenerateDek = async (): Promise<CryptoKey> => {
  // A Keychain read error must NOT fall through to generation: overwriting
  // an existing DEK would make every stored screenshot permanently
  // undecryptable. Only generate when the read succeeds and finds no entry;
  // on error, throw so encrypt/decrypt fail soft for this render.
  const stored = await Keychain.getGenericPassword({
    service: BROWSER_CONSTANTS.SCREENSHOT_DEK_SERVICE,
  });

  if (stored && stored.password) {
    return importDek(decode(stored.password));
  }

  return generateAndStoreDek();
};

/**
 * Returns the screenshot data-encryption key (DEK), creating and persisting it on first use.
 *
 * Flow: memoized promise → Keychain → generate fresh.
 * The DEK is a random 256-bit key, independent of the wallet derived key.
 * It is stored under a non-biometric Keychain entry so thumbnails render
 * without prompting the user.
 */
export const getOrCreateScreenshotDek = (): Promise<CryptoKey> => {
  if (!dekPromise) {
    dekPromise = loadOrGenerateDek().catch((error) => {
      // Don't cache failures — let the next caller retry
      dekPromise = null;
      throw error;
    });
  }
  return dekPromise;
};

/**
 * Encrypts a screenshot data URI using AES-256-GCM.
 *
 * Returns a base64 string encoding [VERSION(1) | IV(12) | ciphertext+tag].
 * The plaintext never touches disk.
 */
export const encryptScreenshot = async (
  plaintextDataUri: string,
): Promise<string> => {
  const base64Data = plaintextDataUri.includes(",")
    ? plaintextDataUri.split(",")[1]
    : plaintextDataUri;
  const plainBytes = decode(base64Data);

  const key = await getOrCreateScreenshotDek();
  const iv = QuickCrypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await QuickCrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plainBytes,
  );
  const ciphertextBytes = new Uint8Array(ciphertext);

  const packed = new Uint8Array(1 + IV_LENGTH + ciphertextBytes.length);
  packed[0] = VERSION_BYTE;
  packed.set(iv, 1);
  packed.set(ciphertextBytes, 1 + IV_LENGTH);

  return encode(packed);
};

/**
 * Decrypts a screenshot previously encrypted with encryptScreenshot.
 *
 * Returns the plaintext as a "data:image/jpeg;base64,..." URI.
 * Throws on version mismatch, corrupt data, or auth-tag failure.
 */
export const decryptScreenshot = async (
  encryptedBase64: string,
): Promise<string> => {
  const packed = decode(encryptedBase64);

  if (packed[0] !== VERSION_BYTE) {
    throw new Error(`Unknown screenshot encryption version: ${packed[0]}`);
  }

  const iv = packed.slice(1, 1 + IV_LENGTH);
  const ciphertext = packed.slice(1 + IV_LENGTH);

  const key = await getOrCreateScreenshotDek();
  const plainBytes = await QuickCrypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  const plainBase64 = encode(new Uint8Array(plainBytes));
  return `data:image/jpeg;base64,${plainBase64}`;
};

/**
 * Clears the in-memory DEK cache and removes the Keychain entry.
 * Called on wallet wipe (logout with shouldWipeAllData).
 */
export const clearScreenshotDek = async (): Promise<void> => {
  dekPromise = null;
  try {
    await Keychain.resetGenericPassword({
      service: BROWSER_CONSTANTS.SCREENSHOT_DEK_SERVICE,
    });
  } catch (error) {
    logger.error(
      "screenshotCrypto",
      "Failed to clear DEK from Keychain:",
      error,
    );
  }
};

/**
 * Clears the existing DEK and generates a fresh one.
 * Used after migration wipes the old unencrypted screenshot blob.
 */
export const resetScreenshotDek = async (): Promise<CryptoKey> => {
  await clearScreenshotDek();
  return getOrCreateScreenshotDek();
};

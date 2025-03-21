/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/default-param-last */
import {
  encode as base64Encode,
  decode as base64Decode,
} from "@stablelib/base64";
import { encode as utf8Encode, decode as utf8Decode } from "@stablelib/utf8";
import rnScrypt from "react-native-scrypt";
import nacl from "tweetnacl";

export interface EncryptParams {
  phrase: string;
  password: string;

  // these should only be used for testing!
  salt?: string;
  nonce?: Uint8Array;
}

export interface EncryptResponse {
  encryptedPhrase: string;
  salt: string;
}

export interface DecryptParams {
  phrase: string;
  password: string;
  salt: string;
}

export const SALT_BYTES = 32;
export const NONCE_BYTES = nacl.secretbox.nonceLength; // 24 bytes
export const CRYPTO_V1 = 1;
export const CURRENT_CRYPTO_VERSION = CRYPTO_V1;
export const KEY_LEN = nacl.secretbox.keyLength; // 32 bytes

async function scrypt(
  password: any,
  salt: any,
  n: number = 16384,
  r: number = 8,
  p: number = 1,
  dkLen: number = 64,
  callback: (derivedKey?: Uint8Array) => void,
) {
  const derivedKey = await rnScrypt(
    password,
    Array.from(Buffer.from(salt, "utf-8")),
    n,
    r,
    p,
    dkLen,
  );

  callback(Buffer.from(derivedKey, "hex"));
}

/**
 * Convert password from user into a derived key for encryption.
 *
 * @param {string} param.password plaintext password from user
 * @param {string} param.salt salt (should be randomly generated)
 * @param {number} param.dkLen length of the derived key to output
 * @returns {Uint8Array} bytes of the derived key
 */
function scryptPass({
  password,
  salt,
  dkLen = KEY_LEN,
}: {
  password: string;
  salt: string;
  dkLen?: number;
}): Promise<Uint8Array> {
  const [n, r, p] = [32768, 8, 1];

  return new Promise((resolve, reject) => {
    scrypt(password, salt, n, r, p, dkLen, (derivedKey?: Uint8Array) => {
      if (derivedKey) {
        resolve(derivedKey);
      } else {
        reject(new Error("scryptPass failed, derivedKey is null"));
      }
    });
  });
}

function generateSalt(): string {
  return base64Encode(nacl.randomBytes(SALT_BYTES));
}

/**
 * Encrypt a phrase using scrypt.
 *
 * @async
 * @param {Object} params Params object
 * @param {string} params.phrase Phrase to be encrypted
 * @param {string} params.password A password to encrypt the string with.
 * @param {string} [params.salt] A static salt. Use only for unit tests.
 * @param {string} [params.nonce] A static nonce. Use only for unit tests.
 */
export async function encrypt({
  phrase,
  password,
  salt,
  nonce,
}: EncryptParams): Promise<EncryptResponse> {
  const secretboxSalt = salt || generateSalt();

  const secretboxNonce = nonce || nacl.randomBytes(NONCE_BYTES);
  const scryptedPass = await scryptPass({ password, salt: secretboxSalt });
  const textBytes = utf8Encode(phrase);
  const cipherText = nacl.secretbox(textBytes, secretboxNonce, scryptedPass);

  if (!cipherText) {
    throw new Error("Encryption failed");
  }

  // merge these into one array
  // (in a somewhat ugly way, since TS doesn't like destructuring Uint8Arrays)
  const bundle = new Uint8Array(1 + secretboxNonce.length + cipherText.length);
  bundle.set([CURRENT_CRYPTO_VERSION]);
  bundle.set(secretboxNonce, 1);
  bundle.set(cipherText, 1 + secretboxNonce.length);

  return {
    encryptedPhrase: base64Encode(bundle),
    salt: secretboxSalt,
  };
}

export async function decrypt({
  phrase,
  password,
  salt,
}: DecryptParams): Promise<string> {
  const scryptedPass = await scryptPass({ password, salt });

  const bundle = base64Decode(phrase);
  const version = bundle[0];
  let decryptedBytes;

  if (version === CRYPTO_V1) {
    const nonce = bundle.slice(1, 1 + NONCE_BYTES);
    const cipherText = bundle.slice(1 + NONCE_BYTES);
    decryptedBytes = nacl.secretbox.open(cipherText, nonce, scryptedPass);
  } else {
    throw new Error(`Cipher version ${version} not supported.`);
  }

  if (!decryptedBytes) {
    throw new Error("That passphrase wasn’t valid.");
  }

  return utf8Decode(decryptedBytes);
}

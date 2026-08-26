// `crypto` resolves to react-native-crypto on device (package.json
// browser/react-native field maps it) and to Node's built-in crypto under Jest
// (jest.config.js has no override). Both implement HMAC-SHA256 per RFC 2104, so
// the cross-platform vectors below pin the *algorithm*; they do NOT exercise the
// react-native-crypto code path. A device-side vector assertion (PR #865's gated
// E2E) is what proves the on-device library agrees byte-for-byte.
//
// bip39 is a direct dependency on purpose: (1) parity with the extension, which
// derives from `bip39` directly (stellar/freighter#2876), and (2) we need its
// async `mnemonicToSeed` + `validateMnemonic` here. It is pinned to the same
// exact version stellar-hd-wallet resolves transitively.
import { Keypair, xdr } from "@stellar/stellar-sdk";
import { mnemonicToSeed, validateMnemonic } from "bip39";
import { createHmac } from "crypto";

export const AUTH_SALT = "freighter-auth-v1";

/**
 * 32-byte auth seed: HMAC-SHA256(key = 64-byte BIP39 seed, msg = AUTH_SALT).
 * Async so the PBKDF2-HMAC-SHA512 (2048-iteration) seed derivation does not
 * block the JS thread.
 */
export const deriveAuthSeed = async (mnemonic: string): Promise<Buffer> => {
  if (!validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic (see bip39)");
  }
  const seed = await mnemonicToSeed(mnemonic); // 64 bytes, empty passphrase
  return createHmac("sha256", seed).update(AUTH_SALT).digest();
};

/**
 * Derives the backend auth keypair from the wallet mnemonic. Pure crypto — no
 * logging, no keychain, no wallet-signing. The keypair signs per-request JWTs.
 */
export const deriveAuthKeypair = async (
  mnemonic: string,
): Promise<{ userId: string; keypair: Keypair }> => {
  const keypair = Keypair.fromRawEd25519Seed(await deriveAuthSeed(mnemonic));
  // v17: rawPublicKey returns a Uint8Array (not Buffer), whose
  // `toString("hex")` would silently yield comma-joined decimals.
  return { userId: xdr.encodeBytes(keypair.rawPublicKey(), "hex"), keypair };
};

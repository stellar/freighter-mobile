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

/**
 * Versioned domain-separation salt for the backend auth keypair. The `-v1`
 * suffix reserves a migration path; derivation is deterministic, so the auth
 * keypair is permanent for the life of the seed.
 *
 * Both source identities (phrase and account key) use this one salt. The key
 * length gives no domain separation — HMAC-SHA256 zero-pads a 32-byte key — so
 * separation comes from the inputs: a 64-byte BIP39 seed vs a 32-byte ed25519
 * seed. See unified-user-model/v2.md "How the derivation works".
 */
export const AUTH_SALT = "freighter-auth-v1";

/**
 * HMAC-SHA256 keyed on `key`, over AUTH_SALT. The single place the salt is
 * applied, shared by deriveAuthSeed and deriveSourceIdentity so it cannot
 * drift between the two derivations.
 */
const hmacAuthSalt = (key: Uint8Array): Buffer =>
  // Buffer.from copies into a Buffer so a plain Uint8Array (what stellar-sdk
  // v17's rawSecretKey hands us) is accepted by react-native-crypto's HMAC,
  // which expects a Buffer-like key.
  createHmac("sha256", Buffer.from(key)).update(AUTH_SALT).digest();

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
  return hmacAuthSalt(seed);
};

/**
 * Derives the backend auth keypair from the wallet mnemonic. Pure crypto — no
 * logging, no keychain, no wallet-signing. The keypair signs per-request JWTs.
 *
 * Frozen. This is the phrase source identity and the analytics identity of
 * every shipped wallet; its vectors in authKeypairVectors.ts are permanent.
 * deriveSourceIdentity is the counterpart for account secret keys.
 */
export const deriveAuthKeypair = async (
  mnemonic: string,
): Promise<{ userId: string; keypair: Keypair }> => {
  const keypair = Keypair.fromRawEd25519Seed(await deriveAuthSeed(mnemonic));
  // v17: rawPublicKey returns a Uint8Array (not Buffer), whose
  // `toString("hex")` would silently yield comma-joined decimals.
  return { userId: xdr.encodeBytes(keypair.rawPublicKey(), "hex"), keypair };
};

/**
 * Derives the source identity of one account secret key, whether the account
 * was derived from a phrase at m/44'/148'/i' or imported standalone. Both
 * origins reduce to the same 32-byte seed and therefore the same id, which is
 * what lets a wallet that imports one exported account resolve to the phrase's
 * user. Pure crypto, same contract as deriveAuthKeypair.
 *
 * @param seed32 the account's raw 32-byte ed25519 secret seed —
 *               Keypair#rawSecretKey() for an imported key or a phrase-derived
 *               keypair. Throws on any other length: a 64-byte input would
 *               silently produce a phrase id.
 * @returns sourceId lowercase hex Ed25519 public key (64 chars) — the JWT `sub`
 *                   and this source's id in a /user/link consent.
 * @returns keypair  signs the JWT and this source's link consent.
 *
 * Returns a Promise for parity with the extension and deriveAuthKeypair:
 * callers await it and a bad seed rejects rather than throws. The HMAC itself
 * is synchronous here (Node/react-native-crypto), unlike the extension's
 * WebCrypto.
 */
export const deriveSourceIdentity = (
  seed32: Uint8Array,
): Promise<{ sourceId: string; keypair: Keypair }> => {
  if (seed32.length !== 32) {
    return Promise.reject(
      new Error(`Source identity seed must be 32 bytes, got ${seed32.length}`),
    );
  }
  const keypair = Keypair.fromRawEd25519Seed(hmacAuthSalt(seed32));
  return Promise.resolve({
    sourceId: xdr.encodeBytes(keypair.rawPublicKey(), "hex"),
    keypair,
  });
};

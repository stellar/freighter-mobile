// alias → react-native-crypto (pure JS; works in jest & RN)

import { Keypair } from "@stellar/stellar-sdk";
import { mnemonicToSeedSync, validateMnemonic } from "bip39";
import { createHmac } from "crypto";

export const AUTH_SALT = "freighter-auth-v1";

/** 32-byte auth seed: HMAC-SHA256(key = 64-byte BIP39 seed, msg = AUTH_SALT). */
export const deriveAuthSeed = (mnemonic: string): Buffer => {
  if (!validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic (see bip39)");
  }
  const seed = mnemonicToSeedSync(mnemonic); // 64 bytes, empty passphrase
  return createHmac("sha256", seed).update(AUTH_SALT).digest();
};

/**
 * Derives the backend auth keypair from the wallet mnemonic. Pure crypto — no
 * logging, no keychain, no wallet-signing. The keypair signs per-request JWTs.
 */
export const deriveAuthKeypair = (
  mnemonic: string,
): { userId: string; keypair: Keypair } => {
  const keypair = Keypair.fromRawEd25519Seed(deriveAuthSeed(mnemonic));
  return { userId: keypair.rawPublicKey().toString("hex"), keypair };
};

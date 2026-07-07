import { Keypair } from "@stellar/stellar-sdk";
import { getActiveMnemonicPhrase } from "ducks/auth";
import { deriveAuthKeypair } from "services/auth/deriveAuthKeypair";

// In-memory only — never persisted. Freshness is guaranteed by explicit cache
// eviction: clearAuthKeypairCache() is called on logout, soft-lock, and wallet
// import/wipe (via clearAllData in ducks/auth). NOT mnemonic-keyed — sub-account
// switches share one mnemonic and do not clear the cache.
let cache: Keypair | null = null;

export const getAuthKeypair = async (): Promise<Keypair | null> => {
  if (cache) return cache;
  const mnemonic = await getActiveMnemonicPhrase();
  if (!mnemonic) return null;
  const { keypair } = deriveAuthKeypair(mnemonic);
  cache = keypair;
  return keypair;
};

export const clearAuthKeypairCache = (): void => {
  cache = null;
};

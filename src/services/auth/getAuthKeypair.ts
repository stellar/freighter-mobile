import { Keypair } from "@stellar/stellar-sdk";
import { getActiveMnemonicPhrase } from "ducks/auth";
import { deriveAuthKeypair } from "services/auth/deriveAuthKeypair";

// In-memory only — never persisted. Keyed to the mnemonic so an account switch
// / re-import misses the cache. Cleared on logout/lock (see ducks/auth logout).
let cache: { mnemonic: string; keypair: Keypair } | null = null;

export const getAuthKeypair = async (): Promise<Keypair | null> => {
  if (cache) return cache.keypair;
  const mnemonic = await getActiveMnemonicPhrase();
  if (!mnemonic) return null;
  const { keypair } = deriveAuthKeypair(mnemonic);
  cache = { mnemonic, keypair };
  return keypair;
};

export const clearAuthKeypairCache = (): void => {
  cache = null;
};

import { Keypair } from "@stellar/stellar-sdk";
import { AUTH_STATUS } from "config/types";
import { getActiveMnemonicPhrase, useAuthenticationStore } from "ducks/auth";
import { deriveAuthKeypair } from "services/auth/deriveAuthKeypair";

// In-memory only — never persisted. Freshness is guaranteed by explicit cache
// eviction: clearAuthKeypairCache() is called on logout, soft-lock, and wallet
// import/wipe (via clearAllData in ducks/auth). NOT mnemonic-keyed — sub-account
// switches share one mnemonic and do not clear the cache.
//
// Contract: returns null unless the wallet is fully AUTHENTICATED. LOCKED
// (preserved fast-unlock session) and expired/unauthenticated states always
// yield null — even when a warm cache exists — so the per-request JWT is never
// attached outside a fully-unlocked session.
let cache: Keypair | null = null;

export const getAuthKeypair = async (): Promise<Keypair | null> => {
  // Only attach auth for a fully-unlocked (AUTHENTICATED) session. LOCKED
  // (preserved fast-unlock session) and expired/unauthed states must not
  // produce a keypair — and a warm cache must not be served in those states.
  if (
    useAuthenticationStore.getState().authStatus !== AUTH_STATUS.AUTHENTICATED
  ) {
    return null;
  }
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

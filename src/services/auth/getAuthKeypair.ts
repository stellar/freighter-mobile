import { Keypair } from "@stellar/stellar-sdk";
import { logger } from "config/logger";
import { getActiveMnemonicPhrase, isSessionAuthValid } from "ducks/auth";
import {
  getCachedAuthKeypair,
  setCachedAuthKeypair,
} from "services/auth/authKeypairCache";
import { deriveAuthKeypair } from "services/auth/deriveAuthKeypair";

// Dedupe concurrent first-derivations: the balances / prices / history calls
// that fire on unlock would otherwise each run a full PBKDF2 derivation. Shared
// while in flight, then dropped — the warm cache serves everything after.
let inFlight: Promise<Keypair | null> | null = null;

/**
 * Returns the session's backend auth keypair, deriving and caching it on first
 * use. Total: never throws — any failure (keychain read, corrupt hash key,
 * invalid mnemonic) is logged and surfaced as `null` so request-layer callers
 * can fall back to unauthenticated rather than face an unhandled rejection.
 */
export const getAuthKeypair = async (): Promise<Keypair | null> => {
  try {
    // Cheap live-session gate (AUTHENTICATED + hash key present & not expired).
    // Runs on every path as defense-in-depth: it is the only guard on the warm
    // cache, and on the cold path it fails fast before the temp-store decrypt.
    if (!(await isSessionAuthValid())) return null;

    const cached = getCachedAuthKeypair();
    if (cached) return cached;

    if (!inFlight) {
      inFlight = (async () => {
        const mnemonic = await getActiveMnemonicPhrase();
        if (!mnemonic) return null;
        const { keypair } = await deriveAuthKeypair(mnemonic);
        setCachedAuthKeypair(keypair);
        return keypair;
      })();
    }
    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  } catch (error) {
    logger.error("getAuthKeypair", "Failed to derive auth keypair", error);
    return null;
  }
};

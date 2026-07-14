import { Keypair } from "@stellar/stellar-sdk";

// In-memory only — never persisted. Freshness enforced by explicit eviction
// (logout / soft-lock / wipe) plus the AUTHENTICATED+hash-TTL gate in getAuthKeypair.
let cache: Keypair | null = null;

export const getCachedAuthKeypair = (): Keypair | null => cache;
export const setCachedAuthKeypair = (kp: Keypair): void => {
  cache = kp;
};
export const clearAuthKeypairCache = (): void => {
  cache = null;
};

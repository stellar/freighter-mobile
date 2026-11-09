import type { WalletSources } from "services/auth/walletSources";

/*
  Per-unlock cache of the wallet's derived source identities (see
  walletSources.ts). In memory only: the signers are never persisted, and a
  process restart re-derives them on the next call. Every lock, logout and
  wipe path clears it.

  The value is the derivation's promise, so concurrent callers share one
  derivation. The generation is bumped on every clear, so a derivation that
  started before a lock cannot cache its signers after it.
*/
let cache: { key: string; value: Promise<WalletSources> } | null = null;
let generation = 0;

export const getWalletSourcesGeneration = (): number => generation;

/** The cached sources for this cache key, or null when none are cached for it. */
export const getCachedWalletSources = (
  key: string,
): Promise<WalletSources> | null => (cache?.key === key ? cache.value : null);

/** Caches `value` under `key`, unless the cache was cleared since `atGeneration`. */
export const setCachedWalletSources = (
  key: string,
  value: Promise<WalletSources>,
  atGeneration: number,
): void => {
  if (atGeneration === generation) {
    cache = { key, value };
  }
};

/** Drops `value` if it is still the cached entry; a no-op otherwise. */
export const dropCachedWalletSources = (
  value: Promise<WalletSources>,
): void => {
  if (cache?.value === value) {
    cache = null;
  }
};

/** Called on lock: drops the cache and invalidates any derivation in flight. */
export const clearCachedWalletSources = (): void => {
  cache = null;
  generation += 1;
};

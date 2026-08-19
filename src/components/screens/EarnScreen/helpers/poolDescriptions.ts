/**
 * Prose descriptions for the pools we surface, keyed by pool contract address.
 *
 * Hardcoded because the backend's pool catalog carries no description field.
 * Keyed by contract ID rather than shown generically because the copy makes
 * claims that are only true of a specific deployment: the mainnet Fixed pool's
 * admin account is burned (master weight 0, no signers, all thresholds 0), so
 * "no admin" is a fact about that pool, not about Blend pools in general.
 *
 * A pool with no entry renders no description rather than a wrong one.
 *
 * Returns an i18n KEY, not translated prose — copy lives in the translation
 * files like everywhere else in this app (see `src/i18n/locales/*`). The key
 * below (`earnPoolDetails.descriptions.fixedPool`) does not exist there yet;
 * a later task adds it.
 */
const POOL_DESCRIPTION_KEYS: Record<string, string> = {
  // Fixed Pool v2 — mainnet
  CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD:
    "earnPoolDetails.descriptions.fixedPool",
  // Fixed Pool v2 — testnet
  CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF:
    "earnPoolDetails.descriptions.fixedPool",
};

export const getPoolDescriptionKey = (poolId: string): string | null =>
  POOL_DESCRIPTION_KEYS[poolId] ?? null;

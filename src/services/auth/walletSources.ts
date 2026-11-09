import { Keypair } from "@stellar/stellar-sdk";
import { logger } from "config/logger";
import { SecretSourceType } from "config/types";
import { createHash } from "crypto";
import { getHeldSecrets, isSessionAuthValid } from "ducks/auth";
import {
  deriveAuthKeypair,
  deriveSourceIdentity,
} from "services/auth/deriveAuthKeypair";
import {
  dropCachedWalletSources,
  getCachedWalletSources,
  getWalletSourcesGeneration,
  setCachedWalletSources,
} from "services/auth/walletSourcesCache";
import { getHashKey } from "services/storage/helpers";

/*
  Every source identity an unlocked wallet holds, with the keypair that signs
  for it: one `phrase` source per held phrase and one `secret_key` source per
  account whose private key the session holds. See unified-user-model/v2.md
  "Enumerating a wallet's identities".

  An account's source id comes from its secret key alone. deriveSourceIdentity
  returns the same id whether the account was derived or imported, so this
  never reads the account's `sourceId` or `importedFromSecretKey`. A key
  imported on its own that a held phrase also derives is therefore one source.

  The pinned source signs the JWT (see signingIdentity.ts); each source in a
  /user/link body signs its own consent (#67).
*/

export interface WalletSource {
  id: string;
  kind: SecretSourceType;
}

export interface WalletSources {
  sources: WalletSource[];
  signers: Map<string, Keypair>;
}

type HeldSecrets = NonNullable<Awaited<ReturnType<typeof getHeldSecrets>>>;

const empty = (): WalletSources => ({ sources: [], signers: new Map() });

/*
  Derives every source. `complete` is false when any source threw: the set is
  still returned, without that source, but it is not cached, so the next call
  retries instead of hiding the source until the next unlock.
*/
const deriveWalletSources = async (
  { accountIds, privateKeys, mnemonics }: HeldSecrets,
  phraseSigners?: Map<string, Keypair>,
): Promise<{ sources: WalletSources; complete: boolean }> => {
  const result = empty();
  let complete = true;

  const add = (id: string, kind: SecretSourceType, keypair: Keypair) => {
    if (result.signers.has(id)) {
      return;
    }
    result.sources.push({ id, kind });
    result.signers.set(id, keypair);
  };

  // Sequential, so sources come out in a stable order: phrases first, then
  // accounts in list order.
  const inSequence = async <T>(
    items: T[],
    step: (item: T) => Promise<void>,
  ): Promise<void> =>
    items.reduce(
      (previous, item) => previous.then(() => step(item)),
      Promise.resolve(),
    );

  // One PBKDF2 per phrase (mnemonicToSeed); the reason this is cached, and
  // why a keypair the caller already derived is used as is.
  await inSequence(Object.entries(mnemonics), async ([heldId, mnemonic]) => {
    const seeded = phraseSigners?.get(heldId);
    if (seeded) {
      add(heldId, SecretSourceType.PHRASE, seeded);
      return;
    }
    try {
      const { userId, keypair } = await deriveAuthKeypair(mnemonic);
      if (userId !== heldId) {
        logger.error(
          "getWalletSources",
          "Held phrase is stored under a source id it does not derive",
          new Error("Held phrase source id mismatch"),
        );
      }
      add(userId, SecretSourceType.PHRASE, keypair);
    } catch (error) {
      // One unreadable phrase must not hide the wallet's other sources.
      complete = false;
      logger.error(
        "getWalletSources",
        "Failed to derive a phrase source",
        error,
      );
    }
  });

  await inSequence(accountIds, async (accountId) => {
    const secretKey = privateKeys[accountId];
    // signIn loads every missing key into the session, so a gap means that
    // load failed. The held key ids are part of the cache key, so a later
    // fill (the next signIn, or getActiveAccount's lazy load) re-derives.
    if (!secretKey) {
      logger.error(
        "getWalletSources",
        "No private key held for an account",
        new Error("No private key held for an account"),
      );
      return;
    }
    try {
      const { sourceId, keypair } = await deriveSourceIdentity(
        Keypair.fromSecret(secretKey).rawSecretKey(),
      );
      add(sourceId, SecretSourceType.SECRET_KEY, keypair);
    } catch (error) {
      complete = false;
      logger.error(
        "getWalletSources",
        "Failed to derive an account source",
        error,
      );
    }
  });

  return { sources: result, complete };
};

/* SHA-256 hex, so the cache key never holds a copy of the hash key. */
const digest = (str: string): string =>
  createHash("sha256").update(str).digest("hex");

/**
 * The wallet's sources and their signers. Empty unless AUTHENTICATED.
 *
 * Cached in memory against the session's hash key, the account id list, and
 * the ids of the private keys and phrases the session holds. Every lock
 * clears the cache; adding, importing or removing an account or a phrase, or
 * filling a missing private key, changes the key and re-derives.
 *
 * `phraseSigners` holds phrase keypairs the caller already derived, by source
 * id. signIn passes the ones it derived, so a phrase is derived once per
 * unlock.
 */
export const getWalletSources = async ({
  phraseSigners,
}: { phraseSigners?: Map<string, Keypair> } = {}): Promise<WalletSources> => {
  // Read before the first await: a lock that lands anywhere after this point
  // must stop the result from being cached.
  const generation = getWalletSourcesGeneration();

  if (!(await isSessionAuthValid())) {
    return empty();
  }

  const [hashKey, held] = await Promise.all([getHashKey(), getHeldSecrets()]);
  if (!hashKey || !held) {
    return empty();
  }

  const cacheKey = digest(
    JSON.stringify([
      hashKey.hashKey,
      held.accountIds,
      Object.keys(held.privateKeys).sort(),
      Object.keys(held.mnemonics).sort(),
    ]),
  );

  const cached = getCachedWalletSources(cacheKey);
  if (cached) {
    return cached;
  }

  const pending: Promise<WalletSources> = deriveWalletSources(
    held,
    phraseSigners,
  ).then(
    ({ sources, complete }) => {
      // A lock landed mid-derivation: hand back nothing from the ended session.
      if (generation !== getWalletSourcesGeneration()) {
        return empty();
      }
      if (!complete) {
        dropCachedWalletSources(pending);
      }
      return sources;
    },
    (error: unknown) => {
      dropCachedWalletSources(pending);
      throw error;
    },
  );
  setCachedWalletSources(cacheKey, pending, generation);

  return pending;
};

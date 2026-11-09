import { STORAGE_KEYS } from "config/constants";
import { getLinkStatusEpoch } from "services/auth/linkStatus";
import { dataStorage } from "services/storage/storageFactory";

/*
  The user id the server last returned for this wallet (#69): the cluster's
  canonical source id, its root. It is the analytics id. Persisted in PLAIN
  storage so a locked wallet still attributes events: like a source id, it is
  a one-way hash and cannot be linked back to a G address.

  For a phrase wallet it equals the phrase's source id, the value already in
  METRICS_USER_ID. It differs from the pinned source only when the wallet
  resolved to an existing user through a key, and only the server knows it
  then.

  It shares the link-status epoch. clearLinkStatus removes it with the link
  map whenever the wallet is replaced, and a response that started before
  the replacement is dropped.
*/

export const getCachedCanonicalUserId = async (): Promise<string | null> => {
  const id = await dataStorage.getItem(STORAGE_KEYS.CANONICAL_USER_ID);

  return id || null;
};

/**
 * Stores the server's user id, overwriting any earlier one. A no-op, and
 * false, when the wallet was replaced since `epoch` was read. Also false when
 * the replacement lands during the write.
 */
export const setCachedCanonicalUserId = async ({
  userId,
  epoch,
}: {
  userId: string;
  epoch: number;
}): Promise<boolean> => {
  if (epoch !== getLinkStatusEpoch()) {
    return false;
  }
  await dataStorage.setItem(STORAGE_KEYS.CANONICAL_USER_ID, userId);
  // A replacement during the write: the id is the old wallet's, and the
  // remove clearLinkStatus queued after this write deletes it.
  return epoch === getLinkStatusEpoch();
};

/* A source id: a lowercase hex Ed25519 public key. */
const SOURCE_ID_PATTERN = /^[0-9a-f]{64}$/;

/**
 * The `data.userId` of a /user or /user/link response, or null. Null also
 * when it isn't a source id: the id is cached until the wallet is replaced,
 * so a malformed 200 (a proxy, a server bug) would otherwise stick.
 */
export const userIdOf = (body: unknown): string | null => {
  const userId = (body as { data?: { userId?: unknown } } | null)?.data?.userId;
  return typeof userId === "string" && SOURCE_ID_PATTERN.test(userId)
    ? userId
    : null;
};

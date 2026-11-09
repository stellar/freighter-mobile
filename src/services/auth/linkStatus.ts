import { STORAGE_KEYS } from "config/constants";
import { dataStorage } from "services/storage/storageFactory";

/*
  What the server last said about each source, keyed by source id and
  persisted in PLAIN storage (#68). A source id is a one-way hash, not a key,
  and the status carries no secret.

  "linked": the server listed the source in the caller's cluster.
  "conflict": the source belongs to another user. It stays there (v2
  "Resolution"), so sending it again only gets the same answer back.

  A source with no entry has not been confirmed yet. The linker sends every
  such source on the next trigger, which is the retry for an offline first
  run. An entry is written only after a successful response, never by the
  install-time migration. Removing an account removes no source, so nothing
  here is cleared on removal.

  Replacing the wallet (sign up over it, import, wipe) clears the map and
  moves the epoch. A pass that started before the clear may still get a
  response afterwards; recordLinkResults drops it, so the replaced wallet's
  answers never land in the new wallet's map.
*/

export type LinkStatus = "linked" | "conflict";
type LinkStatusMap = Record<string, LinkStatus>;

const getMap = async (): Promise<LinkStatusMap> => {
  const raw = await dataStorage.getItem(STORAGE_KEYS.SOURCE_LINK_STATUS);

  return raw ? (JSON.parse(raw) as LinkStatusMap) : {};
};

let epoch = 0;

/** Read before a pass starts; pass the value to recordLinkResults. */
export const getLinkStatusEpoch = (): number => epoch;

export const getLinkStatus = (): Promise<LinkStatusMap> => getMap();

/** The source ids the server reported as belonging to another user. */
export const getLinkConflicts = async (): Promise<string[]> =>
  Object.entries(await getMap())
    .filter(([, status]) => status === "conflict")
    .map(([id]) => id);

/**
 * Merges one response into the stored map. Entries from earlier calls are
 * kept. A no-op when both lists are empty, or when the map was cleared since
 * `epoch` was read. Returns false only in that last case.
 */
export const recordLinkResults = async ({
  linked,
  conflicts,
  epoch: readAt,
}: {
  linked: string[];
  conflicts: string[];
  epoch: number;
}): Promise<boolean> => {
  if (readAt !== epoch) {
    return false;
  }
  if (!linked.length && !conflicts.length) {
    return true;
  }
  const map = await getMap();
  // The read above awaited; a clear may have landed during it.
  if (readAt !== epoch) {
    return false;
  }
  linked.forEach((id) => {
    map[id] = "linked";
  });
  conflicts.forEach((id) => {
    map[id] = "conflict";
  });
  await dataStorage.setItem(
    STORAGE_KEYS.SOURCE_LINK_STATUS,
    JSON.stringify(map),
  );
  return true;
};

/** For a wallet replacement, which replaces every source the wallet holds. */
export const clearLinkStatus = async (): Promise<void> => {
  epoch += 1;
  // The cached user id (canonicalUserId.ts) belongs to the old wallet too.
  await dataStorage.remove([
    STORAGE_KEYS.SOURCE_LINK_STATUS,
    STORAGE_KEYS.CANONICAL_USER_ID,
  ]);
};

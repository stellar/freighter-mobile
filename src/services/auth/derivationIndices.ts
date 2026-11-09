import { STORAGE_KEYS } from "config/constants";
import { dataStorage } from "services/storage/storageFactory";

/*
  The derivation indices each seed phrase has in use, keyed by the phrase's
  source id, persisted in PLAIN storage beside `secretSources`. An index is not
  secret, and plain storage is what lets an install-time migration seed an
  existing phrase's set with no password.

  A new account on a phrase takes that phrase's lowest unused index, so every
  phrase derives from 0 upward on its own. An index is marked the moment its
  keystore exists (`storeAccount`, network account discovery). Nothing releases
  one yet: the only removal today is the full wipe, which clears the whole map
  with the rest of the non-sensitive keys. Once per-account removal lands (#57)
  it will call `releaseDerivationIndex`, so re-adding a removed account
  re-derives the same key. Secret-key sources have no indices and never get an
  entry.
*/

type DerivationIndexMap = Record<string, number[]>;

const getMap = async (): Promise<DerivationIndexMap> => {
  const raw = await dataStorage.getItem(STORAGE_KEYS.DERIVATION_INDICES);

  return raw ? (JSON.parse(raw) as DerivationIndexMap) : {};
};

const setMap = (map: DerivationIndexMap): Promise<void> =>
  dataStorage.setItem(STORAGE_KEYS.DERIVATION_INDICES, JSON.stringify(map));

/** The lowest non-negative integer not in `indices`. */
export const lowestUnusedIndex = (indices: number[]): number => {
  const used = new Set(indices);
  let index = 0;
  while (used.has(index)) {
    index += 1;
  }
  return index;
};

export const getDerivationIndices = async (
  sourceId: string,
): Promise<number[]> => (await getMap())[sourceId] || [];

/**
 * The index a new account on `sourceId` should take: the lowest one neither
 * marked used nor in `exclude`. `exclude` holds a caller's run-local
 * reservations (indices derived but not yet stored), so one run never hands
 * the same index out twice.
 */
export const nextDerivationIndex = async ({
  sourceId,
  exclude,
}: {
  sourceId: string;
  exclude?: Set<number>;
}): Promise<number> =>
  lowestUnusedIndex([
    ...(await getDerivationIndices(sourceId)),
    ...(exclude ?? []),
  ]);

/** Marks `index` used for `sourceId`. Idempotent; the set stays sorted. */
export const markDerivationIndexUsed = async ({
  sourceId,
  index,
}: {
  sourceId: string;
  index: number;
}): Promise<void> => {
  const map = await getMap();
  const indices = map[sourceId] || [];

  if (indices.includes(index)) {
    return;
  }

  await setMap({
    ...map,
    [sourceId]: [...indices, index].sort((a, b) => a - b),
  });
};

/** Frees `index` on `sourceId` so the next add re-derives it. */
export const releaseDerivationIndex = async ({
  sourceId,
  index,
}: {
  sourceId: string;
  index: number;
}): Promise<void> => {
  const map = await getMap();
  const indices = map[sourceId];

  if (!indices || !indices.includes(index)) {
    return;
  }

  await setMap({
    ...map,
    [sourceId]: indices.filter((i) => i !== index),
  });
};

export const clearDerivationIndices = async (): Promise<void> => {
  await dataStorage.remove(STORAGE_KEYS.DERIVATION_INDICES);
};

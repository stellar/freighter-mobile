import { NATIVE_TOKEN_CODE, STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { FormattedSearchTokenRecord, HiddenTokenStorage } from "config/types";
import { dataStorage } from "services/storage/storageFactory";

/**
 * Reads the hidden token storage, or an empty object when nothing is stored
 * or the stored value cannot be parsed.
 */
export const getHiddenTokenStorage = async (): Promise<HiddenTokenStorage> => {
  const storageData = await dataStorage.getItem(STORAGE_KEYS.HIDDEN_TOKEN_LIST);

  if (!storageData) {
    return {};
  }

  try {
    return JSON.parse(storageData) as HiddenTokenStorage;
  } catch (error) {
    logger.error(
      "getHiddenTokenStorage",
      "Error parsing hidden token storage",
      error,
    );
    return {};
  }
};

/**
 * Persists the hidden token storage.
 */
export const saveHiddenTokenStorage = async (
  storage: HiddenTokenStorage,
): Promise<void> => {
  await dataStorage.setItem(
    STORAGE_KEYS.HIDDEN_TOKEN_LIST,
    JSON.stringify(storage),
  );
};

/**
 * Returns the hidden token identifiers for an account on a network. Never
 * throws: a storage failure reads as "nothing hidden" so balances still load.
 */
export const retrieveHiddenTokens = async (params: {
  network: string;
  publicKey: string;
}): Promise<string[]> => {
  const { network, publicKey } = params;

  try {
    const storage = await getHiddenTokenStorage();
    return storage?.[publicKey]?.[network] ?? [];
  } catch (error) {
    logger.error(
      "retrieveHiddenTokens",
      "Error retrieving hidden tokens:",
      error,
    );
    return [];
  }
};

/**
 * Adds a token identifier to the hidden list for an account on a network.
 * Adding an identifier that is already hidden is a no-op.
 *
 * @throws when the storage write fails, so callers can report the failure
 */
export const addHiddenTokenToStorage = async (params: {
  network: string;
  publicKey: string;
  tokenId: string;
}): Promise<void> => {
  const { network, publicKey, tokenId } = params;

  try {
    const storage = await getHiddenTokenStorage();

    if (!storage[publicKey]) {
      storage[publicKey] = {};
    }

    if (!storage[publicKey][network]) {
      storage[publicKey][network] = [];
    }

    if (!storage[publicKey][network].includes(tokenId)) {
      storage[publicKey][network].push(tokenId);
    }

    await saveHiddenTokenStorage(storage);
  } catch (error) {
    logger.error(
      "addHiddenTokenToStorage",
      "Error adding hidden token to storage",
      error,
    );
    throw error;
  }
};

/**
 * Removes a token identifier from the hidden list for an account on a
 * network, cleaning up empty network and account entries. Removing an
 * identifier that is not hidden is a no-op.
 *
 * @throws when the storage write fails, so callers can report the failure
 */
export const removeHiddenTokenFromStorage = async (params: {
  network: string;
  publicKey: string;
  tokenId: string;
}): Promise<void> => {
  const { network, publicKey, tokenId } = params;

  try {
    const storage = await getHiddenTokenStorage();
    const hiddenTokens = storage[publicKey]?.[network];

    if (!hiddenTokens?.includes(tokenId)) {
      return;
    }

    const remaining = hiddenTokens.filter((id) => id !== tokenId);

    if (remaining.length > 0) {
      storage[publicKey][network] = remaining;
    } else {
      delete storage[publicKey][network];

      if (Object.keys(storage[publicKey]).length === 0) {
        delete storage[publicKey];
      }
    }

    await saveHiddenTokenStorage(storage);
  } catch (error) {
    logger.error(
      "removeHiddenTokenFromStorage",
      "Error removing hidden token from storage",
      error,
    );
    throw error;
  }
};

/**
 * Builds the balance identifier a search result would have in the balances
 * map, so a search row can be matched against the hidden list.
 */
export const getSearchTokenRecordId = (
  token: Pick<FormattedSearchTokenRecord, "tokenCode" | "issuer" | "isNative">,
): string =>
  token.isNative ? NATIVE_TOKEN_CODE : `${token.tokenCode}:${token.issuer}`;

/**
 * Reports whether a search row should offer Unhide: the account holds the
 * token and has hidden it.
 *
 * A flag for a token the account no longer holds (its trustline removed
 * elsewhere) shows Add instead, and adding the token clears the flag.
 */
export const shouldOfferUnhide = (
  token: Pick<
    FormattedSearchTokenRecord,
    "tokenCode" | "issuer" | "isNative" | "hasTrustline"
  >,
  hiddenTokenIds: string[],
): boolean =>
  token.hasTrustline && hiddenTokenIds.includes(getSearchTokenRecordId(token));

import { logger } from "config/logger";
import { dataStorage } from "services/storage/storageFactory";

export const cachedFetch = async <T>(
  url: string,
  storageKey: string,
  options?: RequestInit,
): Promise<T> => {
  const cachedDateId = `${storageKey}_date`;

  const cachedDateStr = await dataStorage.getItem(cachedDateId);
  const cachedDate = Number(cachedDateStr || "0");
  const date = new Date();
  const time = date.getTime();
  const sevenDaysAgo = time - 7 * 24 * 60 * 60 * 1000;

  let directoryLookup = await dataStorage.getItem(storageKey);

  if (typeof directoryLookup === "string") {
    try {
      const directoryLookupJSON = JSON.parse(directoryLookup);
      directoryLookup = directoryLookupJSON;
    } catch (e) {
      logger.error("cachedFetch", "JSON parse error", {
        error: e as string,
      });
    }
  }

  if (cachedDate < sevenDaysAgo || !directoryLookup) {
    try {
      const res = await fetch(url, options);
      directoryLookup = await res.json();

      await dataStorage.setItem(storageKey, JSON.stringify(directoryLookup));
      await dataStorage.setItem(cachedDateId, time.toString());
    } catch (e) {
      logger.error("cachedFetch", "Error fetching data", {
        error: e as string,
      });
    }
  }

  return directoryLookup as T;
};

import { logger } from "config/logger";
import { dataStorage } from "services/storage/storageFactory";

/**
 * Default TTL in milliseconds (7 days)
 */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Options for cached fetch
 */
export interface CachedFetchOptions<T> {
  urlOrFn: string | (() => Promise<T>);
  storageKey: string;
  ttlMs?: number;
  options?: RequestInit;
  forceRefresh?: boolean;
}

/**
 * Caches the result of a fetch request or async function
 *
 * @example
 * // URL-based
 * const result = await cachedFetch({
 *   urlOrFn: "https://api.example.com/data",
 *   storageKey: "my-cache-key",
 *   ttlMs: 30 * 60 * 1000, // 30 minutes
 * });
 *
 * @example
 * // Function-based
 * const result = await cachedFetch({
 *   urlOrFn: () => fetchData(),
 *   storageKey: "my-cache-key",
 *   ttlMs: 30 * 60 * 1000,
 *   forceRefresh: false,
 * });
 */
export async function cachedFetch<T>(
  options: CachedFetchOptions<T>,
): Promise<T> {
  const {
    storageKey,
    urlOrFn,
    ttlMs,
    options: fetchOptions,
    forceRefresh,
  } = options;
  const cachedDateId = `${storageKey}_date`;

  const cachedDateStr = await dataStorage.getItem(cachedDateId);
  const cachedDate = Number(cachedDateStr || "0");
  const date = new Date();
  const time = date.getTime();

  // Determine if this is URL mode or function mode
  const isUrlMode = typeof urlOrFn === "string";

  // Extract parameters
  const ttl = ttlMs ?? DEFAULT_TTL_MS;
  const shouldForceRefresh = forceRefresh ?? false;

  const cacheExpiryTime = time - ttl;

  let cachedResult: T | null = null;
  const cachedResultStr = await dataStorage.getItem(storageKey);

  if (typeof cachedResultStr === "string") {
    try {
      const cachedResultJSON = JSON.parse(cachedResultStr);
      cachedResult = cachedResultJSON as T;
    } catch (e) {
      logger.error("cachedFetch", "JSON parse error", e);
    }
  }

  if (shouldForceRefresh || cachedDate < cacheExpiryTime || !cachedResult) {
    try {
      if (isUrlMode) {
        // URL mode: fetch from URL
        const res = await fetch(urlOrFn, fetchOptions);
        cachedResult = (await res.json()) as T;
      } else {
        // Function mode: call the function
        cachedResult = await urlOrFn();
      }

      await dataStorage.setItem(storageKey, JSON.stringify(cachedResult));
      await dataStorage.setItem(cachedDateId, time.toString());
    } catch (e) {
      logger.error("cachedFetch", "Error fetching data", e);
      // If there's an error and we have cached data, return it (only for function mode)
      if (!isUrlMode && cachedResult) {
        return cachedResult;
      }
      // For URL mode, re-throw the error to maintain backward compatibility
      throw e;
    }
  }

  return cachedResult;
}

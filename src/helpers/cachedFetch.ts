import { logger } from "config/logger";
import { dataStorage } from "services/storage/storageFactory";

/**
 * Default TTL in milliseconds (7 days)
 */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

  const isUrlMode = typeof urlOrFn === "string";

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
        const res = await fetch(urlOrFn, fetchOptions);
        cachedResult = (await res.json()) as T;
      } else {
        cachedResult = await urlOrFn();
      }

      await dataStorage.setItem(storageKey, JSON.stringify(cachedResult));
      await dataStorage.setItem(cachedDateId, time.toString());
    } catch (e) {
      logger.error("cachedFetch", "Error fetching data", e);
      // Graceful degradation only when the caller didn't explicitly ask
      // for fresh data. Pull-to-refresh and other forceRefresh paths
      // need to see the failure (e.g. to show a "couldn't refresh"
      // toast) — silently returning the stale cache there contradicts
      // the user's intent.
      if (!isUrlMode && cachedResult && !shouldForceRefresh) {
        return cachedResult;
      }
      // For URL mode, re-throw the error to maintain backward compatibility
      throw e;
    }
  }

  return cachedResult;
}

/**
 * Read a cached value WITHOUT triggering a fetch. Returns the parsed
 * payload + its age in ms, or null when no cache exists / the data is
 * unparseable.
 *
 * Caller decides whether the value is stale (typically: `age > ttlMs`).
 * Used by stores that need to support stale-while-revalidate semantics —
 * render the cached value, then fire `cachedFetch({ forceRefresh: true })`
 * in the background.
 *
 * @example
 * const cached = await readCachedValue<MyType>("my-cache-key");
 * if (cached) {
 *   render(cached.data);
 *   if (cached.age > TTL) {
 *     // fire-and-forget background refresh
 *     cachedFetch({ ..., forceRefresh: true }).then(render);
 *   }
 * }
 */
export async function readCachedValue<T>(
  storageKey: string,
): Promise<{ data: T; age: number } | null> {
  const cachedDateId = `${storageKey}_date`;
  const cachedDateStr = await dataStorage.getItem(cachedDateId);
  if (!cachedDateStr) return null;
  const cachedDate = Number(cachedDateStr);
  if (!Number.isFinite(cachedDate) || cachedDate === 0) return null;

  const cachedResultStr = await dataStorage.getItem(storageKey);
  if (typeof cachedResultStr !== "string") return null;

  try {
    const data = JSON.parse(cachedResultStr) as T;
    return { data, age: Date.now() - cachedDate };
  } catch (e) {
    logger.error("readCachedValue", "JSON parse error", e);
    return null;
  }
}

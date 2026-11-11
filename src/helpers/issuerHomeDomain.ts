import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { getAccount } from "services/stellar";

/**
 * Session cache of issuer -> `home_domain`, keyed by network: the About card
 * remounts on every detail visit, and without this each paid a Horizon round
 * trip. A resolved account with no domain caches as null (a real answer);
 * failures are NOT cached, so one outage cannot hide the row all session.
 */
const domainCache = new Map<string, string | null>();
/** In-flight lookups, so concurrent mounts coalesce into one request. */
const inFlight = new Map<string, Promise<string | null>>();

const cacheKey = (issuer: string, network: NETWORKS): string =>
  `${network}:${issuer}`;

/**
 * Resolves a classic issuer's Horizon `home_domain`, cached for the session.
 * Returns null when the account has no domain or the lookup fails — the row
 * simply stays hidden, which is why a failure is only debug-logged.
 */
export const getIssuerHomeDomain = async (
  issuer: string,
  network: NETWORKS,
): Promise<string | null> => {
  const key = cacheKey(issuer, network);

  if (domainCache.has(key)) {
    return domainCache.get(key) ?? null;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const request = getAccount(issuer, network)
    .then((account) => {
      // `getAccount` swallows every Horizon failure and resolves null, so a
      // null account is "we could not ask", not "this issuer has no domain".
      // Caching it would hide the Domain row for the rest of the session on
      // one transient outage; leaving it uncached costs a retry next mount.
      if (!account) {
        return null;
      }

      const homeDomain = account.home_domain ?? null;
      domainCache.set(key, homeDomain);
      return homeDomain;
    })
    .catch((error) => {
      // Row simply stays hidden; debug-level visibility is enough for a
      // cosmetic metadata lookup.
      logger.debug(
        "issuerHomeDomain",
        "Failed to load issuer home_domain",
        error,
      );
      return null;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);

  return request;
};

/** Test seam: drops the session cache so suites don't leak into each other. */
export const clearIssuerHomeDomainCache = (): void => {
  domainCache.clear();
  inFlight.clear();
};

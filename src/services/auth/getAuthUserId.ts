import { logger } from "config/logger";
import { createApiService, isApiError } from "services/apiFactory";
import {
  getCachedCanonicalUserId,
  setCachedCanonicalUserId,
  userIdOf,
} from "services/auth/canonicalUserId";
import { getLinkStatusEpoch } from "services/auth/linkStatus";
import { getPinnedSourceId } from "services/auth/secretSources";
import { getSigningIdentity } from "services/auth/signingIdentity";

type UserApi = Pick<ReturnType<typeof createApiService>, "get">;

export interface AuthUserId {
  analyticsUserId: string | null;
  /**
   * True when the id is the server's canonical id. False when it is the
   * pinned source id standing in until the first link, or null.
   */
  isConfirmed: boolean;
}

// Required lazily, as in linkSources: services/backend reads
// config/envConfig at import time.
const defaultApi = (): UserApi => {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */
  const { freighterBackendV2 } =
    require("services/backend") as typeof import("services/backend");
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */
  return freighterBackendV2;
};

/**
 * The analytics user id: the canonical source id GET /api/v1/user returns
 * for the wallet's cluster (#69).
 *
 * - Cached: return it. No derivation, no request, and it works while locked.
 * - Unlocked, not cached: ask the server and cache a 200. Until the source
 *   is linked (404) or while the server can't be reached, return the pinned
 *   source id, unconfirmed and uncached, so the caller asks again later.
 * - Signer is not the pin (getSigningIdentity fell back to another held
 *   source): no request. GET /user would resolve that source's user, which
 *   may be someone else's, and the cache would keep it for good. Return the
 *   pin, unconfirmed and uncached.
 * - Wallet replaced during the cache read or the request: null. The cached
 *   and pinned source ids are the old wallet's.
 * - Locked with nothing cached: null.
 *
 * Never returns or exposes the private keypair.
 */
export const getAuthUserId = async ({
  api,
}: {
  /** Injectable for tests; defaults to freighterBackendV2. */
  api?: UserApi;
} = {}): Promise<AuthUserId> => {
  const epoch = getLinkStatusEpoch();
  const cached = await getCachedCanonicalUserId();
  // A wallet replaced during the read: the cached id is the old wallet's.
  if (epoch !== getLinkStatusEpoch()) {
    return { analyticsUserId: null, isConfirmed: false };
  }
  if (cached) {
    return { analyticsUserId: cached, isConfirmed: true };
  }

  const identity = await getSigningIdentity();
  if (!identity) {
    return { analyticsUserId: null, isConfirmed: false };
  }

  // Read after getSigningIdentity, which writes the pin when none is set.
  const pinned = await getPinnedSourceId();
  if (identity.sourceId !== pinned) {
    // A fallback signer: GET /user would answer for its user, and a cached
    // answer is permanent. Skip the request; the next ask retries.
    if (epoch !== getLinkStatusEpoch()) {
      return { analyticsUserId: null, isConfirmed: false };
    }
    return { analyticsUserId: pinned ?? identity.sourceId, isConfirmed: false };
  }

  try {
    const { data } = await (api ?? defaultApi()).get<unknown>("/user");
    const userId = userIdOf(data);
    // A wallet replaced mid-request: this id is the old wallet's.
    if (userId && (await setCachedCanonicalUserId({ userId, epoch }))) {
      return { analyticsUserId: userId, isConfirmed: true };
    }
  } catch (error) {
    // A 404 means the source isn't linked yet. A network failure (offline)
    // isn't logged either: every unlock and foreground asks again until the
    // id is confirmed, so it would log on each one.
    const expected =
      isApiError(error) && (error.status === 404 || error.isNetworkError);
    if (!expected) {
      logger.error("getAuthUserId", "GET /user failed", error);
    }
  }

  // A wallet replaced mid-request: the pinned source is the old wallet's.
  if (epoch !== getLinkStatusEpoch()) {
    return { analyticsUserId: null, isConfirmed: false };
  }
  return { analyticsUserId: identity.sourceId, isConfirmed: false };
};

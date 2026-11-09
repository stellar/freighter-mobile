import { logger } from "config/logger";
import type { createApiService } from "services/apiFactory";
import {
  setCachedCanonicalUserId,
  userIdOf,
} from "services/auth/canonicalUserId";
import {
  getLinkStatus,
  getLinkStatusEpoch,
  recordLinkResults,
} from "services/auth/linkStatus";
import { buildUserLinkRequest, signUserLinkBody } from "services/auth/userLink";
import { UserLinkBody } from "services/auth/userLinkConsent";

/*
  Sends POST /api/v1/user/link for every held source the server has not
  confirmed yet (#68). Sign up, import, every source add and every unlock
  call this. A source with a stored status is left out, so once every source
  is settled a trigger sends nothing.

  Nothing here throws or reaches the caller. A failed call stores nothing,
  and the next trigger (at the latest, the next unlock) sends the same
  sources again. That is the retry for an install that was offline through
  onboarding.
*/

type LinkApi = Pick<ReturnType<typeof createApiService>, "post">;

export interface LinkWalletSourcesParams {
  /** Injectable for tests; defaults to freighterBackendV2. */
  api?: LinkApi;
  /** Injectable clock in ms epoch; read once per body. Defaults to Date.now. */
  clock?: () => number;
}

const LINK_PATH = "/user/link";

// The server wraps every body in `data`.
interface UserLinkResponse {
  data?: { sources?: unknown; conflicts?: unknown; userId?: unknown };
}

const MALFORMED_RESPONSE = "Malformed /user/link response";

/** Both lists are always present on a 2xx, `conflicts` empty or not. */
const isUserLinkResponse = (
  response: unknown,
): response is { data: { sources: unknown[]; conflicts: unknown[] } } => {
  const data = (response as UserLinkResponse | null)?.data;
  return Array.isArray(data?.sources) && Array.isArray(data?.conflicts);
};

const idsOf = (list: unknown[], key?: "id"): Set<string> => {
  const ids = new Set<string>();
  list.forEach((entry: unknown) => {
    const id = key ? (entry as { id?: unknown } | null)?.id : entry;
    if (typeof id === "string") {
      ids.add(id);
    }
  });
  return ids;
};

/*
  freighterBackendV2 and issuedAtSeconds are required lazily, the same way
  attachAuth requires its dependencies: ducks/auth imports this module, and
  both of theirs do work at import time (services/backend reads
  config/envConfig, buildAuthJwt encodes its JWT header with the SDK), which
  would otherwise run in every test that loads the duck.
*/
const defaultApi = (): LinkApi => {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */
  const { freighterBackendV2 } =
    require("services/backend") as typeof import("services/backend");
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */
  return freighterBackendV2;
};

const iatOf = (now: number): number => {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */
  const { issuedAtSeconds } =
    require("services/auth/buildAuthJwt") as typeof import("services/auth/buildAuthJwt");
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */
  return issuedAtSeconds(now);
};

/**
 * One POST. True when the server answered 2xx and the result was stored;
 * false on an error status, a network failure, or when the wallet was
 * replaced mid-request.
 */
const sendBody = async ({
  api,
  body,
  now,
  epoch,
}: {
  api: LinkApi;
  body: UserLinkBody;
  now: number;
  epoch: number;
}): Promise<boolean> => {
  let data: UserLinkResponse | null;
  try {
    // The consents are bound to this JWT's iat, so a 401 retry under a new
    // iat would fail too. The next trigger re-signs the bodies instead.
    ({ data } = await api.post<UserLinkResponse | null>(LINK_PATH, body, {
      authNow: now,
      authRetryOnUnauthorized: false,
    }));
  } catch (error) {
    // An error status and a network failure (offline) both land here.
    logger.error("linkWalletSources", "/user/link failed", error);
    return false;
  }

  // A 2xx we can't read breaks the API contract: alert, store nothing, and
  // stop the pass the same as a failed call. The next trigger resends.
  if (!isUserLinkResponse(data)) {
    logger.error(
      "linkWalletSources",
      MALFORMED_RESPONSE,
      new Error(`${MALFORMED_RESPONSE}: missing sources or conflicts`),
    );
    return false;
  }

  const members = idsOf(data.data.sources, "id");
  const conflicts = idsOf(data.data.conflicts);
  const sent = body.sources.map(({ id }) => id);

  // Only ids this body carried. A sent id the server reports neither way
  // also breaks the contract: alert, and leave it unsettled so it goes out
  // again on the next trigger. The ids it did report are still stored.
  const unaccounted = sent.filter(
    (id) => !members.has(id) && !conflicts.has(id),
  ).length;
  if (unaccounted) {
    logger.error(
      "linkWalletSources",
      MALFORMED_RESPONSE,
      new Error(
        `${MALFORMED_RESPONSE}: ${unaccounted} of ${sent.length} sources unreported`,
      ),
    );
  }
  const recorded = await recordLinkResults({
    linked: sent.filter((id) => members.has(id) && !conflicts.has(id)),
    conflicts: sent.filter((id) => conflicts.has(id)),
    epoch,
  });
  // The response names the caller's user, so the analytics id (#69) is
  // settled here without waiting for the next GET /user.
  const userId = userIdOf(data);
  if (recorded && userId) {
    await setCachedCanonicalUserId({ userId, epoch });
  }
  return recorded;
};

const linkOnce = async ({
  api,
  clock = Date.now,
}: LinkWalletSourcesParams): Promise<void> => {
  try {
    // Read before anything else: a wallet replacement from here on discards
    // this pass's results, and the pass it queues starts over.
    const epoch = getLinkStatusEpoch();
    const settled = new Set(Object.keys(await getLinkStatus()));
    const request = await buildUserLinkRequest({ linkedIds: settled });
    if (!request) {
      return;
    }
    const target = api ?? defaultApi();

    // One body at a time, in order: each waits for the previous answer.
    const sendFrom = async (index: number): Promise<void> => {
      const batch = request.batches[index];
      if (!batch || getLinkStatusEpoch() !== epoch) {
        // Done, or the wallet these bodies came from has been replaced.
        return;
      }
      // Sign each body just before its call: a JWT lives 15 seconds, and a
      // slow earlier call would expire an iat taken at the start of the pass.
      const now = clock();
      const body = signUserLinkBody({
        identity: request.identity,
        signers: request.signers,
        batch,
        iat: iatOf(now),
      });
      // Stop at the first failure: the rest would most likely fail the same
      // way, and the next trigger sends them anyway.
      if (await sendBody({ api: target, body, now, epoch })) {
        await sendFrom(index + 1);
      }
    };
    await sendFrom(0);
  } catch (error) {
    logger.error("linkWalletSources", "Failed to link wallet sources", error);
  }
};

let inFlight: Promise<void> | null = null;
let rerunWith: LinkWalletSourcesParams | null = null;

/**
 * Links every unsettled source. Calls that overlap a run in flight don't
 * start a second request. They queue one more pass for after it, so a source
 * added mid-run still goes out. The returned promise settles after every
 * queued pass and never rejects.
 */
export const linkWalletSources = (
  params: LinkWalletSourcesParams = {},
): Promise<void> => {
  if (inFlight) {
    rerunWith = params;
    return inFlight;
  }
  const run = async (next: LinkWalletSourcesParams): Promise<void> => {
    rerunWith = null;
    await linkOnce(next);
    const queued = rerunWith as LinkWalletSourcesParams | null;
    if (queued) {
      await run(queued);
    }
  };
  inFlight = run(params).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

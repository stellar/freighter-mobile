import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "config/logger";
import { updateSentryContext } from "config/sentryConfig";
import { analytics } from "services/analytics";
import { STORAGE_KEYS, DEBUG_CONFIG } from "services/analytics/constants";
import { getAuthUserId } from "services/auth/getAuthUserId";

/**
 * Once-per-session guard for `reconcileAnalyticsUserId`. Once getAuthUserId
 * has returned the server's canonical id (`isConfirmed`), nothing changes until
 * the wallet is replaced, so short-circuit after that. A provisional id (the
 * pinned source id before the first link) leaves the guard unset, so the next
 * call asks again and picks up the canonical id once the link lands. Reset on
 * lock (see `resetAnalyticsUserIdReconciliation`) so a later unlock, possibly
 * of a replaced wallet, reconciles again.
 */
let hasReconciledUserId = false;

/**
 * Moves on every reset. A lookup that started before a reset answers for the
 * session that ended (on a wipe, possibly the replaced wallet), so it must
 * neither write its id nor set the guard back.
 */
let reconcileGeneration = 0;

/**
 * Clears the once-per-session guard so the next `reconcileAnalyticsUserId`
 * call asks again, and drops any lookup still in flight. Called whenever the
 * session leaves AUTHENTICATED.
 */
export const resetAnalyticsUserIdReconciliation = (): void => {
  hasReconciledUserId = false;
  reconcileGeneration += 1;
};

/**
 * Adopts the analytics user id from getAuthUserId as the analytics/Sentry
 * user id. That id is the canonical source id GET /api/v1/user returned
 * (#69), cached and available while locked. Before the wallet's first link
 * it is the pinned source id, marked unconfirmed. The overwrite sends no
 * event and stitches nothing: events under the old id stay there. This moves
 * a secret-key-only wallet off its random bootstrap id, and a wallet that
 * resolved to an existing user through a key onto that user's id. A phrase
 * wallet's id is unchanged. A no-op when there is no id or the session is
 * already reconciled. Never throws.
 *
 * Pass `settle: false` while locked: the cached id is still adopted, but the
 * session is left unreconciled, so a wallet replaced from the lock screen
 * (forgot password, then import) is asked about again.
 *
 * Lives outside services/analytics/user.ts on purpose: keeping the auth
 * dependency out of user.ts avoids the analytics-barrel init cycle
 * (user -> getAuthUserId -> getSigningIdentity -> getWalletSources ->
 * ducks/auth -> barrel -> user),
 * so both files use plain static imports (no require()). Mirrors the
 * extension's reconcileAnalyticsUserId.
 */
export const reconcileAnalyticsUserId = async ({
  settle = true,
}: { settle?: boolean } = {}): Promise<void> => {
  // Already confirmed this session: skip the lookup.
  if (hasReconciledUserId) return;

  const generation = reconcileGeneration;
  try {
    const { analyticsUserId: authId, isConfirmed } = await getAuthUserId();
    // Another call settled the session while this one waited: its answer is
    // the server's, and this one may be stale. Or the session was reset
    // while it waited: a wipe resets before it clears the cached id, so this
    // answer can be the replaced wallet's.
    if (hasReconciledUserId || generation !== reconcileGeneration) return;

    if (!authId) return; // locked with nothing cached — keep the current id

    // Only the server's id settles the session.
    if (isConfirmed && settle) {
      hasReconciledUserId = true;
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.METRICS_USER_ID, authId);
    } catch (setError) {
      // Don't let a persistence failure discard an id we already have; the
      // session falls back to the old id and self-heals next launch. Matches
      // the extension's reconcileAnalyticsUserId catch behavior.
      logger.warn(
        DEBUG_CONFIG.LOG_PREFIX,
        "Failed to persist auth-derived user ID; identifying for this session only",
        setError,
      );
    }

    // Re-reads storage, pushes the id to Amplitude + the store, dedups.
    // Consent-gated internally (identifyUser bails when analytics disabled).
    await analytics.identifyUser();

    // useSentryContext does not re-run on the store `userId` changing, so
    // without this the auth id would only reach Sentry on the next launch.
    // identifyUser just set the store userId, so this picks it up in-session.
    // updateSentryContext itself consent-gates the Sentry user identity.
    updateSentryContext();
  } catch {
    // Never throw into the fire-and-forget caller.
  }
};

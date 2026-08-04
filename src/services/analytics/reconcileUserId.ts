import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "config/logger";
import { updateSentryContext } from "config/sentryConfig";
import { analytics } from "services/analytics";
import { STORAGE_KEYS, DEBUG_CONFIG } from "services/analytics/constants";
import { getAuthUserId } from "services/auth/getAuthUserId";

/**
 * Adopts the seed-derived auth id as the canonical analytics/Sentry user id,
 * overwriting the random bootstrap id (existing-user migration). No-op when
 * locked (auth id null) or already migrated. Never throws.
 *
 * Lives outside services/analytics/user.ts on purpose: keeping the auth
 * dependency out of user.ts avoids the analytics-barrel init cycle
 * (user -> getAuthUserId -> getAuthKeypair -> ducks/auth -> barrel -> user),
 * so both files use plain static imports (no require()). Mirrors the
 * extension's reconcileAnalyticsUserId.
 */
export const reconcileAnalyticsUserId = async (): Promise<void> => {
  try {
    const authId = await getAuthUserId();
    if (!authId) return; // locked / no session — keep the bootstrap id

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

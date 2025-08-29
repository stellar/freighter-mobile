import * as Sentry from "@sentry/react-native";
import { logger } from "config/logger";
import { useAnalyticsStore } from "ducks/analytics";
import { useAuthenticationStore } from "ducks/auth";
import { useNetworkStore } from "ducks/networkInfo";
import { Platform } from "react-native";
import Config from "react-native-config";
import {
  getVersion,
  getBuildNumber,
  getBundleId,
} from "react-native-device-info";
import { getUserId } from "services/analytics/user";

/**
 * Sentry configuration constants
 */
export const SENTRY_CONFIG = {
  DSN: Config.SENTRY_DSN,

  // Even when analytics are disabled, we still track errors but with minimal context
  TRACK_ERRORS_WHEN_ANALYTICS_DISABLED: true,

  // Reduced context when user has disabled analytics
  MINIMAL_CONTEXT_FIELDS: [
    "platform",
    "platformVersion",
    "network",
    "appVersion",
    "buildVersion",
  ] as const,
} as const;

/**
 * Builds common context data for Sentry events (similar to analytics).
 *
 * When analytics are enabled: Full context including connectivity info and public key
 * When analytics are disabled: Minimal context for debugging without tracking user behavior
 */
const buildSentryContext = (
  respectAnalyticsPreference = true,
): Record<string, unknown> => {
  const { isEnabled: analyticsEnabled } = useAnalyticsStore.getState();
  const { connectionType, effectiveType } = useNetworkStore.getState();
  const { network, account } = useAuthenticationStore.getState();

  // Base context that's always included
  const baseContext: Record<string, unknown> = {
    platform: Platform.OS,
    platformVersion: Platform.Version,
    network: network.toUpperCase(), // Stellar network (TESTNET, PUBLIC, FUTURENET)
    appVersion: getVersion(),
    buildVersion: getBuildNumber(),
    bundleId: getBundleId(),
  };

  // If analytics are disabled and we should respect that preference, return minimal context
  if (respectAnalyticsPreference && !analyticsEnabled) {
    return baseContext;
  }

  // Full context when analytics are enabled or when explicitly requested
  const fullContext: Record<string, unknown> = {
    ...baseContext,
    publicKey: account?.publicKey ?? "N/A",
    connectionType, // Internet connectivity (wifi, cellular, etc.)
  };

  // Add effectiveType only when available (mainly for cellular connections)
  if (effectiveType) {
    fullContext.effectiveType = effectiveType;
  }

  return fullContext;
};

/**
 * Sets up Sentry context based on current app state and user preferences
 */
export const updateSentryContext = async (): Promise<void> => {
  try {
    const context = buildSentryContext();

    Sentry.setContext("appContext", context);

    const { isEnabled: analyticsEnabled } = useAnalyticsStore.getState();

    if (analyticsEnabled) {
      // Use the same user ID as analytics for consistency
      const userId = await getUserId();

      Sentry.setUser({ id: userId });
    } else {
      // Anonymous user when analytics is disabled
      Sentry.setUser({ id: "anonymous" });
    }
  } catch (error) {
    logger.warn("Failed to update Sentry context:", error as string);
  }
};

/**
 * Initialize Sentry with privacy-conscious configuration
 */
export const initializeSentry = (): void => {
  const { isEnabled: analyticsEnabled } = useAnalyticsStore.getState();

  Sentry.init({
    dsn: SENTRY_CONFIG.DSN,
    sendDefaultPii: false,
    spotlight: __DEV__,
    release: `freighter-mobile@${getVersion()}+${getBuildNumber()}`,

    // Performance monitoring - equivalent to browserTracingIntegration
    tracesSampleRate: 1.0,

    beforeSend(event) {
      // Update context on each event to ensure freshness
      // Note: beforeSend is synchronous, so we can't await updateSentryContext
      // Context will be updated on next async call

      // Additional PII scrubbing based on analytics preferences
      if (!analyticsEnabled && event.contexts?.appContext) {
        // When analytics disabled, keep only minimal context fields
        const minimalContext: Record<string, unknown> = {};

        SENTRY_CONFIG.MINIMAL_CONTEXT_FIELDS.forEach((field) => {
          if (event.contexts?.appContext?.[field]) {
            minimalContext[field] = event.contexts.appContext[field];
          }
        });

        // eslint-disable-next-line no-param-reassign
        event.contexts.appContext = minimalContext;
      }

      return event;
    },
  });

  // Set initial context
  updateSentryContext().catch((error) => {
    logger.warn("Failed to set initial Sentry context:", error as string);
  });
};

/**
 * Enhance Sentry configuration after initial setup
 * Called after analytics and user context are available
 * NOTE: it calls the same method as onAnalyticsPreferenceChange
 * but we log different messages for better tracking and debugging
 */
export const enhanceSentryConfiguration = (): void => {
  // Set up context and user identification
  updateSentryContext().catch((error) => {
    logger.warn("Failed to enhance Sentry configuration:", error as string);
  });
};

/**
 * Updates Sentry configuration when analytics preferences change
 * Note: We don't disable Sentry entirely when analytics are disabled
 * because error tracking is still valuable for app stability
 * We just reduce the context we send
 */
export const onAnalyticsPreferenceChange = (): void => {
  // Update context immediately when preference changes
  updateSentryContext().catch((error) => {
    logger.warn(
      "Failed to update Sentry context on preference change:",
      error as string,
    );
  });
};

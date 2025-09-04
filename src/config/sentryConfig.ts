import * as Sentry from "@sentry/react-native";
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

/**
 * Sentry configuration constants
 */
export const SENTRY_CONFIG = {
  DSN: Config.SENTRY_DSN,
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
    denyUrls: [/api\.amplitude\.com\/2\/httpapi/i],

    // Performance monitoring - equivalent to browserTracingIntegration
    tracesSampleRate: 1.0,

    beforeSend(event) {
      // Update context on each event to ensure freshness
      // Note: beforeSend is synchronous, so we can't await updateSentryContext
      // Context will be updated on next async call
      Sentry.setContext("appContext", buildSentryContext());

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
};

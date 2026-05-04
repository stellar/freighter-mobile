import * as Sentry from "@sentry/react-native";
import { EnvConfig } from "config/envConfig";
import { useAnalyticsStore } from "ducks/analytics";
import { useAuthenticationStore } from "ducks/auth";
import { useNetworkStore } from "ducks/networkInfo";
import { isProd, isE2ETest } from "helpers/isEnv";
import { Platform } from "react-native";
import {
  getVersion,
  getBuildNumber,
  getBundleId,
} from "react-native-device-info";

/**
 * Sentry configuration constants
 */
export const SENTRY_CONFIG = {
  DSN: EnvConfig.SENTRY_DSN,
  // Reduced context when user has disabled analytics
  MINIMAL_CONTEXT_FIELDS: [
    "platform",
    "platformVersion",
    "network",
    "appVersion",
    "buildVersion",
    "bundleId",
  ] as const,
} as const;

/**
 * Builds common context data for Sentry events (similar to analytics).
 *
 * When analytics are enabled: Full context including connectivity info and public key
 * When analytics are disabled: Minimal context for debugging without tracking user behavior
 */
const buildSentryContext = (): Record<string, unknown> => {
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
  if (!analyticsEnabled) {
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
 * Updates Sentry context and tags based on current app state
 * This should be called whenever relevant state changes (auth, analytics, etc.)
 */
export const updateSentryContext = (): void => {
  const { isEnabled: analyticsEnabled } = useAnalyticsStore.getState();
  const { account } = useAuthenticationStore.getState();

  Sentry.setContext("appContext", buildSentryContext());

  // Update tags based on analytics preferences
  if (analyticsEnabled && account?.publicKey) {
    Sentry.setTag("publicKey", account.publicKey);
  } else {
    // Remove the tag if analytics are disabled or no account
    Sentry.setTag("publicKey", undefined);
  }
};

/**
 * Initialize Sentry with privacy-conscious configuration
 */
export const initializeSentry = (): void => {
  // Disable Sentry during e2e tests
  if (isE2ETest) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_CONFIG.DSN,
    sendDefaultPii: false,
    spotlight: __DEV__,
    release: `freighter-mobile@${getVersion()}+${getBuildNumber()}`,
    denyUrls: [/api\.amplitude\.com\/2\/httpapi/i],
    environment: isProd ? "production" : "development",

    // Performance monitoring - equivalent to browserTracingIntegration
    tracesSampleRate: 1.0,

    // iOS-only main-thread monitor. Default is 2 seconds, which catches
    // a lot of natural transition stalls (clipboard reads via
    // RNCClipboard.getString, GPU shader compilation on cold start,
    // Fabric mount work) that aren't actionable bugs in our code.
    // 5 seconds keeps the genuinely-bad hangs visible while dropping
    // the bulk of the noise (FREIGHTER-MOBILE-4A / Q5 / TF / T7,
    // ~244 events / ~65 users).
    appHangTimeoutInterval: 5,

    beforeSend(event) {
      // Drop / downgrade known-noise patterns at the gate before any PII
      // scrubbing or context updates. Keep this list small and specific —
      // each entry should describe a known noise source documented in
      // #814's noise-filter analysis. Source-level fixes are preferred
      // over filtering here; these are the residual patterns that we
      // can't easily fix at the source (third-party libraries, native
      // events, user-initiated cancellations).
      const noiseMessage =
        event.message || event.exception?.values?.[0]?.value || "";

      // ---- Drop entirely (no diagnostic value) ----

      // WalletConnect session lifecycle - the SDK throws when looking up
      // a record that has just been cleaned up. Normal lifecycle, not a
      // bug (FREIGHTER-MOBILE-DM / 2Q / FM, ~14K events).
      if (noiseMessage.includes("Record was recently deleted")) return null;

      // User-initiated biometric / auth cancellations on iOS. The user
      // pressed Cancel, switched away, the system invalidated the prompt,
      // or retry-limit hit. Not bugs (FREIGHTER-MOBILE-14 / FA / BZ / HS /
      // T8 / TQ / T1, ~370 events).
      if (
        noiseMessage.includes("com.apple.LocalAuthentication") &&
        /Code=(-4|-1003|-1004|6)\b/.test(noiseMessage)
      ) {
        return null;
      }

      // Android biometric cancellations. Same family, different vendor
      // wording (FREIGHTER-MOBILE-AW / MR / MM / MB, ~50 events).
      if (/Fingerprint operation canc(elled|eled)/i.test(noiseMessage)) {
        return null;
      }

      // ---- Downgrade to breadcrumb (keep for context, no new issue) ----
      // Sentry has no built-in "convert event to breadcrumb" - we add a
      // breadcrumb for any subsequent event in the same session and drop
      // the current one.

      // User typed a wrong mnemonic / password - handled errors from user
      // input, not bugs (FREIGHTER-MOBILE-Q / 3H, ~5K events).
      if (
        noiseMessage.includes("Invalid mnemonic") ||
        noiseMessage.includes("Invalid password")
      ) {
        Sentry.addBreadcrumb({
          category: "user-input-validation",
          message: noiseMessage,
          level: "info",
        });
        return null;
      }

      // Recoverable biometric state mismatch - the user enabled
      // biometrics but the keychain entry is missing (e.g. cleared by
      // OS, app reinstall). User can re-enter password and re-enable
      // (FREIGHTER-MOBILE-13, ~1K events).
      if (
        noiseMessage.includes(
          "No stored password found for biometric authentication",
        )
      ) {
        Sentry.addBreadcrumb({
          category: "biometric-state",
          message: noiseMessage,
          level: "info",
        });
        return null;
      }

      // Update context on each event to ensure freshness
      Sentry.setContext("appContext", buildSentryContext());

      // Additional PII scrubbing based on analytics preferences
      const { isEnabled: analyticsEnabled } = useAnalyticsStore.getState();

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

  // Set initial context and tags
  updateSentryContext();
};

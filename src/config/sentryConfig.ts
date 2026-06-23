import * as Sentry from "@sentry/react-native";
import { EnvConfig } from "config/envConfig";
import { MAX_DEPTH_SENTINEL, MAX_RECURSIVE_DEPTH } from "config/logger";
import { useAnalyticsStore } from "ducks/analytics";
import { useAuthenticationStore } from "ducks/auth";
import { useNetworkStore } from "ducks/networkInfo";
import { isProd, isE2ETest } from "helpers/isEnv";
import { scrubStrKeys } from "helpers/stellarStrKey";
import enTranslations from "i18n/locales/en/translations.json";
import ptTranslations from "i18n/locales/pt/translations.json";
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
 * Centralized registry of breadcrumb categories used by `Sentry.addBreadcrumb`
 * call sites in this file.
 *
 * Note: the `sentryAdapter.warn` path in `logger.ts` uses the caller-supplied
 * `context` argument as the breadcrumb category and is intentionally not
 * enumerated here (callers can pick any module-scoped name).
 */
export const SENTRY_BREADCRUMB_CATEGORIES = {
  USER_INPUT_VALIDATION: "user-input-validation",
  BIOMETRIC_STATE: "biometric-state",
} as const;

/**
 * User-typo password messages we downgrade in `beforeSend`.
 *
 * A cleaner long-term fix would be at source: `useAuthenticationStore.signIn`
 * (`ducks/auth.ts`) rethrows on wrong-password and the LockScreen caller
 * is fire-and-forget, so the rejection ends up at Sentry's global
 * handler. Removing that rethrow (or having LockScreen catch it) would
 * stop the events from ever reaching Sentry. We don't do that here
 * because changing the action's throw contract risks affecting other
 * auth flows (biometric login, settings password gates, re-auth) and
 * wants its own focused review. This filter is a contained workaround
 * until the long-term fix is implemented.
 *
 * Sourced from i18n translation files so a copy change in
 * `translations.json` automatically updates this filter — no separate
 * sync step.
 */
export const PASSWORD_TYPO_MESSAGES = [
  enTranslations.authStore.error.invalidPassword,
  ptTranslations.authStore.error.invalidPassword,
];

// scrubStrKeys lives in a leaf module (helpers/stellarStrKey) so it can be
// shared with non-Sentry PII sinks (e.g. analytics) without import cycles.
// Re-exported here to preserve the existing `config/sentryConfig` import path.
// In beforeSend it scrubs Stellar StrKeys from event.message, exception values,
// and recursively from event.extra / breadcrumb data, so identifiers embedded
// in thrown Error.message strings cannot leak verbatim to Sentry. Object-key
// redaction (sanitizeLogData with PII_FIELDS_LOWER) handles structured
// payloads; this pattern handles raw strings the key-based redactor can't reach.
export { scrubStrKeys };

/**
 * Recursively walk a structured value and scrub Stellar StrKeys from
 * every string descendant. Used to defend against StrKeys embedded in
 * structured payloads (event.extra.args, breadcrumb data) where field
 * names alone can't predict every leak surface — e.g. a backend
 * response with `owner` / `from` / `recipient` fields holding
 * account IDs.
 *
 * At the depth cap, return a sentinel string instead of the original
 * subtree so cyclic structures cannot escape into the Sentry payload
 * and StrKeys nested past the cap cannot leak unscrubbed.
 */
const deepScrubStrKeys = (data: unknown, depth = 0): unknown => {
  if (depth >= MAX_RECURSIVE_DEPTH) {
    return MAX_DEPTH_SENTINEL;
  }
  if (typeof data === "string") {
    return scrubStrKeys(data);
  }
  if (Array.isArray(data)) {
    return data.map((item) => deepScrubStrKeys(item, depth + 1));
  }
  if (data && typeof data === "object") {
    const out: Record<string, unknown> = {};
    Object.entries(data as Record<string, unknown>).forEach(([k, v]) => {
      out[k] = deepScrubStrKeys(v, depth + 1);
    });
    return out;
  }
  return data;
};

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

    // iOS-only main-thread monitor. The default of 2 seconds catches a
    // lot of natural transition stalls (clipboard reads via
    // RNCClipboard.getString, GPU shader compilation on cold start,
    // Fabric mount work) that aren't actionable bugs in our code.
    // 5 seconds keeps the genuinely-bad hangs visible while skipping
    // those routine stalls.
    appHangTimeoutInterval: 5,

    beforeSend(event) {
      // Drop or downgrade known-noise patterns before any PII scrubbing
      // or context updates. Each entry should describe a noise source
      // we've seen in production (third-party SDK quirks, native auth
      // cancellations, user-typed validation failures). Prefer fixing
      // at the source over adding entries here.
      const noiseMessage =
        event.message || event.exception?.values?.[0]?.value || "";

      // ---- Drop entirely (no diagnostic value) ----

      // WalletConnect session lifecycle: the SDK throws when looking up
      // a record that has just been cleaned up. Normal lifecycle, not a
      // bug.
      if (noiseMessage.includes("Record was recently deleted")) return null;

      // User-initiated biometric / auth cancellations on iOS. The user
      // pressed Cancel, switched away, the system invalidated the prompt,
      // or retry-limit hit. Not bugs.
      if (
        noiseMessage.includes("com.apple.LocalAuthentication") &&
        /Code=(-4|-1003|-1004|6)\b/.test(noiseMessage)
      ) {
        return null;
      }

      // Android biometric cancellations - same family, different vendor
      // wording.
      if (/Fingerprint operation canc(elled|eled)/i.test(noiseMessage)) {
        return null;
      }

      // ---- Downgrade to breadcrumb (keep for context, no new issue) ----
      // Sentry has no built-in "convert event to breadcrumb" so we add a
      // breadcrumb for any subsequent event in the same session and drop
      // the current one.

      // User typed a wrong password - see PASSWORD_TYPO_MESSAGES above
      // for the source-fix tradeoff. Match against exact strings to
      // avoid catching neighbouring messages like "Invalid password or
      // corrupted data." (a real corruption signal).
      if (PASSWORD_TYPO_MESSAGES.includes(noiseMessage)) {
        Sentry.addBreadcrumb({
          category: SENTRY_BREADCRUMB_CATEGORIES.USER_INPUT_VALIDATION,
          message: noiseMessage,
          level: "warning",
        });
        return null;
      }

      // Recoverable biometric state mismatch: the user enabled
      // biometrics but the keychain entry is missing (e.g. cleared by
      // OS, app reinstall). User can re-enter their password and
      // re-enable biometrics, so this is recoverable.
      if (
        noiseMessage.includes(
          "No stored password found for biometric authentication",
        )
      ) {
        Sentry.addBreadcrumb({
          category: SENTRY_BREADCRUMB_CATEGORIES.BIOMETRIC_STATE,
          message: noiseMessage,
          level: "warning",
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

      // Defense-in-depth scrub for Stellar StrKey identifiers that
      // may have been interpolated into log messages or embedded in
      // thrown Error.message strings (libraries we don't control,
      // future regressions in our own code). Object-key redaction
      // already covers known PII fields; this catches the raw
      // string surfaces it can't reach.
      if (typeof event.message === "string") {
        // eslint-disable-next-line no-param-reassign
        event.message = scrubStrKeys(event.message);
      }
      event.exception?.values?.forEach((v) => {
        // eslint-disable-next-line no-param-reassign
        v.value = scrubStrKeys(v.value);
      });
      // Deep-scrub structured payloads: event.extra (logger.error
      // extras) and breadcrumb data (logger.warn args). Catches
      // StrKeys nested in fields that aren't in PII_FIELDS_LOWER -
      // e.g. backend response shapes with `owner` / `from` /
      // `recipient` holding account IDs.
      if (event.extra) {
        // eslint-disable-next-line no-param-reassign
        event.extra = deepScrubStrKeys(event.extra) as Record<string, unknown>;
      }
      event.breadcrumbs?.forEach((bc) => {
        if (bc.data) {
          // eslint-disable-next-line no-param-reassign
          bc.data = deepScrubStrKeys(bc.data) as Record<string, unknown>;
        }
      });

      return event;
    },
  });

  // Set initial context and tags
  updateSentryContext();
};

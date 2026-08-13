import * as Sentry from "@sentry/react-native";
import { EnvConfig } from "config/envConfig";
import { MAX_DEPTH_SENTINEL, MAX_RECURSIVE_DEPTH, logger } from "config/logger";
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
  const { isEnabled: analyticsEnabled, userId } = useAnalyticsStore.getState();
  const { account } = useAuthenticationStore.getState();

  Sentry.setContext("appContext", buildSentryContext());

  // Consent-gate the Sentry user identity. The analytics user id is the
  // seed-derived auth pubkey (== the backend JWT `sub`): a stable,
  // cross-service, reinstall-surviving identifier. When the user has not
  // consented to data sharing it must not ride along on crash telemetry, so
  // clear it. This is the single owner of the Sentry user across the toggle
  // and auth transitions (useSentryContext re-runs this on both), which also
  // sidesteps the persist-hydration race a one-shot read at launch would hit.
  // Mirrors the extension, which only calls Sentry.setUser when data-sharing
  // is allowed.
  Sentry.setUser(analyticsEnabled && userId ? { id: userId } : null);

  // Update tags based on analytics preferences
  if (analyticsEnabled && account?.publicKey) {
    Sentry.setTag("publicKey", account.publicKey);
  } else {
    // Remove the tag if analytics are disabled or no account
    Sentry.setTag("publicKey", undefined);
  }
};

// Tracks whether the Sentry client is currently running, so the data-sharing
// toggle can (re)initialize or shut it down idempotently (see
// syncSentryEnablement).
let isSentryInitialized = false;

// The data-sharing preference as of the most recent syncSentryEnablement()
// call. Updated synchronously so rapid toggles collapse to their final value,
// while the (asynchronous) native teardown catches up via sentryLifecycle.
let desiredSentryEnabled = false;

// Serializes lifecycle transitions. Shutting the native SDK down is async —
// client.close() awaits a JS flush and only then calls NATIVE.closeNativeSdk()
// — so an unserialized off→on toggle lets a late-landing closeNativeSdk() tear
// down the native SDK belonging to the *new* client, leaving JS reporting alive
// with native silently dead. Chaining every transition onto one promise means a
// re-init can never start until the preceding teardown has fully settled.
let sentryLifecycle: Promise<void> = Promise.resolve();

// Upper bound (ms) on the flush that client.close() performs before it closes
// the native SDK. Must be positive: both Client._isClientDoneProcessing and
// PromiseBuffer.drain treat a falsy timeout (0 or undefined) as "wait until
// everything drains", which is unbounded and would also push out events
// captured under prior consent.
const SENTRY_SHUTDOWN_FLUSH_MS = 2000;

/**
 * Initialize Sentry with privacy-conscious configuration.
 *
 * No-ops (does not call Sentry.init) in three cases:
 * - during e2e tests;
 * - if Sentry is already initialized (idempotent — safe to call from both
 *   App's startup effect and the analytics-store subscription regardless of
 *   order);
 * - if data sharing is currently OFF (master switch; mirrors the extension).
 * syncSentryEnablement() re-invokes this when the user turns sharing back on.
 */
export const initializeSentry = (): void => {
  // Disable Sentry during e2e tests
  if (isE2ETest) {
    return;
  }

  // Idempotent: never run Sentry.init() twice. Both App's startup effect and
  // the analytics-store subscription (via syncSentryEnablement) can reach here,
  // and their order isn't guaranteed — guard the initializer itself so whichever
  // runs second is a no-op.
  if (isSentryInitialized) {
    return;
  }

  // Master switch: with data sharing OFF, do not initialize Sentry at all —
  // mirrors the extension (no init when sharing is disabled), so nothing is
  // reported. syncSentryEnablement() re-initializes if the user turns it on.
  if (!useAnalyticsStore.getState().isEnabled) {
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
      // Master switch (defense-in-depth): if data sharing is off, drop every
      // event. Covers the window between a runtime toggle-off and client
      // teardown, and any event from a lingering or native-layer client.
      if (!useAnalyticsStore.getState().isEnabled) {
        return null;
      }

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

  isSentryInitialized = true;
  // Keep the desired-state mirror honest for callers that reach the
  // initializer directly (App's startup effect) rather than via
  // syncSentryEnablement, so a later reconcile doesn't read a stale `false`.
  desiredSentryEnabled = true;

  // Set initial context and tags
  updateSentryContext();
};

/**
 * Bring the running Sentry client in line with `desiredSentryEnabled`.
 *
 * Always invoked through `sentryLifecycle`, never directly, so only one
 * transition is in flight at a time. Reads the desired state at execution time
 * rather than capturing it at queue time, so a burst of toggles converges on
 * the final value instead of replaying every intermediate one.
 */
const reconcileSentryEnablement = async (): Promise<void> => {
  if (desiredSentryEnabled) {
    if (!isSentryInitialized) {
      initializeSentry();
      return;
    }

    // The client is already up, but the synchronous opt-out path may have
    // flipped `enabled` off in a toggle that was reversed before this reconcile
    // ran (off→on inside a single tick collapses to "still initialized"). Left
    // alone, that client would stay silently disabled forever while every
    // subsequent reconcile short-circuits as a no-op. Re-arm it.
    const client = Sentry.getClient();
    if (client) {
      client.getOptions().enabled = true;
    }
    return;
  }

  if (isSentryInitialized) {
    // Flip the flag first: it describes intent for subsequent reconciles, and
    // leaving it true across the await would let a queued transition observe a
    // client that is already being torn down.
    isSentryInitialized = false;

    const client = Sentry.getClient();
    if (!client) {
      return;
    }

    // Re-assert the JS stop against whichever client is live now. The
    // synchronous path in syncSentryEnablement already did this for the client
    // present at opt-out time; this covers the case where a re-init replaced it
    // while an earlier transition was settling.
    client.getOptions().enabled = false;

    // close() is what stops the *native* SDK: @sentry/react-native runs a
    // separate Cocoa/Android SDK started by ReactNativeClient._initNativeSdk(),
    // and NATIVE.closeNativeSdk() is reachable only through this path. Native
    // crashes, iOS app hangs and Android ANRs are captured and transmitted by
    // that layer without ever passing through our JS beforeSend, so disabling
    // the JS client alone leaves them reporting for the rest of the process.
    //
    // The bounded flush this performs is not the consent leak it might look
    // like: the RN NativeTransport hands each envelope straight to
    // NATIVE.sendEnvelope() on send(), and its promise buffer tracks in-flight
    // handoffs rather than an offline retry queue. There is no JS-side backlog
    // of events captured under prior consent for the flush to push out — that
    // queueing lives natively, on disk, and is retried by the native SDK
    // regardless of the JS `enabled` flag.
    await client.close(SENTRY_SHUTDOWN_FLUSH_MS);
  }
};

/**
 * Reconcile Sentry with the current data-sharing preference. Idempotent and
 * safe to call on any analytics-store change: when sharing is ON it
 * (re)initializes Sentry; when sharing is OFF it clears the user, stops the JS
 * client immediately and shuts the native SDK down. Mirrors the extension's
 * init-when-allowed / disable-on-opt-out behavior.
 *
 * Returns synchronously. The native teardown it may schedule is exposed for
 * tests via `whenSentryLifecycleSettled()`; production callers fire and forget.
 */
export const syncSentryEnablement = (): void => {
  // Consent (isEnabled) is persisted to AsyncStorage and hydrates
  // asynchronously; before hydration the store holds its default, which is
  // `true` on Android (ANALYTICS_CONFIG.DEFAULT_ENABLED). This runs from the
  // analytics-store subscription, which can fire pre-hydration (e.g. setUserId
  // during identify), so reading isEnabled now could initialize Sentry for a
  // returning opted-out user. Treat persisted consent as authoritative and
  // skip until hydration completes — App's startup effect performs the initial
  // reconcile from onFinishHydration. Mirrors syncIdentifyTraits in
  // services/analytics/core.ts.
  if (!useAnalyticsStore.persist.hasHydrated()) return;

  const { isEnabled } = useAnalyticsStore.getState();
  desiredSentryEnabled = isEnabled;

  if (!isEnabled) {
    // Stop the JS side synchronously, before anything is queued. Flipping
    // `enabled` is what makes captureEvent's `_isEnabled()` guard reject every
    // subsequent send, and beforeSend hard-drops whatever slips through the
    // gap. Doing it here rather than only in the reconcile means consent takes
    // effect the instant the user toggles, even if an earlier transition is
    // still settling.
    Sentry.setUser(null);
    const client = Sentry.getClient();
    if (client) {
      client.getOptions().enabled = false;
    }

    // Drop breadcrumbs accumulated up to this point. `enabled = false` does not
    // unbind the client, and addBreadcrumb() never consults that flag — it
    // checks only that a client exists — so logger calls and the automatic
    // integrations keep appending to the isolation scope while consent is off.
    // Sentry.init() rebinds the client but leaves the isolation scope intact,
    // so without this the first event after a re-opt-in would ship activity
    // recorded during the opted-out window.
    Sentry.getIsolationScope().clearBreadcrumbs();
  }

  sentryLifecycle = sentryLifecycle
    .then(reconcileSentryEnablement)
    .catch((error: unknown) => {
      // Catch so one failed transition cannot poison the chain for every later
      // one.
      //
      // Be aware this is effectively invisible in production on the opt-out
      // path, and unavoidably so: initializeSentryLogger() installs the
      // Sentry-only adapter outside dev (no console sink), and the
      // captureException it performs is dropped by the client's `_isEnabled()`
      // guard — which the synchronous block above just set. Consent revokes
      // the only production channel we have, so there is nowhere left to
      // report to. Logging still earns its keep on the other two paths: the
      // dev/QA adapter writes to console, and on the opt-in branch `enabled`
      // is true, so a failing initializeSentry() reports normally.
      logger.error(
        "sentryConfig",
        "Failed to reconcile Sentry enablement",
        error,
      );
    });
};

/**
 * Resolves once every lifecycle transition queued so far has settled.
 *
 * Exists for tests: syncSentryEnablement() is fire-and-forget by design (it
 * runs from a Zustand subscription that cannot await), so without this there is
 * no deterministic way to observe the native shutdown completing.
 */
export const whenSentryLifecycleSettled = (): Promise<void> => sentryLifecycle;

import * as amplitude from "@amplitude/analytics-react-native";
import { Experiment } from "@amplitude/experiment-react-native-client";
import { hash, xdr } from "@stellar/stellar-sdk";
import { AnalyticsEvent, isScreenViewEvent } from "config/analyticsConfig";
import { logger } from "config/logger";
import { syncSentryEnablement } from "config/sentryConfig";
import { useAnalyticsStore } from "ducks/analytics";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useNetworkStore } from "ducks/networkInfo";
import { isE2ETest } from "helpers/isEnv";
import { throttle, memoize } from "lodash";
import { Platform } from "react-native";
import { getBundleId } from "react-native-device-info";
import {
  AMPLITUDE_API_KEY,
  AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY,
  DEBUG_CONFIG,
  TIMING,
  ANALYTICS_CONFIG,
} from "services/analytics/constants";
import type {
  AnalyticsEventName,
  AnalyticsProps,
} from "services/analytics/types";

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------

let hasInitialised = false;
let experimentClient: ReturnType<
  typeof Experiment.initializeWithAmplitudeAnalytics
> | null = null;

/**
 * Durable, low-cardinality wallet traits derived from the auth store's
 * account list. Sent via Amplitude's Identify API (not per-event context) so
 * they persist on the user profile. Mobile has no hardware wallets, so
 * (unlike the extension) there is no `has_hardware_wallet` trait here.
 */
export const deriveIdentifyTraits = (
  allAccounts: { importedFromSecretKey?: boolean }[],
): { wallet_count: number; has_imported_account: boolean } => ({
  wallet_count: allAccounts.length,
  has_imported_account: allAccounts.some((a) => a.importedFromSecretKey),
});

// Fingerprint of the last traits successfully sent via Identify, used to
// dirty-check syncIdentifyTraits so unchanged traits don't re-send on every
// auth-store update.
let lastIdentifiedTraits: string | null = null;

/**
 * Syncs durable wallet traits to Amplitude via Identify, gated on both
 * initialization and user consent. The fingerprint is only cached once the
 * Identify call can actually be sent - if we cached it while opted out (or
 * pre-init), traits would never re-sync once consent/init become available,
 * since the dirty-check would short-circuit on the next identical call.
 * Mirrors the extension's consent-gating fix.
 */
export const syncIdentifyTraits = (
  allAccounts: { importedFromSecretKey?: boolean }[],
): void => {
  const traits = deriveIdentifyTraits(allAccounts);
  const fingerprint = JSON.stringify(traits);

  if (fingerprint === lastIdentifiedTraits) return;
  if (!AMPLITUDE_API_KEY || !hasInitialised) return;
  // Consent (isEnabled) is persisted to AsyncStorage and hydrates
  // asynchronously. Before hydration the store holds its default, which is
  // `true` on Android (see ANALYTICS_CONFIG.DEFAULT_ENABLED) - so reading
  // isEnabled now could emit traits for a returning user whose persisted
  // preference is opt-out. Treat persisted consent as authoritative: skip
  // until hydration completes (initAnalytics re-syncs onFinishHydration).
  if (!useAnalyticsStore.persist.hasHydrated()) return;
  if (!useAnalyticsStore.getState().isEnabled) return;

  try {
    const identify = new amplitude.Identify();

    // Let's set bundle id as a user property so we could easily
    // filter mobile Prod and Dev users in Amplitude.
    identify.set(ANALYTICS_CONFIG.BUNDLE_ID_KEY, getBundleId());
    identify.set("wallet_count", traits.wallet_count);
    identify.set("has_imported_account", traits.has_imported_account);

    amplitude.identify(identify);

    // Cache the fingerprint only after the Identify call has been issued
    // successfully. Caching before the try (or before this line) would mean a
    // one-off throw leaves the dirty-check short-circuiting every later sync
    // with the same traits, so they'd never retry.
    lastIdentifiedTraits = fingerprint;

    logger.debug(
      DEBUG_CONFIG.LOG_PREFIX,
      "Identify traits synced to Amplitude",
    );
  } catch (error) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      "Failed to sync Amplitude identify traits",
      error,
    );
  }
};

export const initAnalytics = (): void => {
  if (hasInitialised) return;

  if (!AMPLITUDE_API_KEY) {
    // We should only report this error when not in development or during e2e tests
    // since in development or during e2e tests we purposely don't have the Amplitude API key set
    if (!(__DEV__ || isE2ETest)) {
      logger.error(
        DEBUG_CONFIG.LOG_PREFIX,
        "missing amplitude config error",
        "Missing AMPLITUDE_API_KEY in environment",
      );
    }

    // Mark as initialized even without API key to prevent infinite loading
    hasInitialised = true;
    return;
  }

  try {
    amplitude.init(AMPLITUDE_API_KEY, undefined, {
      trackingOptions: {
        carrier: false,
      },
      disableCookies: true,
    });

    // Initialize Experiments
    if (AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY) {
      experimentClient = Experiment.initializeWithAmplitudeAnalytics(
        AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY,
      );
      logger.debug(
        DEBUG_CONFIG.LOG_PREFIX,
        "Experiment client initialized with deployment key",
      );
    } else {
      // Feature flags are load-bearing for the app's runtime behavior
      // (gating features, A/B tests, killswitches). If the experiment
      // deployment key is missing we silently fall back to defaults,
      // which can mask real config problems - report as error so we
      // catch deployment-time misconfigurations.
      logger.error(
        DEBUG_CONFIG.LOG_PREFIX,
        "Experiment deployment key missing, feature flags will use defaults",
        new Error("Experiment deployment key missing"),
      );
    }

    // Get initial state
    const { isEnabled } = useAnalyticsStore.getState();
    amplitude.setOptOut(!isEnabled);

    logger.debug(DEBUG_CONFIG.LOG_PREFIX, `Analytics enabled: ${isEnabled}`);

    hasInitialised = true;

    // Sync durable wallet traits (consent-gated) now that init has completed.
    // Must run AFTER hasInitialised is set - syncIdentifyTraits guards on
    // that flag, so calling it earlier would always short-circuit.
    //
    // syncIdentifyTraits also guards on persisted consent having hydrated. If
    // it hasn't yet, this call is a no-op; retry once hydration finishes so an
    // enabled user's traits still reach Amplitude. onFinishHydration fires
    // after persist flips hasHydrated() to true (unlike a plain store
    // subscription, which is notified during the rehydrate set, before it).
    if (useAnalyticsStore.persist.hasHydrated()) {
      syncIdentifyTraits(useAuthenticationStore.getState().allAccounts);
    } else {
      useAnalyticsStore.persist.onFinishHydration(() => {
        syncIdentifyTraits(useAuthenticationStore.getState().allAccounts);
      });
    }
  } catch (error) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      "Failed to initialize analytics",
      error,
    );
  }
};

export const isInitialized = (): boolean => hasInitialised;

/**
 * RFC surface value for this client, used to distinguish mobile from
 * extension events in shared analytics dashboards.
 */
export type Surface = "mobile_ios" | "mobile_android";

export const getSurface = (): Surface =>
  Platform.OS === "ios" ? "mobile_ios" : "mobile_android";

export const getExperimentClient = (): ReturnType<
  typeof Experiment.initializeWithAmplitudeAnalytics
> | null => experimentClient;

// -----------------------------------------------------------------------------
// SETTINGS MANAGEMENT
// -----------------------------------------------------------------------------

export const setAnalyticsEnabled = (enabled: boolean): void => {
  try {
    useAnalyticsStore.getState().setEnabled(enabled);
    logger.debug(
      DEBUG_CONFIG.LOG_PREFIX,
      `Analytics ${enabled ? "enabled" : "disabled"} in store`,
    );
  } catch (error) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      "Failed to update analytics settings",
      error,
      {
        enabled,
      },
    );
  }
};

export const setAttRequested = (requested: boolean): void => {
  try {
    useAnalyticsStore.getState().setAttRequested(requested);

    logger.debug(DEBUG_CONFIG.LOG_PREFIX, `ATT requested set to: ${requested}`);
  } catch (error) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      "Failed to update ATT requested state",
      error,
      {
        requested,
      },
    );
  }
};

export const setAnalyticsUserId = (userId: string | null): void => {
  try {
    useAnalyticsStore.getState().setUserId(userId);

    logger.debug(DEBUG_CONFIG.LOG_PREFIX, `Analytics userId set to: ${userId}`);
  } catch (error) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      "Failed to update analytics userId",
      error,
      {
        userId,
      },
    );
  }
};

// -----------------------------------------------------------------------------
// CORE TRACKING
// -----------------------------------------------------------------------------

/**
 * Cross-platform account identifier: lowercase-hex SHA-256 of the full
 * G-address string. Memoized; never emits a raw/truncated key. Must match the
 * extension's value for the same address.
 */
const accountIdHashCache = new Map<string, string>();
export const getAccountIdHash = (publicKey: string): string => {
  const cached = accountIdHashCache.get(publicKey);
  if (cached) return cached;
  try {
    const digest = xdr.encodeBytes(hash(Buffer.from(publicKey, "utf8")), "hex");
    accountIdHashCache.set(publicKey, digest);
    return digest;
  } catch {
    return "";
  }
};

/**
 * Schema generation marker for the cross-platform property model. Bumped to
 * "3" for the swap/send USD volume telemetry: without a bump, an event with
 * no `amount_usd` is ambiguous between a pre-change client and a post-change
 * client that genuinely had no price.
 */
export const SCHEMA_VERSION = "3";

/**
 * Event-level volatile bucket + schema_version. Durable traits live in Identify;
 * device/app metadata comes from the RN SDK; connectivity is on app.opened.
 */
export const buildCommonContext = (): Record<string, unknown> => {
  const { network, account, allAccounts } = useAuthenticationStore.getState();
  const activePublicKey = account?.publicKey;

  const context: Record<string, unknown> = {
    schema_version: SCHEMA_VERSION,
    surface: getSurface(),
    network: network.toUpperCase(), // Stellar network (TESTNET, PUBLIC, FUTURENET)
  };

  if (activePublicKey) {
    const idHash = getAccountIdHash(activePublicKey);
    if (idHash) context.account_id_hash = idHash;

    // ActiveAccount does not carry importedFromSecretKey; look it up on the
    // matching Account entry in allAccounts. Omit account_type entirely when
    // the active account isn't (yet) resolvable in allAccounts (auth-store
    // update race, drift-recovery path) rather than defaulting to "freighter"
    // and mislabeling a possibly-imported account.
    const activeEntry = allAccounts.find(
      (a) => a.publicKey === activePublicKey,
    );
    if (activeEntry) {
      context.account_type = activeEntry.importedFromSecretKey
        ? "imported_secret_key"
        : "freighter";
    }

    // Balances are keyed by public key AND network, so both must match the
    // active account+network for isFunded to describe the current snapshot.
    // The same G-address stays active across a selectNetwork() switch; until
    // the async refetch lands, fetchedPublicKey still matches but isFunded
    // belongs to the old network. Require the network to match too so this
    // fails closed (omits account_funded) on a network switch.
    const { isFunded, fetchedPublicKey, fetchedNetwork } =
      useBalancesStore.getState();
    if (fetchedPublicKey === activePublicKey && fetchedNetwork === network) {
      context.account_funded = isFunded;
    }
  }

  return context;
};

/**
 * Dispatches event to Amplitude without throttling.
 * Respects user analytics preferences.
 */
const dispatchUnthrottled = (
  event: AnalyticsEventName,
  props?: AnalyticsProps,
): void => {
  const { isEnabled } = useAnalyticsStore.getState();

  const eventData = ANALYTICS_CONFIG.INCLUDE_COMMON_CONTEXT
    ? { ...buildCommonContext(), ...props }
    : props;

  // Only send to Amplitude if conditions are met
  if (!isEnabled) {
    logger.debug(DEBUG_CONFIG.LOG_PREFIX, `Skipping disabled event: ${event}`);

    return;
  }

  if (!AMPLITUDE_API_KEY) {
    // We should only report this error when not in development or during e2e tests
    // since in development or during e2e tests we purposely don't have the Amplitude API key set
    if (!(__DEV__ || isE2ETest)) {
      logger.debug(
        DEBUG_CONFIG.LOG_PREFIX,
        `Skipping event due to missing API key: ${event}`,
      );
    }

    return;
  }

  if (!hasInitialised) {
    // Fires for every analytics event before init completes - high
    // per-session volume, not error-adjacent. Stay info to avoid
    // flooding the breadcrumb ring buffer.
    logger.info(
      DEBUG_CONFIG.LOG_PREFIX,
      `Analytics not initialized, skipping: ${event}`,
    );
    return;
  }

  try {
    amplitude.track(event, eventData);

    logger.debug(DEBUG_CONFIG.LOG_PREFIX, `Event sent to Amplitude: ${event}`);
  } catch (error) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      `Failed to track event: ${event}`,
      error,
      {
        props,
      },
    );
  }
};

/**
 * Throttled event dispatcher to prevent duplicate events.
 * Uses trailing execution to give time for analytics preferences to load.
 * We use memoize to create a separate throttled function for each throttle key.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getThrottledDispatcher = memoize((_throttleKey: string) =>
  throttle(dispatchUnthrottled, TIMING.THROTTLE_DELAY_MS, {
    leading: false,
    trailing: true,
  }),
);

/**
 * Resolves the throttle bucket for an event.
 *
 * `screen.viewed` collapses every screen into a single event name, so keying
 * the throttle on the event name alone would put all screens in one bucket: a
 * burst of navigations within THROTTLE_DELAY_MS (fast tap-through, or
 * synchronous programmatic navigation such as popToTop() immediately followed
 * by navigate()) would drop all but the last screen. Navigation already dedups
 * consecutive same-screen views upstream (useNavigationAnalytics compares
 * previousRouteName !== currentRouteName; BottomSheet guards per-mount), so
 * partitioning the throttle per screen_name is safe and keeps distinct screens
 * from clobbering one another while still deduping same-screen re-emits.
 */
const getThrottleKey = (
  event: AnalyticsEventName,
  props?: AnalyticsProps,
): string =>
  event === AnalyticsEvent.SCREEN_VIEWED &&
  typeof props?.screen_name === "string"
    ? `${event}:${props.screen_name}`
    : event;

/**
 * Main event tracking function.
 * Uses throttling by default to prevent duplicate events.
 */
export const track = (
  event: AnalyticsEventName,
  props?: AnalyticsProps,
): void => {
  // Bypass guard (RFC #2883, D7): screen-view VIEW_* members must be retargeted
  // to the single SCREEN_VIEWED event by the navigation/BottomSheet choke
  // points. A catalogued screen slug (e.g. "send_payment_amount") arriving here
  // as the event name means a screen-view bypassed those choke points and would
  // leak the bare slug as an Amplitude event name. The enum members keep their
  // slug values (so there is no compile-time guard), hence this runtime one:
  // drop the event and log, so a regression is caught in the console/breadcrumbs
  // instead of silently corrupting the event stream.
  if (event !== AnalyticsEvent.SCREEN_VIEWED && isScreenViewEvent(event)) {
    const message = `Screen-view "${event}" passed to track() directly; emit SCREEN_VIEWED via the navigation choke points instead. Event dropped.`;
    logger.error(DEBUG_CONFIG.LOG_PREFIX, message, new Error(message));
    return;
  }

  if (ANALYTICS_CONFIG.THROTTLE_DUPLICATE_EVENTS) {
    // Get a dispatcher throttled for this event's bucket (screen-aware for
    // screen.viewed; per event name otherwise).
    const throttledDispatch = getThrottledDispatcher(
      getThrottleKey(event, props),
    );

    throttledDispatch(event, props);
  } else {
    dispatchUnthrottled(event, props);
  }
};

// -----------------------------------------------------------------------------
// APP LIFECYCLE
// -----------------------------------------------------------------------------

/**
 * Tracks app.opened enriched with a one-time connectivity snapshot
 * (connection_type/effective_type) taken at open time. This is the only
 * event that carries connectivity - buildCommonContext deliberately does
 * not (see its docstring), since connectivity is volatile and only
 * meaningful as a point-in-time snapshot on session start.
 */
export const trackAppOpened = (props?: { previousState: string }): void => {
  const { connectionType, effectiveType } = useNetworkStore.getState();

  track(AnalyticsEvent.APP_OPENED, {
    ...props,
    // surface is supplied by buildCommonContext(); only connectivity is added here
    connection_type: connectionType ?? "unknown",
    ...(effectiveType ? { effective_type: effectiveType } : {}),
  });
};

// -----------------------------------------------------------------------------
// STORE SUBSCRIPTION (Must be after track function is defined)
// -----------------------------------------------------------------------------

// Set up analytics store subscription to handle user toggling analytics
useAnalyticsStore.subscribe((state) => {
  try {
    amplitude.setOptOut(!state.isEnabled);

    logger.debug(
      DEBUG_CONFIG.LOG_PREFIX,
      `Amplitude opt-out updated: ${!state.isEnabled} (enabled: ${state.isEnabled})`,
    );
  } catch (error) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      "Failed to update Amplitude opt-out state",
      error,
    );
  }

  // Turn Sentry fully on/off with the same toggle (mirrors the extension):
  // (re)initialize when sharing is enabled, shut the client down when disabled.
  // Also covers consent that hydrates/enables AFTER the initial init ran.
  try {
    syncSentryEnablement();
  } catch (error) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      "Failed to sync Sentry enablement",
      error,
    );
  }

  // Consent may hydrate/enable AFTER init runs, so the in-init sync can
  // correctly skip (opted-out, nothing cached). Re-sync here so traits reach
  // Amplitude once consent becomes allowed. The dirty-check + consent-gate in
  // syncIdentifyTraits make this a safe no-op when unchanged or still opted-out.
  syncIdentifyTraits(useAuthenticationStore.getState().allAccounts);
});

// Set up auth store subscription so wallet traits stay in sync as accounts
// are added/imported/removed (consent-gated inside syncIdentifyTraits).
useAuthenticationStore.subscribe((state) => {
  syncIdentifyTraits(state.allAccounts);
});

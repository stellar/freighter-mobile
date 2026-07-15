import * as amplitude from "@amplitude/analytics-react-native";
import { Experiment } from "@amplitude/experiment-react-native-client";
import { hash } from "@stellar/stellar-sdk";
import { AnalyticsEvent } from "config/analyticsConfig";
import { logger } from "config/logger";
import { useAnalyticsStore } from "ducks/analytics";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
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
 * Sets persistent user properties in Amplitude.
 * These are attributes that don't change frequently (e.g. "Bundle Id")
 * Other attributes like "Platform", "OS" and "Version" appear to be
 * automatically assigned by Amplitude.
 */
const setAmplitudeUserProperties = (): void => {
  try {
    const identify = new amplitude.Identify();

    // Let's set bundle id as a user property so we could easily
    // filter mobile Prod and Dev users in Amplitude.
    identify.set(ANALYTICS_CONFIG.BUNDLE_ID_KEY, getBundleId());

    amplitude.identify(identify);

    logger.debug(DEBUG_CONFIG.LOG_PREFIX, "User properties set in Amplitude");
  } catch (error) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      "Failed to set Amplitude user properties",
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

    // Set user properties that don't change
    setAmplitudeUserProperties();

    // Get initial state
    const { isEnabled } = useAnalyticsStore.getState();
    amplitude.setOptOut(!isEnabled);

    logger.debug(DEBUG_CONFIG.LOG_PREFIX, `Analytics enabled: ${isEnabled}`);

    hasInitialised = true;
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
    const digest = hash(Buffer.from(publicKey, "utf8")).toString("hex");
    accountIdHashCache.set(publicKey, digest);
    return digest;
  } catch {
    return "";
  }
};

export const SCHEMA_VERSION = "2";

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

    const { isFunded, fetchedPublicKey } = useBalancesStore.getState();
    if (fetchedPublicKey === activePublicKey) {
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
 * We use memoize to create a separate throttled function for each event name.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getThrottledDispatcher = memoize((_eventName: AnalyticsEventName) =>
  throttle(dispatchUnthrottled, TIMING.THROTTLE_DELAY_MS, {
    leading: false,
    trailing: true,
  }),
);

/**
 * Main event tracking function.
 * Uses throttling by default to prevent duplicate events.
 */
export const track = (
  event: AnalyticsEventName,
  props?: AnalyticsProps,
): void => {
  if (ANALYTICS_CONFIG.THROTTLE_DUPLICATE_EVENTS) {
    // Get a dispatcher throttled for this specific event name
    const throttledDispatch = getThrottledDispatcher(event);

    throttledDispatch(event, props);
  } else {
    dispatchUnthrottled(event, props);
  }
};

// -----------------------------------------------------------------------------
// APP LIFECYCLE
// -----------------------------------------------------------------------------

export const trackAppOpened = (props?: { previousState: string }): void => {
  track(AnalyticsEvent.APP_OPENED, props);
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
});

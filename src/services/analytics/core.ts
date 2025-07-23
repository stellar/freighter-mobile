import * as amplitude from "@amplitude/analytics-react-native";
import { AnalyticsEvent } from "config/analyticsConfig";
import { logger } from "config/logger";
import { useAnalyticsStore } from "ducks/analytics";
import { useAuthenticationStore } from "ducks/auth";
import { useNetworkStore } from "ducks/networkInfo";
import { throttle, memoize } from "lodash";
import { Platform } from "react-native";
import {
  getVersion,
  getBuildNumber,
  getBundleId,
} from "react-native-device-info";
import {
  AMPLITUDE_API_KEY,
  DEBUG_CONFIG,
  TIMING,
  ANALYTICS_CONFIG,
} from "services/analytics/constants";
import { addToRecentEvents } from "services/analytics/debug";
import type {
  AnalyticsEventName,
  AnalyticsProps,
} from "services/analytics/types";

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------

let hasInitialised = false;

export const initAnalytics = (): void => {
  if (hasInitialised) return;

  if (!AMPLITUDE_API_KEY) {
    logger.error(
      DEBUG_CONFIG.LOG_PREFIX,
      "Missing AMPLITUDE_API_KEY in environment",
    );
    return;
  }

  try {
    amplitude.init(AMPLITUDE_API_KEY);

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
      {
        enabled,
        error,
      },
    );
  }
};

// -----------------------------------------------------------------------------
// CORE TRACKING
// -----------------------------------------------------------------------------

/**
 * Builds common context data for all events.
 *
 * Context includes both static app data and dynamic mobile connectivity information:
 * - network: Stellar network (TESTNET, PUBLIC, FUTURENET, etc.)
 * - connectionType: Internet connectivity (wifi, cellular, bluetooth, none, etc.)
 * - effectiveType: Cellular quality (slow-2g, 2g, 3g, 4g) when on cellular
 */
const buildCommonContext = (): Record<string, unknown> => {
  const { network } = useAuthenticationStore.getState();
  const { connectionType, effectiveType } = useNetworkStore.getState();

  const context: Record<string, unknown> = {
    platform: Platform.OS,
    platformVersion: Platform.Version,
    network: network.toUpperCase(), // Stellar network (TESTNET, PUBLIC, FUTURENET)
    connectionType, // Internet connectivity (wifi, cellular, etc.)
    appVersion: getVersion(),
    buildVersion: getBuildNumber(),
    bundleId: getBundleId(),
  };

  // Add effectiveType only when available (mainly for cellular connections)
  // Values: slow-2g, 2g, 3g, 4g
  if (effectiveType) {
    context.effectiveType = effectiveType;
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

  // Always add to debug buffer for development visibility
  addToRecentEvents(event, eventData);

  // Only send to Amplitude if conditions are met
  if (!isEnabled) {
    logger.debug(DEBUG_CONFIG.LOG_PREFIX, `Skipping disabled event: ${event}`);

    return;
  }

  if (!AMPLITUDE_API_KEY) {
    logger.debug(
      DEBUG_CONFIG.LOG_PREFIX,
      `Skipping event due to missing API key: ${event}`,
    );

    return;
  }

  if (!hasInitialised) {
    logger.warn(
      DEBUG_CONFIG.LOG_PREFIX,
      `Analytics not initialized, skipping: ${event}`,
    );
    return;
  }

  try {
    amplitude.track(event, eventData);

    logger.debug(DEBUG_CONFIG.LOG_PREFIX, `Event sent to Amplitude: ${event}`);
  } catch (error) {
    logger.error(DEBUG_CONFIG.LOG_PREFIX, `Failed to track event: ${event}`, {
      error,
      props,
    });
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

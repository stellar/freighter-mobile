import { useAnalyticsStore } from "ducks/analytics";
import { isDev } from "helpers/isEnv";
import { DEBUG_CONFIG, AMPLITUDE_API_KEY } from "services/analytics/constants";
import { isInitialized } from "services/analytics/core";
import type { AnalyticsDebugInfo } from "services/analytics/types";

// -----------------------------------------------------------------------------
// DEBUG STATE
// -----------------------------------------------------------------------------

// Constants for debug information
export const DEBUG_CONSTANTS = {
  API_KEY_NOT_SET: "Not set",
} as const;

let recentEvents: Array<{
  event: string;
  timestamp: number;
  props?: Record<string, unknown>;
}> = [];

/**
 * Adds event to debug buffer (called internally by core tracking).
 */
export const addToRecentEvents = (
  event: string,
  props?: Record<string, unknown>,
): void => {
  if (!__DEV__) return;

  recentEvents.unshift({
    event,
    timestamp: Date.now(),
    props,
  });

  // Keep only recent events
  if (recentEvents.length > DEBUG_CONFIG.MAX_RECENT_EVENTS) {
    recentEvents = recentEvents.slice(0, DEBUG_CONFIG.MAX_RECENT_EVENTS);
  }
};

// -----------------------------------------------------------------------------
// DEBUG INFO
// -----------------------------------------------------------------------------

/**
 * Gets comprehensive debug information for analytics state.
 */
export const getAnalyticsDebugInfo = (): AnalyticsDebugInfo => {
  const { isEnabled, userId } = useAnalyticsStore.getState();
  const hasApiKey = Boolean(AMPLITUDE_API_KEY);
  const hasInit = isInitialized();

  // Events are sent to Amplitude only when:
  // 1. API key is available
  // 2. Analytics is enabled by user
  // 3. Analytics has been initialized
  const isSendingToAmplitude = hasApiKey && isEnabled && hasInit;

  return {
    isEnabled,
    userId,
    hasInitialized: hasInit,
    environment: isDev ? "development" : "production",
    amplitudeKey: AMPLITUDE_API_KEY ? "[set]" : DEBUG_CONSTANTS.API_KEY_NOT_SET,
    isSendingToAmplitude,
    recentEvents: [...recentEvents],
  };
};

/**
 * Clears the recent events buffer.
 */
export const clearRecentEvents = (): void => {
  recentEvents = [];
};

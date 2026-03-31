import { useAnalyticsStore } from "ducks/analytics";
import { isDev } from "helpers/isEnv";
import { AMPLITUDE_API_KEY } from "services/analytics/constants";
import { isInitialized } from "services/analytics/core";
import type { AnalyticsDebugInfo } from "services/analytics/types";

// -----------------------------------------------------------------------------
// DEBUG STATE
// -----------------------------------------------------------------------------

// Constants for debug information
export const DEBUG_CONSTANTS = {
  API_KEY_NOT_SET: "Not set",
} as const;

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
  };
};

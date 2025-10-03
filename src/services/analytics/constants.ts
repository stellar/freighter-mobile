import { Platform } from "react-native";
import Config from "react-native-config";

// -----------------------------------------------------------------------------
// API CONFIGURATION
// -----------------------------------------------------------------------------

export const AMPLITUDE_API_KEY = Config.AMPLITUDE_API_KEY ?? "";
export const AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY =
  Config.AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY ?? "";

// -----------------------------------------------------------------------------
// STORAGE KEYS
// -----------------------------------------------------------------------------

export const STORAGE_KEYS = {
  METRICS_USER_ID: "metrics_user_id",
} as const;

// -----------------------------------------------------------------------------
// TIMING CONSTANTS
// -----------------------------------------------------------------------------

export const TIMING = {
  THROTTLE_DELAY_MS: 500,
} as const;

// -----------------------------------------------------------------------------
// DEBUG CONFIGURATION
// -----------------------------------------------------------------------------

export const DEBUG_CONFIG = {
  MAX_RECENT_EVENTS: 50,
  LOG_PREFIX: "Analytics",
} as const;

// -----------------------------------------------------------------------------
// ANALYTICS CONFIGURATION
// -----------------------------------------------------------------------------

export const ANALYTICS_CONFIG = {
  // On iOS, we don't have permission to track the user by default, so we set it to false
  DEFAULT_ENABLED: Platform.OS !== "ios",
  INCLUDE_COMMON_CONTEXT: true,
  THROTTLE_DUPLICATE_EVENTS: true,
} as const;

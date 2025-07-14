import Config from "react-native-config";

// -----------------------------------------------------------------------------
// API CONFIGURATION
// -----------------------------------------------------------------------------

export const AMPLITUDE_API_KEY = Config.AMPLITUDE_API_KEY ?? "";

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
  DEFAULT_ENABLED: false,
  INCLUDE_PLATFORM_CONTEXT: true,
  THROTTLE_DUPLICATE_EVENTS: true,
} as const;

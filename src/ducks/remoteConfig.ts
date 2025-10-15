import { logger } from "config/logger";
import { isAndroid } from "helpers/device";
import { getBundleId, getVersion } from "react-native-device-info";
import { ANALYTICS_CONFIG } from "services/analytics/constants";
import { getExperimentClient } from "services/analytics/core";
import { create } from "zustand";

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

// Boolean feature flags type
type BooleanFeatureFlags = {
  swap_enabled: boolean;
  discover_enabled: boolean;
  onramp_enabled: boolean;
};

// String feature flags type
type StringFeatureFlags = {
  required_app_version: string;
  latest_app_version: string;
};

// Complex feature flags type
type ComplexFeatureFlags = {
  app_update_text: {
    enabled: boolean;
    payload: string | undefined;
  };
};

// Combined feature flags type
type FeatureFlags = BooleanFeatureFlags &
  StringFeatureFlags &
  ComplexFeatureFlags;

interface RemoteConfigState extends FeatureFlags {
  // State
  isInitialized: boolean;
  // Actions
  fetchFeatureFlags: () => Promise<void>;
  initFetchFeatureFlagsPoll: () => void;
  setInitialized: (initialized: boolean) => void;
}

// Get current app version for default values
const currentAppVersion = getVersion();

// Boolean feature flags configuration
const BOOLEAN_FLAGS = [
  "swap_enabled",
  "discover_enabled",
  "onramp_enabled",
] as const;

// String feature flags configuration (simple string values)
const STRING_FLAGS = ["required_app_version", "latest_app_version"] as const;

// Complex feature flags configuration (objects, JSON, etc.)
const COMPLEX_FLAGS = ["app_update_text"] as const;

// While developing locally we don't set the Amplitude API keys which prevents
// us from fetching feature flags so let's set all "true" by default in __DEV__
const INITIAL_REMOTE_CONFIG_STATE = __DEV__
  ? {
      swap_enabled: true,
      discover_enabled: true,
      onramp_enabled: true,
      required_app_version: "0.0.0",
      latest_app_version: currentAppVersion,
      app_update_text: {
        enabled: false,
        payload: undefined,
      },
      isInitialized: false,
    }
  : {
      swap_enabled: isAndroid,
      discover_enabled: isAndroid,
      onramp_enabled: isAndroid,
      required_app_version: "0.0.0",
      latest_app_version: currentAppVersion,
      app_update_text: {
        enabled: false,
        payload: undefined,
      },
      isInitialized: false,
    };

let featureFlagsPollInterval: NodeJS.Timeout | null = null;
let isPollingStarted = false;

export const useRemoteConfigStore = create<RemoteConfigState>()((set, get) => ({
  ...INITIAL_REMOTE_CONFIG_STATE,

  fetchFeatureFlags: async () => {
    try {
      const experimentClient = getExperimentClient();

      if (!experimentClient) {
        logger.debug(
          "remoteConfig.fetchFeatureFlags",
          "Experiment client not initialized yet, skipping fetch",
        );
        // Mark as initialized even without experiment client to prevent infinite loading
        set({ isInitialized: true });
        return;
      }

      await experimentClient.fetch({
        user_properties: {
          // We need to explicitly pass the "Bundle Id" here to make sure the
          // correct flag values will be assigned regardless if (iOS) users
          // have ever enabled tracking permission or not.
          // Other common properties like "Platform" and "Version" appear to be
          // always forwarded regardless of tracking permission.
          [ANALYTICS_CONFIG.BUNDLE_ID_KEY]: getBundleId(),
        },
      });

      const updates: Partial<FeatureFlags> = {};

      const allVariants = experimentClient.all();

      Object.entries(allVariants).forEach(([key, variant]) => {
        if (variant?.value !== undefined) {
          // Handle boolean flags - direct value check
          if (BOOLEAN_FLAGS.includes(key as (typeof BOOLEAN_FLAGS)[number])) {
            const booleanKey = key as keyof BooleanFeatureFlags;
            (updates as BooleanFeatureFlags)[booleanKey] =
              variant.value === "on";
          }
          // Handle string flags - use value directly, parse version strings
          else if (
            STRING_FLAGS.includes(key as (typeof STRING_FLAGS)[number])
          ) {
            const stringKey = key as keyof StringFeatureFlags;
            // Parse version strings from underscore format (1_6_23) to dot format (1.6.23)
            const parsedValue = variant.value.replace(/_/g, ".");
            (updates as StringFeatureFlags)[stringKey] = parsedValue;
          }
          // Handle complex flags - check enabled and use payload if enabled
          else if (
            COMPLEX_FLAGS.includes(key as (typeof COMPLEX_FLAGS)[number])
          ) {
            const complexKey = key as keyof ComplexFeatureFlags;
            const enabled = variant.value === "on";
            const flagValue = {
              enabled,
              payload: enabled ? variant.payload : undefined,
            };
            (updates as ComplexFeatureFlags)[complexKey] = flagValue;
          }
        }
      });

      if (Object.keys(updates).length > 0) {
        set(updates);
        logger.debug(
          "remoteConfig.fetchFeatureFlags",
          "Feature flags updated",
          updates,
        );
      }

      // Mark as initialized after successful fetch
      set({ isInitialized: true });
    } catch (error) {
      logger.warn(
        "remoteConfig.fetchFeatureFlags",
        "Failed to fetch feature flags",
        error,
      );

      // Mark as initialized even on error to prevent infinite loading
      set({ isInitialized: true });
    }
  },

  initFetchFeatureFlagsPoll: () => {
    if (isPollingStarted) {
      return;
    }

    if (featureFlagsPollInterval) {
      clearInterval(featureFlagsPollInterval);
    }

    isPollingStarted = true;

    // Fetch immediately on start
    get().fetchFeatureFlags();

    featureFlagsPollInterval = setInterval(() => {
      get().fetchFeatureFlags();
    }, ONE_HOUR_IN_MS);
  },

  setInitialized: (initialized: boolean) => set({ isInitialized: initialized }),
}));

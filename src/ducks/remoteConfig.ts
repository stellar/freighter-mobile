import { logger } from "config/logger";
import { isAndroid } from "helpers/device";
import { getAppVersion } from "helpers/version";
import { Platform } from "react-native";
import { getExperimentClient } from "services/analytics/core";
import { create } from "zustand";

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

interface RemoteConfigState {
  // Feature flags
  swap_enabled: boolean;
  discover_enabled: boolean;
  onramp_enabled: boolean;
  // Actions
  fetchFeatureFlags: () => Promise<void>;
  initFetchFeatureFlagsPoll: () => void;
}

type FeatureFlags = Omit<
  RemoteConfigState,
  "fetchFeatureFlags" | "initFetchFeatureFlagsPoll"
>;

// While developing locally we don't set the Amplitude API keys which prevents
// us from fetching feature flags so let's set all "true" by default in __DEV__
const INITIAL_REMOTE_CONFIG_STATE = __DEV__
  ? {
      swap_enabled: true,
      discover_enabled: true,
      onramp_enabled: true,
    }
  : {
      swap_enabled: isAndroid,
      discover_enabled: isAndroid,
      onramp_enabled: isAndroid,
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
        return;
      }

      await experimentClient.fetch({
        user_properties: {
          platform: Platform.OS,
          version: getAppVersion(),
        },
      });

      const updates: Partial<FeatureFlags> = {};

      const allVariants = experimentClient.all();

      Object.entries(allVariants).forEach(([key, variant]) => {
        if (variant?.value !== undefined) {
          updates[key as keyof FeatureFlags] = variant.value === "on";
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
    } catch (error) {
      logger.warn(
        "remoteConfig.fetchFeatureFlags",
        "Failed to fetch feature flags",
        error,
      );
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
}));

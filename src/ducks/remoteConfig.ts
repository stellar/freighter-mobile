import { APP_VERSION } from "config/constants";
import { logger } from "config/logger";
import { isAndroid } from "helpers/device";
import { Platform } from "react-native";
import { freighterBackendV2 } from "services/backend";
import { create } from "zustand";

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

interface FeatureFlagsData {
  swap_enabled: boolean;
  discover_enabled: boolean;
  onramp_enabled: boolean;
}

interface FeatureFlagsParams {
  platform: string;
  version: string;
}

interface RemoteConfigState {
  // Feature flags
  swap_enabled: boolean;
  discover_enabled: boolean;
  onramp_enabled: boolean;
  // Actions
  fetchFeatureFlags: () => Promise<void>;
  initFetchFeatureFlagsPoll: () => void;
}

const INITIAL_REMOTE_CONFIG_STATE = {
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
      const params: FeatureFlagsParams = {
        platform: Platform.OS,
        version: APP_VERSION,
      };

      const response = await freighterBackendV2.get<FeatureFlagsData>(
        "/feature-flags",
        { params },
      );

      if (response.data) {
        const featureFlags: FeatureFlagsData = response.data;
        const currentState = get();
        const updates: Partial<RemoteConfigState> = {};

        // Loop through all keys in the response and update state if key exists
        Object.keys(featureFlags).forEach((key) => {
          if (key in currentState) {
            const typedKey = key as keyof FeatureFlagsData;
            const typedUpdates = updates as Record<string, unknown>;
            typedUpdates[key] = featureFlags[typedKey];
          }
        });

        set(updates);
      }
    } catch (error) {
      // Silently fail and keep current state
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

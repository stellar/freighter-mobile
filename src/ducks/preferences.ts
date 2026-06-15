import AsyncStorage from "@react-native-async-storage/async-storage";
import { AUTO_LOCK_TIMER, DEFAULT_AUTO_LOCK_TIMER } from "config/constants";
import { logger } from "config/logger";
import {
  applyAutoLockTimerToHashKey,
  persistAutoLockTimer,
} from "services/autoLock";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PreferencesState {
  isHideDustEnabled: boolean;
  setIsHideDustEnabled: (isHideDustEnabled: boolean) => void;
  isMemoValidationEnabled: boolean;
  setIsMemoValidationEnabled: (isMemoValidationEnabled: boolean) => void;
  isBiometricsEnabled: boolean | undefined;
  setIsBiometricsEnabled: (isBiometricsEnabled: boolean) => void;
  autoLockTimer: AUTO_LOCK_TIMER;
  setAutoLockTimer: (autoLockTimer: AUTO_LOCK_TIMER) => void;
}

const INITIAL_PREFERENCES_STATE = {
  isHideDustEnabled: true,
  isMemoValidationEnabled: true,
  isBiometricsEnabled: undefined,
  autoLockTimer: DEFAULT_AUTO_LOCK_TIMER,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      ...INITIAL_PREFERENCES_STATE,
      setIsHideDustEnabled: (isHideDustEnabled: boolean) =>
        set({ isHideDustEnabled }),
      setIsMemoValidationEnabled: (isMemoValidationEnabled: boolean) =>
        set({ isMemoValidationEnabled }),
      setIsBiometricsEnabled: (isBiometricsEnabled: boolean) =>
        set({ isBiometricsEnabled }),
      setAutoLockTimer: (autoLockTimer: AUTO_LOCK_TIMER) => {
        const previousAutoLockTimer = get().autoLockTimer;
        set({ autoLockTimer });

        // Write-through to the secure-storage mirror (read by getAuthStatus
        // without depending on zustand rehydration) and re-anchor the hash
        // key TTL so switching to/from NONE takes effect immediately.
        // If the mirror write fails, revert the UI state so the displayed
        // selection never disagrees with the enforced value.
        persistAutoLockTimer(autoLockTimer).catch((error) => {
          logger.error(
            "setAutoLockTimer",
            "Failed to persist auto-lock timer",
            error,
          );
          set({ autoLockTimer: previousAutoLockTimer });
        });
        applyAutoLockTimerToHashKey(autoLockTimer).catch((error) =>
          logger.error(
            "setAutoLockTimer",
            "Failed to apply auto-lock timer to hash key",
            error,
          ),
        );
      },
    }),
    {
      name: "preferences-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { AUTO_LOCK_TIMER, DEFAULT_AUTO_LOCK_TIMER } from "config/constants";
import { logger } from "config/logger";
import {
  applyAutoLockTimerToHashKey,
  getAutoLockTimer,
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
  hydrateAutoLockTimer: () => Promise<void>;
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

        // Persist to the secure mirror, then re-anchor the hash-key TTL —
        // sequenced, not raced. On failure, roll back the UI, mirror, and TTL
        // together so the selection, enforcement, and expiry can't disagree.
        (async () => {
          try {
            await persistAutoLockTimer(autoLockTimer);
            await applyAutoLockTimerToHashKey(autoLockTimer);
          } catch (error) {
            logger.error(
              "setAutoLockTimer",
              "Failed to apply auto-lock timer; rolling back",
              error,
            );
            set({ autoLockTimer: previousAutoLockTimer });
            await Promise.allSettled([
              persistAutoLockTimer(previousAutoLockTimer),
              applyAutoLockTimerToHashKey(previousAutoLockTimer),
            ]);
          }
        })();
      },
      // Load autoLockTimer from the secure mirror (its single source of truth).
      // Called once on app init since the value is intentionally not persisted
      // to the unencrypted zustand store (see partialize below).
      hydrateAutoLockTimer: async () => {
        try {
          const autoLockTimer = await getAutoLockTimer();
          set({ autoLockTimer });
        } catch (error) {
          logger.error(
            "hydrateAutoLockTimer",
            "Failed to hydrate auto-lock timer from secure storage",
            error,
          );
        }
      },
    }),
    {
      name: "preferences-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // autoLockTimer is intentionally NOT persisted here: the secure-storage
      // mirror (read by getAuthStatus for enforcement) is its single source of
      // truth. Keeping a second copy in unencrypted AsyncStorage would let the
      // UI disagree with enforcement and expose the policy to tampering. It's
      // hydrated from the mirror on app init via hydrateAutoLockTimer().
      partialize: (state) => ({
        isHideDustEnabled: state.isHideDustEnabled,
        isMemoValidationEnabled: state.isMemoValidationEnabled,
        isBiometricsEnabled: state.isBiometricsEnabled,
      }),
    },
  ),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ANALYTICS_CONFIG } from "services/analytics/constants";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface AnalyticsState {
  isEnabled: boolean;
  userId: string | null;
  setEnabled: (enabled: boolean) => void;
  setUserId: (userId: string | null) => void;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set) => ({
      isEnabled: ANALYTICS_CONFIG.DEFAULT_ENABLED,
      userId: null,
      setEnabled: (enabled) => set({ isEnabled: enabled }),
      setUserId: (userId) => set({ userId }),
    }),
    {
      name: "analytics-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

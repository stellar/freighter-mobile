import AsyncStorage from "@react-native-async-storage/async-storage";
import { ANALYTICS_CONFIG } from "services/analytics/constants";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface AnalyticsState {
  isEnabled: boolean;
  userId: string | null;
  attRequested: boolean; // ATT (App Tracking Transparency) is an iOS-only requirement.
  setEnabled: (enabled: boolean) => void;
  setUserId: (userId: string | null) => void;
  setAttRequested: (requested: boolean) => void;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set) => ({
      isEnabled: ANALYTICS_CONFIG.DEFAULT_ENABLED,
      userId: null,
      attRequested: false,
      setEnabled: (enabled) => set({ isEnabled: enabled }),
      setUserId: (userId) => set({ userId }),
      setAttRequested: (requested) => set({ attRequested: requested }),
    }),
    {
      name: "analytics-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

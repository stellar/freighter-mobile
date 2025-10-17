import AsyncStorage from "@react-native-async-storage/async-storage";
import { isDev } from "helpers/isEnv";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface DebugState {
  // App version override for testing app updates in DEV mode
  overriddenAppVersion: string | null;
  setOverriddenAppVersion: (version: string | null) => void;
  clearOverriddenAppVersion: () => void;
}

const INITIAL_DEBUG_STATE = {
  overriddenAppVersion: null,
};

export const useDebugStore = create<DebugState>()(
  isDev
    ? persist(
        (set) => ({
          ...INITIAL_DEBUG_STATE,
          setOverriddenAppVersion: (version: string | null) =>
            set({ overriddenAppVersion: version }),
          clearOverriddenAppVersion: () => set({ overriddenAppVersion: null }),
        }),
        {
          name: "debug-storage",
          storage: createJSONStorage(() => AsyncStorage),
        },
      )
    : (set) => ({
        ...INITIAL_DEBUG_STATE,
        setOverriddenAppVersion: (version: string | null) =>
          set({ overriddenAppVersion: version }),
        clearOverriddenAppVersion: () => set({ overriddenAppVersion: null }),
      }),
);

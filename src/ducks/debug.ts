import AsyncStorage from "@react-native-async-storage/async-storage";
import { isDev } from "helpers/isEnv";
import { SecurityLevel } from "services/blockaid/constants";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface DebugState {
  // App version override for testing app updates in DEV mode
  overriddenAppVersion: string | null;
  setOverriddenAppVersion: (version: string | null) => void;
  clearOverriddenAppVersion: () => void;

  // Blockaid response override for testing security states in DEV mode
  overriddenBlockaidResponse: SecurityLevel | null;
  setOverriddenBlockaidResponse: (response: SecurityLevel | null) => void;
  clearOverriddenBlockaidResponse: () => void;
}

const INITIAL_DEBUG_STATE = {
  overriddenAppVersion: null,
  overriddenBlockaidResponse: null,
};

export const useDebugStore = create<DebugState>()(
  isDev
    ? persist(
        (set) => ({
          ...INITIAL_DEBUG_STATE,
          setOverriddenAppVersion: (version: string | null) =>
            set({ overriddenAppVersion: version }),
          clearOverriddenAppVersion: () => set({ overriddenAppVersion: null }),
          setOverriddenBlockaidResponse: (response: SecurityLevel | null) =>
            set({ overriddenBlockaidResponse: response }),
          clearOverriddenBlockaidResponse: () =>
            set({ overriddenBlockaidResponse: null }),
        }),
        {
          name: "debug-storage",
          storage: createJSONStorage(() => AsyncStorage),
        },
      )
    : () => ({
        ...INITIAL_DEBUG_STATE,
        // In production, these functions are no-ops and don't change state
        setOverriddenAppVersion: () => {},
        clearOverriddenAppVersion: () => {},
        setOverriddenBlockaidResponse: () => {},
        clearOverriddenBlockaidResponse: () => {},
      }),
);

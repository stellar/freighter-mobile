import AsyncStorage from "@react-native-async-storage/async-storage";
import { MIN_HASH_KEY_EXPIRATION_SECONDS } from "config/constants";
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

  // Transaction failure overrides for testing error handling in DEV mode
  forceBuildTransactionFailure: boolean;
  forceSignTransactionFailure: boolean;
  forceSubmitTransactionFailure: boolean;
  setForceBuildTransactionFailure: (force: boolean) => void;
  setForceSignTransactionFailure: (force: boolean) => void;
  setForceSubmitTransactionFailure: (force: boolean) => void;
  clearAllTransactionFailures: () => void;

  // Swap path finding overrides
  forceSwapPathFailure: boolean;
  setForceSwapPathFailure: (force: boolean) => void;
  clearSwapPathDebug: () => void;

  // Hash key expiration override for testing (in seconds)
  hashKeyExpirationSeconds: number | null;
  setHashKeyExpirationSeconds: (seconds: number | null) => void;
  clearHashKeyExpirationOverride: () => void;
}

const INITIAL_DEBUG_STATE = {
  overriddenAppVersion: null,
  overriddenBlockaidResponse: null,
  forceBuildTransactionFailure: false,
  forceSignTransactionFailure: false,
  forceSubmitTransactionFailure: false,
  forceSwapPathFailure: false,
  hashKeyExpirationSeconds: null,
};

export const useDebugStore = create<DebugState>()(
  isDev || __DEV__
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
          setForceBuildTransactionFailure: (force: boolean) =>
            set({ forceBuildTransactionFailure: force }),
          setForceSignTransactionFailure: (force: boolean) =>
            set({ forceSignTransactionFailure: force }),
          setForceSubmitTransactionFailure: (force: boolean) =>
            set({ forceSubmitTransactionFailure: force }),
          clearAllTransactionFailures: () =>
            set({
              forceBuildTransactionFailure: false,
              forceSignTransactionFailure: false,
              forceSubmitTransactionFailure: false,
            }),
          setForceSwapPathFailure: (force: boolean) =>
            set({ forceSwapPathFailure: force }),
          clearSwapPathDebug: () => set({ forceSwapPathFailure: false }),
          setHashKeyExpirationSeconds: (seconds: number | null) => {
            // Enforce minimum to prevent lockout
            const validSeconds =
              seconds !== null && seconds >= MIN_HASH_KEY_EXPIRATION_SECONDS
                ? seconds
                : null;
            set({ hashKeyExpirationSeconds: validSeconds });
          },
          clearHashKeyExpirationOverride: () =>
            set({ hashKeyExpirationSeconds: null }),
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
        setForceBuildTransactionFailure: () => {},
        setForceSignTransactionFailure: () => {},
        setForceSubmitTransactionFailure: () => {},
        clearAllTransactionFailures: () => {},
        setForceSwapPathFailure: () => {},
        clearSwapPathDebug: () => {},
        setHashKeyExpirationSeconds: () => {},
        clearHashKeyExpirationOverride: () => {},
      }),
);

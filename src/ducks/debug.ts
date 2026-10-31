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

  /**
   * Skips the backend simulation of a send whose final destination is a
   * muxed contract (`W...`), so the review sheet opens with the device-built,
   * unsimulated transaction. It lets W sends be exercised in DEV before the
   * network and the backend support them. A stubbed transaction can't be
   * submitted. Off by default.
   *
   * The stub only ever applies in a debug build: the builder checks `__DEV__`
   * before it reads this flag. A prod-bundle build gets the no-op store below,
   * so the flag is always off there. A dev-bundle release build, such as a PR
   * preview, gets the persisted store and can keep a value an earlier debug
   * build persisted on the same install, but the builder ignores it there.
   */
  stubMuxedContractSimulation: boolean;
  /**
   * Turns the muxed contract simulation stub on or off. A no-op in a
   * prod-bundle build. Whatever its value, the stub only applies in a debug
   * build.
   *
   * @param stub - Whether to skip the simulation for a `W...` destination
   */
  setStubMuxedContractSimulation: (stub: boolean) => void;
}

const INITIAL_DEBUG_STATE = {
  overriddenAppVersion: null,
  overriddenBlockaidResponse: null,
  forceBuildTransactionFailure: false,
  forceSignTransactionFailure: false,
  forceSubmitTransactionFailure: false,
  forceSwapPathFailure: false,
  stubMuxedContractSimulation: false,
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
          setStubMuxedContractSimulation: (stub: boolean) =>
            set({ stubMuxedContractSimulation: stub }),
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
        setStubMuxedContractSimulation: () => {},
      }),
);

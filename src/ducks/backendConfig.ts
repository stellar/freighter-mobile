import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export enum BackendEnvironment {
  PROD = "PROD",
  STG = "STG",
  DEV = "DEV",
}

interface BackendConfigState {
  backendV1Environment: BackendEnvironment;
  backendV2Environment: BackendEnvironment;
  setBackendV1Environment: (env: BackendEnvironment) => void;
  setBackendV2Environment: (env: BackendEnvironment) => void;
}

const INITIAL_BACKEND_CONFIG_STATE = {
  backendV1Environment: BackendEnvironment.DEV,
  backendV2Environment: BackendEnvironment.DEV,
};

export const useBackendConfigStore = create<BackendConfigState>()(
  persist(
    (set) => ({
      ...INITIAL_BACKEND_CONFIG_STATE,
      setBackendV1Environment: (backendV1Environment: BackendEnvironment) =>
        set({ backendV1Environment }),
      setBackendV2Environment: (backendV2Environment: BackendEnvironment) =>
        set({ backendV2Environment }),
    }),
    {
      name: "backend-config-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

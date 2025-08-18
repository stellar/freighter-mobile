import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PreferencesState {
  isHideDustEnabled: boolean;
  setIsHideDustEnabled: (isHideDustEnabled: boolean) => void;
  isMemoValidationEnabled: boolean;
  setIsMemoValidationEnabled: (isMemoValidationEnabled: boolean) => void;
}

const INITIAL_PREFERENCES_STATE = {
  isHideDustEnabled: true,
  isMemoValidationEnabled: true,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...INITIAL_PREFERENCES_STATE,
      setIsHideDustEnabled: (isHideDustEnabled: boolean) =>
        set({ isHideDustEnabled }),
      setIsMemoValidationEnabled: (isMemoValidationEnabled: boolean) =>
        set({ isMemoValidationEnabled }),
    }),
    {
      name: "preferences-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

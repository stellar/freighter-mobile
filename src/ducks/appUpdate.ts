import { create } from "zustand";

interface AppUpdateState {
  currentSessionNoticeDismissed: boolean;
  setCurrentSessionNoticeDismissed: (dismissed: boolean) => void;
  dismissFullScreenNotice: () => void;
}

const INITIAL_APP_UPDATE_STATE = {
  currentSessionNoticeDismissed: false,
};

export const useAppUpdateStore = create<AppUpdateState>()((set) => ({
  ...INITIAL_APP_UPDATE_STATE,

  setCurrentSessionNoticeDismissed: (dismissed: boolean) =>
    set({ currentSessionNoticeDismissed: dismissed }),

  dismissFullScreenNotice: () => {
    set({ currentSessionNoticeDismissed: true });
  },
}));

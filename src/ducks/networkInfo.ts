import { create } from "zustand";

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  isOffline: boolean;
  setNetworkInfo: (payload: {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
  }) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: true,
  isInternetReachable: true,
  isOffline: false,
  setNetworkInfo: (payload) =>
    set((state) => ({
      isConnected: payload.isConnected ?? false,
      isInternetReachable: payload.isInternetReachable ?? false,
      isOffline:
        !(payload.isConnected ?? state.isConnected) ||
        !(payload.isInternetReachable ?? state.isInternetReachable),
    })),
}));

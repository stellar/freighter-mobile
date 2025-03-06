import { create } from "zustand";

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  setNetworkInfo: (payload: {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
  }) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: true,
  isInternetReachable: true,
  setNetworkInfo: (payload) =>
    set({
      isConnected: payload.isConnected ?? false,
      isInternetReachable: payload.isInternetReachable ?? false,
    }),
}));

// Helper hooks and selectors
export const useNetworkInfo = () => {
  const { isConnected, isInternetReachable } = useNetworkStore();
  return { isConnected, isInternetReachable };
};

export const useIsOffline = () => {
  const { isConnected, isInternetReachable } = useNetworkStore();
  return !isConnected || !isInternetReachable;
};

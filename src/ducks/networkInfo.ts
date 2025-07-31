import {
  NetInfoState,
  NetInfoStateType,
} from "@react-native-community/netinfo";
import { create } from "zustand";

const UNKNOWN_CONNECTION = "unknown";

interface NetworkState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  isOffline: boolean;
  connectionType: NetInfoStateType | typeof UNKNOWN_CONNECTION;
  effectiveType: string | null;
  setNetworkInfo: (payload: NetInfoState) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: true,
  isInternetReachable: true,
  isOffline: false,
  connectionType: UNKNOWN_CONNECTION,
  effectiveType: null,
  setNetworkInfo: (payload) =>
    set((state) => ({
      isConnected: payload.isConnected ?? false,
      isInternetReachable: payload.isInternetReachable ?? false,
      isOffline:
        !(payload.isConnected ?? state.isConnected) ||
        !(payload.isInternetReachable ?? state.isInternetReachable),
      connectionType: payload.type ?? UNKNOWN_CONNECTION,
      effectiveType:
        payload.type === NetInfoStateType.cellular &&
        payload.details?.cellularGeneration
          ? payload.details.cellularGeneration
          : null,
    })),
}));

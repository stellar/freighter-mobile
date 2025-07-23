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
  isConnected: null,
  isInternetReachable: null,
  isOffline: true,
  connectionType: UNKNOWN_CONNECTION,
  effectiveType: null,
  setNetworkInfo: (payload) =>
    set(() => ({
      isConnected: payload.isConnected,
      isInternetReachable: payload.isInternetReachable,
      isOffline: !payload.isConnected || !payload.isInternetReachable,
      connectionType: payload.type,
      effectiveType:
        payload.type === NetInfoStateType.cellular &&
        payload.details?.cellularGeneration
          ? payload.details.cellularGeneration
          : null,
    })),
}));

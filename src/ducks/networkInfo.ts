import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
}

interface NetworkPayload {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

const initialState: NetworkState = {
  isConnected: true,
  isInternetReachable: true,
};

const networkInfoSlice = createSlice({
  name: "networkInfo",
  initialState,
  reducers: {
    setNetworkInfo: (state, action: PayloadAction<NetworkPayload>) => {
      state.isConnected = action.payload.isConnected ?? false;
      state.isInternetReachable = action.payload.isInternetReachable ?? false;
    },
  },
});

export const { setNetworkInfo } = networkInfoSlice.actions;
export const networkInfoReducer = networkInfoSlice.reducer;

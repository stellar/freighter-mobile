import {createSlice} from '@reduxjs/toolkit';

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

const initialState: NetworkState = {
  isConnected: true,
  isInternetReachable: true,
};

const networkInfoSlice = createSlice({
  name: 'networkInfo',
  initialState,
  reducers: {
    setNetworkInfo: (state, action) => {
      state.isConnected = action.payload.isConnected;
      state.isInternetReachable = action.payload.isInternetReachable;
    },
  },
});

export const {setNetworkInfo} = networkInfoSlice.actions;
export const networkInfoReducer = networkInfoSlice.reducer; 
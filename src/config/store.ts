import { configureStore } from "@reduxjs/toolkit";
import { networkInfoReducer } from "ducks/networkInfo";
import {
  useSelector as useReduxSelector,
  useDispatch as useReduxDispatch,
  useStore as useReduxStore,
  TypedUseSelectorHook,
} from "react-redux";

const initialState = {
  networkInfo: {
    isConnected: true,
    isInternetReachable: true,
  },
};

export const store = configureStore({
  reducer: {
    networkInfo: networkInfoReducer,
  },
  preloadedState: initialState,
});

export type RootState = ReturnType<typeof store.getState>;
export type Dispatch = typeof store.dispatch;
export type Store = typeof store;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useDispatch = () => useReduxDispatch<Dispatch>();
export const useSelector: TypedUseSelectorHook<RootState> = useReduxSelector;
export const useStore = () => useReduxStore<Store>();

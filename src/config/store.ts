import {configureStore} from '@reduxjs/toolkit';
import {
  useSelector as useReduxSelector,
  useDispatch as useReduxDispatch,
  useStore as useReduxStore,
  TypedUseSelectorHook,
} from 'react-redux';

const initialState = {
  // Add initial state here as needed
};

export const store = configureStore({
  reducer: {
    // Add reducers here as needed
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
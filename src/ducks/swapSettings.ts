import {
  DEFAULT_TRANSACTION_TIMEOUT,
  MIN_TRANSACTION_FEE,
  DEFAULT_SLIPPAGE,
} from "config/constants";
import { create } from "zustand";

const INITIAL_SWAP_SETTINGS_STATE = {
  swapFee: MIN_TRANSACTION_FEE,
  swapTimeout: DEFAULT_TRANSACTION_TIMEOUT,
  swapSlippage: DEFAULT_SLIPPAGE,
};

interface SwapSettingsState {
  swapFee: string;
  swapTimeout: number;
  swapSlippage: number;

  saveSwapFee: (fee: string) => void;
  saveSwapTimeout: (timeout: number) => void;
  saveSwapSlippage: (slippage: number) => void;
  resetSettings: () => void;
}

export const useSwapSettingsStore = create<SwapSettingsState>((set) => ({
  ...INITIAL_SWAP_SETTINGS_STATE,

  saveSwapFee: (fee) => set({ swapFee: fee }),
  saveSwapTimeout: (timeout) => set({ swapTimeout: timeout }),
  saveSwapSlippage: (slippage) => set({ swapSlippage: slippage }),
  resetSettings: () => set(INITIAL_SWAP_SETTINGS_STATE),
}));

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
  feeManuallyChanged: false,
};

interface SwapSettingsState {
  swapFee: string;
  swapTimeout: number;
  swapSlippage: number;
  feeManuallyChanged: boolean;

  saveSwapFee: (fee: string) => void;
  saveSwapTimeout: (timeout: number) => void;
  saveSwapSlippage: (slippage: number) => void;
  markFeeManuallyChanged: () => void;
  resetSettings: () => void;
  resetToDefaults: () => void;
}

export const useSwapSettingsStore = create<SwapSettingsState>((set) => ({
  ...INITIAL_SWAP_SETTINGS_STATE,

  saveSwapFee: (fee) => set({ swapFee: fee }),
  saveSwapTimeout: (timeout) => set({ swapTimeout: timeout }),
  saveSwapSlippage: (slippage) => set({ swapSlippage: slippage }),
  markFeeManuallyChanged: () => set({ feeManuallyChanged: true }),
  resetSettings: () => set(INITIAL_SWAP_SETTINGS_STATE),
  resetToDefaults: () => set(INITIAL_SWAP_SETTINGS_STATE),
}));

import {
  DEFAULT_TRANSACTION_TIMEOUT,
  MIN_TRANSACTION_FEE,
  DEFAULT_SLIPPAGE,
} from "config/constants";
import { FeePriority } from "config/types";
import { create } from "zustand";

const INITIAL_SWAP_SETTINGS_STATE = {
  swapFee: MIN_TRANSACTION_FEE,
  swapTimeout: DEFAULT_TRANSACTION_TIMEOUT,
  swapSlippage: DEFAULT_SLIPPAGE,
  feeManuallyChanged: false,
  // See transactionSettings: stored so the sheet shows the chosen tier rather
  // than reverse-deriving it from the (drifting) fee amount.
  feePriority: FeePriority.MEDIUM,
};

interface SwapSettingsState {
  swapFee: string;
  swapTimeout: number;
  swapSlippage: number;
  feeManuallyChanged: boolean;
  feePriority: FeePriority;

  saveSwapFee: (fee: string) => void;
  saveSwapTimeout: (timeout: number) => void;
  saveSwapSlippage: (slippage: number) => void;
  markFeeManuallyChanged: () => void;
  saveFeePriority: (feePriority: FeePriority) => void;
  resetSettings: () => void;
  resetToDefaults: () => void;
}

export const useSwapSettingsStore = create<SwapSettingsState>((set) => ({
  ...INITIAL_SWAP_SETTINGS_STATE,

  saveSwapFee: (fee) => set({ swapFee: fee }),
  saveSwapTimeout: (timeout) => set({ swapTimeout: timeout }),
  saveSwapSlippage: (slippage) => set({ swapSlippage: slippage }),
  markFeeManuallyChanged: () => set({ feeManuallyChanged: true }),
  saveFeePriority: (feePriority) => set({ feePriority }),
  resetSettings: () => set(INITIAL_SWAP_SETTINGS_STATE),
  resetToDefaults: () => set(INITIAL_SWAP_SETTINGS_STATE),
}));

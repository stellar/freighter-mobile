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

/**
 * SwapSettings State Interface
 *
 * Defines the structure of the swap settings state store using Zustand.
 * This store manages swap configuration settings including fee, timeout, and slippage.
 *
 * @interface SwapSettingsState
 * @property {string} swapFee - Fee amount for the swap transaction (in XLM)
 * @property {number} swapTimeout - Timeout in seconds for the swap transaction
 * @property {number} swapSlippage - Maximum slippage percentage allowed for the swap
 * @property {Function} saveSwapFee - Function to save the swap fee value
 * @property {Function} saveSwapTimeout - Function to save the swap timeout value
 * @property {Function} saveSwapSlippage - Function to save the swap slippage value
 * @property {Function} resetSettings - Function to reset all settings to default values
 */
interface SwapSettingsState {
  swapFee: string;
  swapTimeout: number;
  swapSlippage: number;

  saveSwapFee: (fee: string) => void;
  saveSwapTimeout: (timeout: number) => void;
  saveSwapSlippage: (slippage: number) => void;
  resetSettings: () => void;
}

/**
 * Swap Settings Store
 *
 * A Zustand store that manages swap settings.
 */
export const useSwapSettingsStore = create<SwapSettingsState>((set) => ({
  ...INITIAL_SWAP_SETTINGS_STATE,

  /**
   * Saves the swap fee amount
   * @param {string} fee - The fee amount to save (in XLM)
   */
  saveSwapFee: (fee) => set({ swapFee: fee }),

  /**
   * Saves the swap timeout in seconds
   * @param {number} timeout - The timeout value in seconds
   */
  saveSwapTimeout: (timeout) => set({ swapTimeout: timeout }),

  /**
   * Saves the swap slippage percentage
   * @param {number} slippage - The slippage percentage to save
   */
  saveSwapSlippage: (slippage) => set({ swapSlippage: slippage }),

  /**
   * Resets all swap settings to their default values
   */
  resetSettings: () => set(INITIAL_SWAP_SETTINGS_STATE),
}));

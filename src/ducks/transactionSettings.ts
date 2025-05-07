import {
  DEFAULT_TRANSACTION_TIMEOUT,
  TRANSACTION_RECOMMENDED_FEE,
} from "config/constants";
import { create } from "zustand";

/**
 * TransactionSettings State Interface
 *
 * Defines the structure of the transaction settings state store using Zustand.
 * This store manages transaction configuration settings including memo, fee, and timeout.
 *
 * @interface TransactionSettingsState
 * @property {string} memo - Memo text to include with the transaction
 * @property {string} transactionFee - Fee amount for the transaction (in XLM)
 * @property {number} transactionTimeout - Timeout in seconds for the transaction
 * @property {Function} saveMemo - Function to save the memo value
 * @property {Function} saveTransactionFee - Function to save the transaction fee value
 * @property {Function} saveTransactionTimeout - Function to save the transaction timeout value
 * @property {Function} resetSettings - Function to reset all settings to default values
 */
interface TransactionSettingsState {
  memo: string;
  transactionFee: string;
  transactionTimeout: number;

  saveMemo: (memo: string) => void;
  saveTransactionFee: (fee: string) => void;
  saveTransactionTimeout: (timeout: number) => void;
  resetSettings: () => void;
}

/**
 * Transaction Settings Store
 *
 * A Zustand store that manages transaction settings.
 */
export const useTransactionSettingsStore = create<TransactionSettingsState>(
  (set) => ({
    memo: "",
    transactionFee: TRANSACTION_RECOMMENDED_FEE,
    transactionTimeout: DEFAULT_TRANSACTION_TIMEOUT,

    /**
     * Saves the memo text for a transaction
     * @param {string} memo - The memo text to save
     */
    saveMemo: (memo) => set({ memo }),

    /**
     * Saves the transaction fee amount
     * @param {string} fee - The fee amount to save (in XLM)
     */
    saveTransactionFee: (fee) => set({ transactionFee: fee }),

    /**
     * Saves the transaction timeout in seconds
     * @param {number} timeout - The timeout value in seconds
     */
    saveTransactionTimeout: (timeout) =>
      set({ transactionTimeout: Number(timeout) }),

    /**
     * Resets all transaction settings to their default values
     */
    resetSettings: () =>
      set({
        memo: "",
        transactionFee: TRANSACTION_RECOMMENDED_FEE,
        transactionTimeout: DEFAULT_TRANSACTION_TIMEOUT,
      }),
  }),
);

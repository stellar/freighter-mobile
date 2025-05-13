import {
  DEFAULT_TRANSACTION_TIMEOUT,
  MIN_TRANSACTION_FEE,
} from "config/constants";
import { create } from "zustand";

/**
 * TransactionSettings State Interface
 *
 * Defines the structure of the transaction settings state store using Zustand.
 * This store manages transaction configuration settings including memo, fee, and timeout.
 *
 * @interface TransactionSettingsState
 * @property {string} transactionMemo - Memo text to include with the transaction
 * @property {string} transactionFee - Fee amount for the transaction (in XLM)
 * @property {number} transactionTimeout - Timeout in seconds for the transaction
 * @property {string} recipientAddress - Recipient address for the transaction
 * @property {string} selectedTokenId - ID of the token selected for the transaction
 * @property {Function} saveMemo - Function to save the memo value
 * @property {Function} saveTransactionFee - Function to save the transaction fee value
 * @property {Function} saveTransactionTimeout - Function to save the transaction timeout value
 * @property {Function} saveRecipientAddress - Function to save the recipient address
 * @property {Function} saveSelectedTokenId - Function to save the selected token ID
 * @property {Function} resetSettings - Function to reset all settings to default values
 */
interface TransactionSettingsState {
  transactionMemo: string;
  transactionFee: string;
  transactionTimeout: number;
  recipientAddress: string;
  selectedTokenId: string;

  saveMemo: (memo: string) => void;
  saveTransactionFee: (fee: string) => void;
  saveTransactionTimeout: (timeout: number) => void;
  saveRecipientAddress: (address: string) => void;
  saveSelectedTokenId: (tokenId: string) => void;
  resetSettings: () => void;
}

/**
 * Transaction Settings Store
 *
 * A Zustand store that manages transaction settings.
 */
export const useTransactionSettingsStore = create<TransactionSettingsState>(
  (set) => ({
    transactionMemo: "",
    transactionFee: MIN_TRANSACTION_FEE,
    transactionTimeout: DEFAULT_TRANSACTION_TIMEOUT,
    recipientAddress: "",
    selectedTokenId: "",

    /**
     * Saves the memo text for a transaction
     * @param {string} transactionMemo - The memo text to save
     */
    saveMemo: (transactionMemo) => set({ transactionMemo }),

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
     * Saves the recipient address for the transaction
     * @param {string} address - The recipient address
     */
    saveRecipientAddress: (address) => set({ recipientAddress: address }),

    /**
     * Saves the selected token ID for the transaction
     * @param {string} tokenId - The token ID
     */
    saveSelectedTokenId: (tokenId) => set({ selectedTokenId: tokenId }),

    /**
     * Resets all transaction settings to their default values
     */
    resetSettings: () =>
      set({
        transactionMemo: "",
        transactionFee: MIN_TRANSACTION_FEE,
        transactionTimeout: DEFAULT_TRANSACTION_TIMEOUT,
        recipientAddress: "",
        selectedTokenId: "",
      }),
  }),
);

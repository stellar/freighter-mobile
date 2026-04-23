import {
  DEFAULT_TRANSACTION_TIMEOUT,
  MIN_TRANSACTION_FEE,
} from "config/constants";
import { create } from "zustand";

const INITIAL_TRANSACTION_SETTINGS_STATE = {
  transactionMemo: "",
  transactionMemoType: "",
  transactionFee: MIN_TRANSACTION_FEE,
  transactionTimeout: DEFAULT_TRANSACTION_TIMEOUT,
  recipientAddress: "",
  federationAddress: "",
  selectedTokenId: "",
  selectedCollectibleDetails: {
    collectionAddress: "",
    tokenId: "",
  },
};

/**
 * TransactionSettings State Interface
 *
 * Defines the structure of the transaction settings state store using Zustand.
 * This store manages transaction configuration settings including memo, fee, and timeout.
 *
 * @interface TransactionSettingsState
 * @property {string} transactionMemo - Memo text to include with the transaction
 * @property {string} transactionMemoType - Memo type: "text" | "id" | "hash" | "" (from federation record)
 * @property {string} transactionFee - Fee amount for the transaction (in XLM)
 * @property {number} transactionTimeout - Timeout in seconds for the transaction
 * @property {string} recipientAddress - Recipient address for the transaction (resolved G... public key)
 * @property {string} federationAddress - Original federation address (user*domain) if applicable
 * @property {string} selectedTokenId - ID of the token selected for the transaction
 * @property {string} selectedCollectibleDetails - collection ID and token ID of the collectible selected for the transaction
 * @property {Function} saveMemo - Function to save the memo value
 * @property {Function} saveMemoType - Function to save the memo type
 * @property {Function} saveTransactionFee - Function to save the transaction fee value
 * @property {Function} saveTransactionTimeout - Function to save the transaction timeout value
 * @property {Function} saveRecipientAddress - Function to save the recipient address
 * @property {Function} saveFederationAddress - Function to save the federation address
 * @property {Function} saveSelectedTokenId - Function to save the selected token ID
 * @property {Function} saveSelectedCollectibleDetails - Function to save the selected collectible details
 * @property {Function} resetSettings - Function to reset all settings to default values
 */
interface TransactionSettingsState {
  transactionMemo: string;
  transactionMemoType: string;
  transactionFee: string;
  transactionTimeout: number;
  recipientAddress: string;
  federationAddress: string;
  selectedTokenId: string;
  selectedCollectibleDetails: {
    collectionAddress: string;
    tokenId: string;
  };

  saveMemo: (memo: string) => void;
  saveMemoType: (memoType: string) => void;
  saveTransactionFee: (fee: string) => void;
  saveTransactionTimeout: (timeout: number) => void;
  saveRecipientAddress: (address: string) => void;
  saveFederationAddress: (address: string) => void;
  saveSelectedTokenId: (tokenId: string) => void;
  saveSelectedCollectibleDetails: (collectibleDetails: {
    collectionAddress: string;
    tokenId: string;
  }) => void;
  resetSettings: () => void;
}

/**
 * Transaction Settings Store
 *
 * A Zustand store that manages transaction settings.
 */
export const useTransactionSettingsStore = create<TransactionSettingsState>(
  (set) => ({
    ...INITIAL_TRANSACTION_SETTINGS_STATE,

    /**
     * Saves the memo text for a transaction
     * @param {string} transactionMemo - The memo text to save
     */
    saveMemo: (transactionMemo) => set({ transactionMemo }),

    /**
     * Saves the memo type for a transaction (from federation record or user selection)
     * @param {string} memoType - "text" | "id" | "hash" | ""
     */
    saveMemoType: (memoType) => set({ transactionMemoType: memoType }),

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
     * @param {string} address - The recipient address (resolved G... public key)
     */
    saveRecipientAddress: (address) => set({ recipientAddress: address }),

    /**
     * Saves the original federation address for display purposes
     * @param {string} address - The federation address (user*domain)
     */
    saveFederationAddress: (address) => set({ federationAddress: address }),

    /**
     * Saves the selected token ID for the transaction
     * @param {string} tokenId - The token ID
     */
    saveSelectedTokenId: (tokenId) => set({ selectedTokenId: tokenId }),

    /**
     * Saves the selected collectible details for the transaction
     * @param {string} collectibleDetails - The collectible details
     */
    saveSelectedCollectibleDetails: (collectibleDetails: {
      collectionAddress: string;
      tokenId: string;
    }) => set({ selectedCollectibleDetails: collectibleDetails }),

    /**
     * Resets all transaction settings to their default values
     */
    resetSettings: () => set(INITIAL_TRANSACTION_SETTINGS_STATE),
  }),
);

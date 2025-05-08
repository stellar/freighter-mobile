import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { PricedBalance } from "config/types";
import { signTransaction, submitTx } from "services/stellar";
import { buildPaymentTransaction } from "services/transactionService";
import { create } from "zustand";

/**
 * TransactionBuilderState Interface
 *
 * Defines the structure of the transaction builder state using Zustand.
 * This store manages transaction building, signing, and submission.
 */
interface TransactionBuilderState {
  // Transaction state
  transactionXDR: string | null;
  signedTransactionXDR: string | null;
  isBuilding: boolean;
  isSubmitting: boolean;
  transactionHash: string | null;
  error: string | null;

  // Actions
  buildTransaction: (params: {
    tokenValue: string;
    selectedBalance?: PricedBalance;
    recipientAddress?: string;
    transactionMemo?: string;
    transactionFee?: string;
    transactionTimeout?: number;
    network?: NETWORKS;
    publicKey?: string;
  }) => Promise<string | null>;

  signTransaction: (params: {
    secretKey: string;
    network: NETWORKS;
  }) => string | null;

  submitTransaction: (params: { network: NETWORKS }) => Promise<string | null>;

  resetTransaction: () => void;
}

/**
 * Transaction Builder Store
 *
 * A Zustand store that manages transaction building, signing, and submission.
 */
export const useTransactionBuilderStore = create<TransactionBuilderState>(
  (set, get) => ({
    // Initial state
    transactionXDR: null,
    signedTransactionXDR: null,
    isBuilding: false,
    isSubmitting: false,
    transactionHash: null,
    error: null,

    /**
     * Builds a transaction and stores the XDR
     */
    buildTransaction: async (params) => {
      set({ isBuilding: true, error: null });

      try {
        // Directly call the transaction service function
        const xdr = await buildPaymentTransaction({
          tokenValue: params.tokenValue,
          selectedBalance: params.selectedBalance,
          recipientAddress: params.recipientAddress,
          transactionMemo: params.transactionMemo,
          transactionFee: params.transactionFee,
          transactionTimeout: params.transactionTimeout,
          network: params.network,
          publicKey: params.publicKey,
        });

        if (!xdr) {
          throw new Error("Failed to build transaction");
        }

        set({
          transactionXDR: xdr,
          isBuilding: false,
          // Reset other states when building a new transaction
          signedTransactionXDR: null,
          transactionHash: null,
        });

        return xdr;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("TransactionBuilderStore", "Failed to build transaction", {
          error: errorMessage,
        });

        set({
          error: errorMessage,
          isBuilding: false,
          transactionXDR: null,
        });

        return null;
      }
    },

    /**
     * Signs a transaction and stores the signed XDR
     */
    signTransaction: (params) => {
      try {
        const { transactionXDR } = get();

        if (!transactionXDR) {
          throw new Error("No transaction to sign");
        }

        const signedXDR = signTransaction({
          tx: transactionXDR,
          secretKey: params.secretKey,
          network: params.network,
        });

        set({ signedTransactionXDR: signedXDR });
        return signedXDR;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("TransactionBuilderStore", "Failed to sign transaction", {
          error: errorMessage,
        });

        set({ error: errorMessage });
        return null;
      }
    },

    /**
     * Submits a transaction and stores the hash
     */
    submitTransaction: async (params) => {
      set({ isSubmitting: true, error: null });

      try {
        const { signedTransactionXDR } = get();

        if (!signedTransactionXDR) {
          throw new Error("No signed transaction to submit");
        }

        const result = await submitTx({
          tx: signedTransactionXDR,
          network: params.network,
        });

        const { hash } = result;
        set({
          transactionHash: hash,
          isSubmitting: false,
        });

        return hash;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          "TransactionBuilderStore",
          "Failed to submit transaction",
          { error: errorMessage },
        );

        set({
          error: errorMessage,
          isSubmitting: false,
        });

        return null;
      }
    },

    /**
     * Resets the transaction state
     */
    resetTransaction: () => {
      set({
        transactionXDR: null,
        signedTransactionXDR: null,
        isBuilding: false,
        isSubmitting: false,
        transactionHash: null,
        error: null,
      });
    },
  }),
);

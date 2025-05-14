import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { PricedBalance } from "config/types";
import { isContractId } from "helpers/soroban";
import { signTransaction, submitTx } from "services/stellar";
import {
  buildPaymentTransaction,
  prepareSorobanTransaction,
} from "services/transactionService";
import { create } from "zustand";

/**
 * TransactionBuilderState Interface
 *
 * Defines the structure of the transaction builder state using Zustand.
 * This store manages transaction building, signing, and submission.
 */
interface TransactionBuilderState {
  transactionXDR: string | null;
  signedTransactionXDR: string | null;
  isBuilding: boolean;
  isSubmitting: boolean;
  transactionHash: string | null;
  error: string | null;

  buildTransaction: (params: {
    tokenAmount: string;
    selectedBalance?: PricedBalance;
    recipientAddress?: string;
    transactionMemo?: string;
    transactionFee?: string;
    transactionTimeout?: number;
    network?: NETWORKS;
    senderAddress?: string;
  }) => Promise<string | null>;

  signTransaction: (params: {
    secretKey: string;
    network: NETWORKS;
  }) => string | null;

  submitTransaction: (params: { network: NETWORKS }) => Promise<string | null>;

  resetTransaction: () => void;
}

const initialState: Omit<
  TransactionBuilderState,
  | "buildTransaction"
  | "signTransaction"
  | "submitTransaction"
  | "resetTransaction"
> = {
  transactionXDR: null,
  signedTransactionXDR: null,
  isBuilding: false,
  isSubmitting: false,
  transactionHash: null,
  error: null,
};

/**
 * Transaction Builder Store
 *
 * A Zustand store that manages transaction building, signing, and submission.
 */
export const useTransactionBuilderStore = create<TransactionBuilderState>(
  (set, get) => ({
    ...initialState,

    /**
     * Builds a transaction and stores the XDR
     */
    buildTransaction: async (params) => {
      set({ isBuilding: true, error: null });

      try {
        const builtTxResult = await buildPaymentTransaction({
          tokenAmount: params.tokenAmount,
          selectedBalance: params.selectedBalance,
          recipientAddress: params.recipientAddress,
          transactionMemo: params.transactionMemo,
          transactionFee: params.transactionFee,
          transactionTimeout: params.transactionTimeout,
          network: params.network,
          senderAddress: params.senderAddress,
        });

        if (!builtTxResult) {
          throw new Error("Failed to build transaction");
        }

        let finalXdr = builtTxResult.xdr;
        const isRecipientContract =
          params.recipientAddress && isContractId(params.recipientAddress);

        // If sending to a contract, prepare (simulate) the transaction
        if (isRecipientContract && params.network) {
          const networkDetails = mapNetworkToNetworkDetails(params.network);
          finalXdr = await prepareSorobanTransaction({
            tx: builtTxResult.tx,
            networkDetails,
          });
        } else {
          logger.warn(
            "TransactionBuilderStore",
            "Recipient is not a contract, using standard transaction XDR.",
          );
        }

        set({
          transactionXDR: finalXdr,
          isBuilding: false,
          signedTransactionXDR: null,
          transactionHash: null,
        });

        return finalXdr;
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
        ...initialState,
      });
    },
  }),
);

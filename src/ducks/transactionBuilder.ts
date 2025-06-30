import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { PricedBalance } from "config/types";
import { xlmToStroop } from "helpers/formatAmount";
import { isContractId } from "helpers/soroban";
import { signTransaction, submitTx } from "services/stellar";
import {
  buildPaymentTransaction,
  buildSwapTransaction,
  simulateContractTransfer,
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
  requestId: string | null;

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

  buildSwapTransaction: (params: {
    sourceAmount: string;
    sourceBalance: PricedBalance;
    destinationBalance: PricedBalance;
    path: string[];
    destinationAmount: string;
    destinationAmountMin: string;
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
  | "buildSwapTransaction"
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
  requestId: null,
};

// Unique id to correlate async responses to the latest request
const createRequestId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
      // Tag this build cycle
      const newRequestId = createRequestId();

      // Mark new cycle and reset flags
      set({ isBuilding: true, error: null, requestId: newRequestId });

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
        if (isRecipientContract && params.network && params.senderAddress) {
          const networkDetails = mapNetworkToNetworkDetails(params.network);
          finalXdr = await simulateContractTransfer({
            transaction: builtTxResult.tx,
            networkDetails,
            memo: params.transactionMemo || "",
            params: {
              publicKey: params.senderAddress,
              destination: params.recipientAddress!,
              amount: xlmToStroop(params.tokenAmount).toString(),
            },
            contractAddress: builtTxResult.contractId!,
          });
        } else {
          logger.warn(
            "TransactionBuilderStore",
            "Recipient is not a contract, using standard transaction XDR.",
          );
        }

        // Ignore if an even newer cycle started
        if (get().requestId === newRequestId) {
          set({
            transactionXDR: finalXdr,
            isBuilding: false,
            signedTransactionXDR: null,
            transactionHash: null,
          });
        }

        return finalXdr;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("TransactionBuilderStore", "Failed to build transaction", {
          error: errorMessage,
        });

        if (get().requestId === newRequestId) {
          set({
            error: errorMessage,
            isBuilding: false,
            transactionXDR: null,
          });
        }

        return null;
      }
    },

    /**
     * Builds a swap transaction and stores the XDR
     */
    buildSwapTransaction: async (params) => {
      // Tag this build cycle
      const newRequestId = createRequestId();

      // Mark new cycle and reset flags
      set({ isBuilding: true, error: null, requestId: newRequestId });

      try {
        const builtTxResult = await buildSwapTransaction({
          sourceAmount: params.sourceAmount,
          sourceBalance: params.sourceBalance,
          destinationBalance: params.destinationBalance,
          path: params.path,
          destinationAmount: params.destinationAmount,
          destinationAmountMin: params.destinationAmountMin,
          transactionFee: params.transactionFee,
          transactionTimeout: params.transactionTimeout,
          network: params.network,
          senderAddress: params.senderAddress,
        });

        if (!builtTxResult) {
          throw new Error("Failed to build swap transaction");
        }

        // For swaps, we don't need Soroban preparation since we're using pathPaymentStrictSend
        const finalXdr = builtTxResult.xdr;

        // Ignore if an even newer cycle started
        if (get().requestId === newRequestId) {
          set({
            transactionXDR: finalXdr,
            isBuilding: false,
            signedTransactionXDR: null,
            transactionHash: null,
          });
        }

        return finalXdr;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          "TransactionBuilderStore",
          "Failed to build swap transaction",
          {
            error: errorMessage,
          },
        );

        if (get().requestId === newRequestId) {
          set({
            error: errorMessage,
            isBuilding: false,
            transactionXDR: null,
          });
        }

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
      // Tag this submit cycle (reuse current id if exists)
      const currentRequestId = get().requestId || createRequestId();
      set({ isSubmitting: true, error: null, requestId: currentRequestId });

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

        // Ignore if another submit started later
        if (get().requestId === currentRequestId) {
          set({
            transactionHash: hash,
            isSubmitting: false,
          });
        }

        return hash;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          "TransactionBuilderStore",
          "Failed to submit transaction",
          {
            error: errorMessage,
          },
        );

        if (get().requestId === currentRequestId) {
          set({ error: errorMessage, isSubmitting: false });
        }

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

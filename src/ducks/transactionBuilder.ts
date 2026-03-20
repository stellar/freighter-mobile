import BigNumber from "bignumber.js";
import {
  MIN_TRANSACTION_FEE,
  NETWORKS,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import { PricedBalance } from "config/types";
import { useDebugStore } from "ducks/debug";
import { stroopToXlm } from "helpers/formatAmount";
import { isContractId } from "helpers/soroban";
import { isMuxedAccount } from "helpers/stellar";
import { t } from "i18next";
import { signTransaction, submitTx } from "services/stellar";
import {
  buildPaymentTransaction,
  buildSendCollectibleTransaction,
  buildSwapTransaction,
  simulateCollectibleTransfer,
  simulateContractTransfer,
} from "services/transactionService";
import { create } from "zustand";

/**
 * Extracts a human-readable error message from any thrown value.
 * Handles native Error instances, ApiError plain objects (from apiFactory),
 * and arbitrary values. Prevents "[object Object]" from reaching the UI.
 */
const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
};

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
  isSoroban: boolean;
  sorobanResourceFeeXlm: string | null;
  sorobanInclusionFeeXlm: string | null;

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
    transactionMemo?: string;
    transactionFee?: string;
    transactionTimeout?: number;
    network?: NETWORKS;
    senderAddress?: string;
  }) => Promise<string | null>;

  buildSendCollectibleTransaction: (params: {
    collectionAddress: string;
    destinationAccount: string;
    tokenId: number;
    transactionFee: string;
    transactionTimeout: number;
    transactionMemo?: string;
    network: NETWORKS;
    senderAddress: string;
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
  | "buildSendCollectibleTransaction"
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
  isSoroban: false,
  sorobanResourceFeeXlm: null,
  sorobanInclusionFeeXlm: null,
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

      // Determine Soroban status early from params so the UI can show the
      // correct fee label ("Inclusion Fee" vs "Transaction Fee") before
      // the build/simulation completes.
      const isSorobanTx = Boolean(
        (params.selectedBalance &&
          "contractId" in params.selectedBalance &&
          params.selectedBalance.contractId) ||
          (params.recipientAddress && isContractId(params.recipientAddress)),
      );

      // Mark new cycle and reset flags (clear stale Soroban fees so UI doesn't
      // show outdated data while the new build is in progress)
      set({
        isBuilding: true,
        error: null,
        requestId: newRequestId,
        isSoroban: isSorobanTx,
        sorobanResourceFeeXlm: null,
        sorobanInclusionFeeXlm: null,
      });

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
        let sorobanResourceFeeXlm: string | null = null;
        let sorobanInclusionFeeXlm: string | null = null;
        const isRecipientContract =
          params.recipientAddress && isContractId(params.recipientAddress);

        // Check if this is a custom token (SorobanBalance with contractId)
        const isCustomToken =
          params.selectedBalance &&
          "contractId" in params.selectedBalance &&
          params.selectedBalance.contractId;

        // If sending to a contract OR using a custom token, prepare (simulate) the transaction
        // Custom tokens (SorobanBalance) always need simulation for proper fees and resources
        const shouldSimulate =
          (isRecipientContract || isCustomToken) && builtTxResult.contractId;

        if (shouldSimulate && params.network && params.senderAddress) {
          const networkDetails = mapNetworkToNetworkDetails(params.network);
          const isFeeEstimation = Number(params.tokenAmount) === 0;

          let simulateResult;

          if (isFeeEstimation) {
            // Fee estimation with amount 0: use /simulate-tx with the
            // locally-built XDR. The /simulate-token-transfer endpoint
            // rejects amount 0 because it rebuilds the tx server-side.
            simulateResult = await simulateCollectibleTransfer({
              transactionXdr: builtTxResult.xdr,
              networkDetails,
            });
          } else {
            // Real amount: use /simulate-token-transfer matching the
            // extension's flow (backend builds + simulates the tx).
            const finalDestination =
              builtTxResult.finalDestination || params.recipientAddress!;
            const isDestinationMuxed = isMuxedAccount(finalDestination);
            const memoForSimulation = isDestinationMuxed
              ? ""
              : params.transactionMemo || "";

            simulateResult = await simulateContractTransfer({
              transaction: builtTxResult.tx,
              networkDetails,
              memo: memoForSimulation,
              params: {
                publicKey: params.senderAddress,
                destination: finalDestination,
                amount: Number(builtTxResult.amountInBaseUnits ?? 0),
              },
              contractAddress: builtTxResult.contractId!,
            });
          }

          if (!simulateResult.preparedTransaction) {
            throw new Error("Simulation returned no prepared transaction XDR");
          }
          finalXdr = simulateResult.preparedTransaction;

          if (simulateResult.minResourceFee) {
            const resourceFeeBn = new BigNumber(simulateResult.minResourceFee);
            if (!resourceFeeBn.isNaN()) {
              sorobanResourceFeeXlm = stroopToXlm(resourceFeeBn).toFixed(7);
              sorobanInclusionFeeXlm =
                params.transactionFee || MIN_TRANSACTION_FEE;
            }
          }
        }

        // Only update store if this build request is still the latest one.
        // This prevents race conditions where a slow async response from
        // an older transaction overwrites state from a newer one.
        if (get().requestId === newRequestId) {
          set({
            transactionXDR: finalXdr,
            isBuilding: false,
            signedTransactionXDR: null,
            transactionHash: null,
            isSoroban: Boolean(shouldSimulate),
            sorobanResourceFeeXlm,
            sorobanInclusionFeeXlm,
          });
        }

        return finalXdr;
      } catch (error) {
        const errorMessage = extractErrorMessage(error);

        logger.error(
          "TransactionBuilderStore",
          "Failed to build transaction",
          error,
        );
        // Only set error state if this build request is still current.
        // Prevents stale error from overwriting newer transaction state.
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
        // Check debug override for forced build failure
        const { forceBuildTransactionFailure } = useDebugStore.getState();

        if (forceBuildTransactionFailure) {
          throw new Error(t("debug.debugMessages.buildFailure"));
        }

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

        // Only update store if this swap build is still the latest one.
        // Prevents race conditions from concurrent swap transactions.
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
        const errorMessage = extractErrorMessage(error);
        logger.error(
          "TransactionBuilderStore",
          "Failed to build swap transaction",
          error,
        );

        // Only set error state if this swap build is still current.
        // Prevents stale swap error from overwriting newer transaction state.
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
     * Builds a send collectible transaction and stores the XDR
     */
    buildSendCollectibleTransaction: async (params) => {
      // Tag this build cycle
      const newRequestId = createRequestId();

      // Mark new cycle and reset flags (clear stale Soroban fees so UI doesn't
      // show outdated data while the new build is in progress)
      // Collectibles are always Soroban transactions.
      set({
        isBuilding: true,
        error: null,
        requestId: newRequestId,
        isSoroban: true,
        sorobanResourceFeeXlm: null,
        sorobanInclusionFeeXlm: null,
      });

      try {
        const builtTxResult = await buildSendCollectibleTransaction({
          collectionAddress: params.collectionAddress,
          tokenId: params.tokenId,
          recipientAddress: params.destinationAccount,
          transactionMemo: params.transactionMemo,
          transactionFee: params.transactionFee,
          transactionTimeout: params.transactionTimeout,
          network: params.network,
          senderAddress: params.senderAddress,
        });

        if (!builtTxResult) {
          throw new Error("Failed to build send collectible transaction");
        }

        const networkDetails = mapNetworkToNetworkDetails(params.network);

        // Simulate the collectible transfer transaction to get proper fees and resources
        // The transaction XDR already contains the muxed address (if applicable) from buildSendCollectibleTransaction
        // which checks contract muxed support and creates muxed addresses according to the behavior matrix
        const simulateResult = await simulateCollectibleTransfer({
          transactionXdr: builtTxResult.tx.toXDR(),
          networkDetails,
        });

        if (!simulateResult.preparedTransaction) {
          throw new Error(
            "Collectible simulation returned no prepared transaction XDR",
          );
        }
        const finalXdr = simulateResult.preparedTransaction;
        const sorobanResourceFeeXlm = simulateResult.minResourceFee
          ? stroopToXlm(new BigNumber(simulateResult.minResourceFee)).toFixed(7)
          : null;
        const sorobanInclusionFeeXlm =
          params.transactionFee || MIN_TRANSACTION_FEE;

        // Only update store if this build request is still the latest one.
        // This prevents race conditions where a slow async response from
        // an older transaction overwrites state from a newer one.
        if (get().requestId === newRequestId) {
          set({
            transactionXDR: finalXdr,
            isBuilding: false,
            signedTransactionXDR: null,
            transactionHash: null,
            isSoroban: true,
            sorobanResourceFeeXlm,
            sorobanInclusionFeeXlm,
          });
        }

        return finalXdr;
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        logger.error(
          "TransactionBuilderStore",
          "Failed to build send collectible transaction",
          error,
        );
        // Only set error state if this send collectible build is still current.
        // Prevents stale send collectible error from overwriting newer transaction state.
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
        // Check debug override for forced sign failure
        const { forceSignTransactionFailure } = useDebugStore.getState();

        if (forceSignTransactionFailure) {
          throw new Error(t("debug.debugMessages.signFailure"));
        }

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
        const errorMessage = extractErrorMessage(error);
        logger.error(
          "TransactionBuilderStore",
          "Failed to sign transaction",
          error,
        );

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

      // Check debug override for forced submit failure BEFORE the try-catch
      // so the error propagates directly to the caller
      const { forceSubmitTransactionFailure } = useDebugStore.getState();

      if (forceSubmitTransactionFailure) {
        // Simulate network submission delay
        await new Promise((resolve) => {
          setTimeout(resolve, 5000);
        });

        const debugErrorMessage = t("debug.debugMessages.submitFailure");

        logger.error(
          "TransactionBuilderStore",
          "DEBUG: About to throw submit error:",
          debugErrorMessage,
        );

        set({ error: debugErrorMessage, isSubmitting: false });
        throw new Error(debugErrorMessage);
      }

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

        // Only update with success if this submit is still the latest one.
        // Guards against late responses from previous submits showing wrong hash.
        if (get().requestId === currentRequestId) {
          set({
            transactionHash: hash,
            isSubmitting: false,
          });
        }

        return hash;
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        logger.error(
          "TransactionBuilderStore",
          "Failed to submit transaction",
          error,
        );

        // Only set error state if this submit request is still current.
        // Prevents stale submit error from affecting newer transaction flows.
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

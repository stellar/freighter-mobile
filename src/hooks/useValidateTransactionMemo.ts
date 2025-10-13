import { TransactionBuilder } from "@stellar/stellar-sdk";
import {
  mapNetworkToNetworkDetails,
  STORAGE_KEYS,
  TRANSACTION_WARNING,
} from "config/constants";
import { logger } from "config/logger";
import { MemoRequiredAccountsApiResponse } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { cachedFetch } from "helpers/cachedFetch";
import { isMainnet } from "helpers/networks";
import { getApiStellarExpertIsMemoRequiredListUrl } from "helpers/stellarExpert";
import { useCallback, useEffect, useMemo, useState } from "react";
import { stellarSdkServer } from "services/stellar";

/**
 * Hook to validate transaction memos for addresses that require them
 *
 * This hook checks if a transaction destination address requires a memo by:
 * 1. Checking a cached list of memo-required addresses from StellarExpert API
 * 2. Falling back to Stellar SDK's checkMemoRequired method
 * 3. Only validating on mainnet when memo validation is enabled in preferences
 *
 * @param {string | null | undefined} incomingXdr - The transaction XDR string to validate
 * @returns {Object} Validation state and results
 * @returns {boolean} returns.isMemoMissing - Whether a required memo is missing
 * @returns {boolean} returns.isValidatingMemo - Whether validation is currently in progress
 *
 * @example
 * ```tsx
 * const { isMemoMissing, isValidatingMemo } = useValidateTransactionMemo(transactionXDR);
 *
 * if (isMemoMissing && !isValidatingMemo) {
 *   // Show warning that memo is required
 * }
 * ```
 */
export const useValidateTransactionMemo = (incomingXdr?: string | null) => {
  const { network } = useAuthenticationStore();
  const { isMemoValidationEnabled } = usePreferencesStore();
  const { transactionMemo } = useTransactionSettingsStore();
  const [localMemo, setLocalMemo] = useState<string>(transactionMemo ?? "");
  const [isValidatingMemo, setIsValidatingMemo] = useState(false);
  const [localTransaction, setLocalTransaction] = useState<ReturnType<
    typeof TransactionBuilder.fromXDR
  > | null>(null);
  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  const xdr = useMemo(() => incomingXdr, [incomingXdr]);

  /**
   * Determines if memo validation should be performed
   * Only validates on mainnet when the feature is enabled in preferences
   */
  const shouldValidateMemo = useMemo(
    () => !!(isMemoValidationEnabled && isMainnet(network)),
    [isMemoValidationEnabled, network],
  );
  const [isMemoMissing, setIsMemoMissing] = useState(shouldValidateMemo);

  /**
   * Checks if a memo is required by querying cached memo-required accounts
   *
   * @param {ReturnType<typeof TransactionBuilder.fromXDR>} transaction - The transaction to check
   * @returns {Promise<boolean>} True if a memo is required, false otherwise
   */
  const checkMemoRequiredFromCache = useCallback(
    async (
      transaction: ReturnType<typeof TransactionBuilder.fromXDR>,
    ): Promise<boolean> => {
      const response = await cachedFetch<MemoRequiredAccountsApiResponse>(
        getApiStellarExpertIsMemoRequiredListUrl(),
        STORAGE_KEYS.MEMO_REQUIRED_ACCOUNTS,
      );

      // eslint-disable-next-line no-underscore-dangle
      const memoRequiredAccounts = response._embedded.records || [];

      const destination = transaction.operations.find(
        (operation) => "destination" in operation,
      )?.destination;

      const matchingBlockedTags = memoRequiredAccounts
        .filter(({ address }) => address === destination)
        .flatMap(({ tags }) => tags);

      return matchingBlockedTags.some(
        (tag) => tag === (TRANSACTION_WARNING.memoRequired as string),
      );
    },
    [],
  );

  /**
   * Checks if a memo is required using Stellar SDK's built-in validation
   * This is a fallback method when cache validation fails
   *
   * @param {ReturnType<typeof TransactionBuilder.fromXDR>} transaction - The transaction to check
   * @returns {Promise<boolean>} True if a memo is required, false otherwise
   */
  const checkMemoRequiredFromStellarSDK = useCallback(
    async (
      transaction: ReturnType<typeof TransactionBuilder.fromXDR>,
    ): Promise<boolean> => {
      const server = stellarSdkServer(networkDetails.networkUrl);

      await server.checkMemoRequired(transaction);
      return false;
    },
    [networkDetails.networkUrl],
  );

  /**
   * Effect to parse XDR and set initial memo validation state
   * Runs when XDR, network, or validation settings change
   */
  useEffect(() => {
    if (!shouldValidateMemo) {
      setIsMemoMissing(false);
      return;
    }

    if (!xdr || !network) {
      return;
    }

    const transaction = TransactionBuilder.fromXDR(xdr, network);
    const memo =
      "memo" in transaction && transaction.memo.value
        ? String(transaction.memo.value)
        : (transactionMemo ?? "");

    setLocalMemo(memo);
    setLocalTransaction(transaction);
    setIsMemoMissing(shouldValidateMemo && !memo);
  }, [xdr, shouldValidateMemo, network, transactionMemo]);

  /**
   * Effect to perform memo requirement validation
   * Checks both cache and SDK methods to determine if memo is required
   */
  useEffect(() => {
    if (!shouldValidateMemo) {
      setIsMemoMissing(false);

      return;
    }
    if (!localTransaction) {
      return;
    }

    if (localMemo) {
      setIsMemoMissing(false);
      return;
    }

    const checkIsMemoRequired = async () => {
      setIsValidatingMemo(true);

      try {
        const [isMemoRequiredFromCache, isMemoRequiredFromSDK] =
          await Promise.all([
            checkMemoRequiredFromCache(localTransaction),
            checkMemoRequiredFromStellarSDK(localTransaction),
          ]);

        setIsMemoMissing(isMemoRequiredFromSDK || isMemoRequiredFromCache);
      } catch (error) {
        logger.error("Memo Validation", "Error validating memo", error);

        // If there's any error, we assume the memo is missing to be safe
        // so we prevent lost of funds due to a missing memo.
        setIsMemoMissing(true);
      } finally {
        setIsValidatingMemo(false);
      }
    };

    checkIsMemoRequired();
  }, [
    localMemo,
    localTransaction,
    shouldValidateMemo,
    checkMemoRequiredFromCache,
    checkMemoRequiredFromStellarSDK,
    networkDetails.networkUrl,
    network,
    xdr,
  ]);

  return { isMemoMissing, isValidatingMemo };
};

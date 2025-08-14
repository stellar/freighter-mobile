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

  const shouldValidateMemo = useMemo(
    () => isMemoValidationEnabled && isMainnet(network),
    [isMemoValidationEnabled, network],
  );
  const [isMemoMissing, setIsMemoMissing] = useState(shouldValidateMemo);

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

  const checkMemoRequiredFromStellarSDK = useCallback(
    async (
      transaction: ReturnType<typeof TransactionBuilder.fromXDR>,
    ): Promise<boolean> => {
      const server = stellarSdkServer(networkDetails.networkUrl);

      try {
        await server.checkMemoRequired(transaction);
        return false;
      } catch (error) {
        return true;
      }
    },
    [networkDetails.networkUrl],
  );

  useEffect(() => {
    if (!xdr || !network || !shouldValidateMemo) {
      return;
    }

    const transaction = TransactionBuilder.fromXDR(xdr, network);
    const memo =
      "memo" in transaction && transaction.memo.value
        ? String(transaction.memo.value).trim()
        : (transactionMemo ?? "");

    setLocalMemo(memo);
    setLocalTransaction(transaction);
    setIsMemoMissing(shouldValidateMemo && !memo);
  }, [xdr, shouldValidateMemo, network, transactionMemo]);

  useEffect(() => {
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
        const isMemoRequiredFromCache =
          await checkMemoRequiredFromCache(localTransaction);

        if (isMemoRequiredFromCache) {
          setIsMemoMissing(true);
          return;
        }

        const isMemoRequiredFromSDK =
          await checkMemoRequiredFromStellarSDK(localTransaction);

        setIsMemoMissing(isMemoRequiredFromSDK);
      } catch (error) {
        logger.error("Memo Validation", "Error validating memo", { error });
        if (error instanceof Error && "accountId" in error) {
          setIsMemoMissing(true);
        } else {
          setIsMemoMissing(false);
        }
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

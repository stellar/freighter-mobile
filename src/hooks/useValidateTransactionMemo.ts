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
  const [isValidatingMemo, setIsValidatingMemo] = useState(false);
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
    async (txXDR: string, networkType: string): Promise<boolean> => {
      const response = await cachedFetch<MemoRequiredAccountsApiResponse>(
        getApiStellarExpertIsMemoRequiredListUrl(),
        STORAGE_KEYS.MEMO_REQUIRED_ACCOUNTS,
      );

      // eslint-disable-next-line no-underscore-dangle
      const memoRequiredAccounts = response._embedded.records || [];
      const transaction = TransactionBuilder.fromXDR(txXDR, networkType);

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
    async (txXDR: string, networkUrl: string): Promise<boolean> => {
      const server = stellarSdkServer(networkUrl);
      const transaction = TransactionBuilder.fromXDR(txXDR, network);

      try {
        await server.checkMemoRequired(transaction);
        return false;
      } catch (error) {
        return true;
      }
    },
    [network],
  );

  useEffect(() => {
    if (!transactionMemo) {
      setIsMemoMissing(shouldValidateMemo);
    }
  }, [transactionMemo, shouldValidateMemo]);

  useEffect(() => {
    if (transactionMemo) {
      setIsMemoMissing(false);
      return;
    }

    if (!network || !xdr || !shouldValidateMemo || !networkDetails.networkUrl) {
      return;
    }

    const checkIsMemoRequired = async () => {
      setIsValidatingMemo(true);

      try {
        const isMemoRequiredFromCache = await checkMemoRequiredFromCache(
          xdr,
          network,
        );

        if (isMemoRequiredFromCache) {
          setIsMemoMissing(true);
          return;
        }

        const isMemoRequiredFromSDK = await checkMemoRequiredFromStellarSDK(
          xdr,
          networkDetails.networkUrl,
        );

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
    xdr,
    network,
    shouldValidateMemo,
    networkDetails.networkUrl,
    transactionMemo,
    checkMemoRequiredFromCache,
    checkMemoRequiredFromStellarSDK,
  ]);

  return { isMemoMissing, isValidatingMemo };
};

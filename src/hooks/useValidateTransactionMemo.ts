import { TransactionBuilder } from "@stellar/stellar-sdk";
import {
  mapNetworkToNetworkDetails,
  STORAGE_KEYS,
  TRANSACTION_WARNING,
} from "config/constants";
import { MemoRequiredAccountsApiResponse } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { cachedFetch } from "helpers/cachedFetch";
import { isMainnet } from "helpers/networks";
import { getApiStellarExpertIsMemoRequiredListUrl } from "helpers/stellarExpert";
import { useCallback, useEffect, useMemo, useState } from "react";
import { stellarSdkServer } from "services/stellar";

export const useValidateTransactionMemo = () => {
  const { network } = useAuthenticationStore();
  const { transactionXDR } = useTransactionBuilderStore();
  const { isMemoValidationEnabled } = usePreferencesStore();
  const { transactionMemo } = useTransactionSettingsStore();
  const [isValidatingMemo, setIsValidatingMemo] = useState(false);
  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  const shouldValidateMemo = isMemoValidationEnabled && isMainnet(network);
  const [isMemoRequiredMemoMissing, setIsMemoRequiredMemoMissing] =
    useState(shouldValidateMemo);

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
    if (transactionMemo) {
      setIsMemoRequiredMemoMissing(false);
      return;
    }
    if (
      !network ||
      !transactionXDR ||
      !shouldValidateMemo ||
      !networkDetails.networkUrl
    ) {
      return;
    }

    const checkIsMemoRequired = async () => {
      setIsValidatingMemo(true);

      try {
        const isMemoRequiredFromCache = await checkMemoRequiredFromCache(
          transactionXDR,
          network,
        );

        if (isMemoRequiredFromCache) {
          setIsMemoRequiredMemoMissing(true);
          return;
        }

        const isMemoRequiredFromSDK = await checkMemoRequiredFromStellarSDK(
          transactionXDR,
          networkDetails.networkUrl,
        );

        setIsMemoRequiredMemoMissing(isMemoRequiredFromSDK);
      } catch (error) {
        setIsMemoRequiredMemoMissing(true);
      } finally {
        setIsValidatingMemo(false);
      }
    };

    checkIsMemoRequired();
  }, [
    transactionXDR,
    network,
    shouldValidateMemo,
    networkDetails.networkUrl,
    transactionMemo,
    checkMemoRequiredFromCache,
    checkMemoRequiredFromStellarSDK,
  ]);

  return { isMemoRequiredMemoMissing, isValidatingMemo };
};

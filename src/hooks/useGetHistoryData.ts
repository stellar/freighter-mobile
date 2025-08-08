import { Horizon } from "@stellar/stellar-sdk";
import { NetworkDetails } from "config/constants";
import { BalanceMap, HookStatus } from "config/types";
import { useBalancesStore } from "ducks/balances";
import {
  getIsDustPayment,
  getIsPayment,
  getIsSwap,
  filterOperationsByAsset,
  getIsCreateClaimableBalanceSpam,
} from "helpers/history";
import { useEffect, useState } from "react";
import { getAccountHistory } from "services/backend";

export type HistoryItemOperation = Horizon.ServerApi.OperationRecord & {
  isCreateExternalAccount: boolean;
  isPayment: boolean;
  isSwap: boolean;
};

export type HistorySection = {
  monthYear: string; // in format {month}:{year}
  operations: HistoryItemOperation[];
};

interface HistoryData {
  balances: BalanceMap;
  history: HistorySection[];
}

interface UseGetHistoryDataParams {
  publicKey: string;
  networkDetails: NetworkDetails;
  isHideDustEnabled?: boolean;
  tokenId?: string;
}

const createHistorySections = (
  publicKey: string,
  operations: Horizon.ServerApi.OperationRecord[],
  isHideDustEnabled: boolean,
) =>
  operations.reduce(
    (
      sections: HistorySection[],
      operation: Horizon.ServerApi.OperationRecord,
    ) => {
      const isPayment = getIsPayment(operation.type);
      const isSwap = getIsSwap(operation);
      const isCreateExternalAccount =
        operation.type ===
          Horizon.HorizonApi.OperationResponseType.createAccount &&
        operation.account !== publicKey;

      const isDustPayment = getIsDustPayment(publicKey, operation);

      const parsedOperation = {
        ...operation,
        isPayment,
        isSwap,
        isCreateExternalAccount,
      };

      if (isDustPayment && isHideDustEnabled) {
        return sections;
      }

      if (getIsCreateClaimableBalanceSpam(operation)) {
        return sections;
      }

      const date = new Date(operation.created_at);
      const month = date.getMonth();
      const year = date.getFullYear();
      const monthYear = `${month}:${year}`;

      const lastSection = sections.length > 0 && sections[sections.length - 1];

      // if we have no sections yet, let's create the first one
      if (!lastSection) {
        return [{ monthYear, operations: [parsedOperation] }];
      }

      // if element belongs to this section let's add it right away
      if (lastSection.monthYear === monthYear) {
        lastSection.operations.push(parsedOperation);
        return sections;
      }

      // otherwise let's add a new section at the bottom of the array
      return [...sections, { monthYear, operations: [parsedOperation] }];
    },
    [] as HistorySection[],
  );

function useGetHistoryData({
  publicKey,
  networkDetails,
  isHideDustEnabled,
  tokenId,
}: UseGetHistoryDataParams) {
  const { fetchAccountBalances, getBalances } = useBalancesStore();
  const [status, setStatus] = useState<HookStatus>(HookStatus.IDLE);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [rawHistory, setRawHistory] = useState<
    Horizon.ServerApi.OperationRecord[]
  >([]);

  useEffect(() => {
    if (rawHistory.length) {
      const balances = getBalances();
      setHistoryData({
        balances,
        history: createHistorySections(
          publicKey,
          rawHistory,
          !!isHideDustEnabled,
        ),
      });
    }
  }, [isHideDustEnabled, publicKey, rawHistory, getBalances]);

  const fetchData = async ({ isRefresh = false }: { isRefresh?: boolean }) => {
    setStatus(isRefresh ? HookStatus.REFRESHING : HookStatus.LOADING);
    try {
      await fetchAccountBalances({
        publicKey,
        network: networkDetails.network,
      });

      let history = await getAccountHistory({
        publicKey,
        networkDetails,
      });

      if (tokenId) {
        history = filterOperationsByAsset(history, tokenId, networkDetails);
      }

      const balances = getBalances();

      setRawHistory(history);
      const payload = {
        balances,
        history: createHistorySections(publicKey, history, !!isHideDustEnabled),
      };

      setHistoryData(payload);
      setStatus(HookStatus.SUCCESS);
      return payload;
    } catch (error) {
      setStatus(HookStatus.ERROR);
      return error;
    }
  };

  return {
    status,
    fetchData,
    historyData,
  };
}

export { useGetHistoryData };

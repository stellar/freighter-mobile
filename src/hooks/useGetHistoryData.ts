import { DEFAULT_REFRESH_DELAY, NetworkDetails } from "config/constants";
import { useHistoryStore, HistoryData, HistoryDataV2 } from "ducks/history";
import { usePreferencesStore } from "ducks/preferences";
import { useCallback, useEffect, useMemo, useState } from "react";

interface UseGetHistoryDataProps {
  publicKey: string;
  networkDetails: NetworkDetails;
  tokenId?: string;
}

interface UseGetHistoryDataReturn {
  historyData: HistoryData | HistoryDataV2 | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isNavigationRefresh: boolean;
  fetchData: (params?: {
    isRefresh?: boolean;
    isBackgroundRefresh?: boolean;
  }) => Promise<void>;
}

/**
 * Hook for managing history data using the centralized history store
 *
 * This hook provides a clean interface for components to access history data
 * Polling is handled centrally in TabNavigator for consistent behavior.
 *
 * @param publicKey - The account public key
 * @param networkDetails - Network configuration details
 * @param tokenId - Optional token ID for filtering operations
 * @returns Object containing history data, status, and fetch function
 */
function useGetHistoryData({
  publicKey,
  networkDetails,
  tokenId,
}: UseGetHistoryDataProps): UseGetHistoryDataReturn {
  const {
    rawHistoryData,
    rawHistoryV2Data,
    isLoading,
    error,
    hasRecentTransaction,
    isFetching,
    fetchAccountHistory,
    getFilteredHistoryData,
  } = useHistoryStore();

  const [isMounting, setIsMounting] = useState(true);
  const [hasAttemptedInitialLoad, setHasAttemptedInitialLoad] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isHideDustEnabled } = usePreferencesStore();

  // rawHistoryData and rawHistoryV2Data are mutually exclusive in
  // ducks/history.ts (never both set — see loadedHistoryAccount), so this
  // hook doesn't need to pick a shape itself: whichever field is populated
  // determines which shape getFilteredHistoryData hands back. Gate on both
  // so a v2-only account (rawHistoryData null, rawHistoryV2Data populated)
  // still renders instead of being treated as "no data yet".
  const historyData = useMemo(() => {
    if (!rawHistoryData && !rawHistoryV2Data) return null;

    return getFilteredHistoryData({
      publicKey,
      network: networkDetails.network,
      tokenId,
      isHideDustEnabled,
    });
  }, [
    rawHistoryData,
    rawHistoryV2Data,
    getFilteredHistoryData,
    publicKey,
    networkDetails.network,
    tokenId,
    isHideDustEnabled,
  ]);

  // Initial data fetch
  const fetchInitialData = useCallback(async () => {
    if (!publicKey) return;

    try {
      await fetchAccountHistory({
        publicKey,
        network: networkDetails.network,
      });
    } finally {
      setHasAttemptedInitialLoad(true);
      setIsMounting(false);
    }
  }, [fetchAccountHistory, publicKey, networkDetails.network]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const fetchData = useCallback(
    async (params?: { isRefresh?: boolean; isBackgroundRefresh?: boolean }) => {
      const isRefresh = params?.isRefresh ?? false;
      const isBackgroundRefresh = params?.isBackgroundRefresh ?? false;

      if (isRefresh) {
        setIsRefreshing(true);
      }

      try {
        await fetchAccountHistory({
          publicKey,
          network: networkDetails.network,
          isBackgroundRefresh,
        });
      } finally {
        if (isRefresh) {
          // Add a minimum spinner delay only for native RefreshControl to prevent flickering
          setTimeout(() => {
            setIsRefreshing(false);
          }, DEFAULT_REFRESH_DELAY);
        }
      }
    },
    [fetchAccountHistory, publicKey, networkDetails.network],
  );

  // Only show error if we're not in the initial loading state and there is an error
  const shouldShowError = !isMounting && hasAttemptedInitialLoad && error;

  // Only show full-screen loading when there's no existing data and we're loading for the first time
  const shouldShowFullScreenLoading =
    (isLoading || isMounting) &&
    !isRefreshing &&
    !rawHistoryData &&
    !rawHistoryV2Data;

  const shouldShowRefreshIndicator = hasRecentTransaction && isFetching;

  return {
    historyData,
    error: shouldShowError ? error : null,
    isLoading: shouldShowFullScreenLoading,
    isRefreshing,
    isNavigationRefresh: shouldShowRefreshIndicator,
    fetchData,
  };
}

export { useGetHistoryData };
export type {
  HistoryItemOperation,
  HistorySection,
  HistorySectionV2,
  HistoryData,
  HistoryDataV2,
} from "ducks/history";

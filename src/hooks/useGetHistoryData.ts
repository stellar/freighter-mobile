import { DEFAULT_REFRESH_DELAY, NetworkDetails } from "config/constants";
import { useHistoryStore, HistoryData } from "ducks/history";
import { usePreferencesStore } from "ducks/preferences";
import { useCallback, useEffect, useMemo, useState } from "react";

interface UseGetHistoryDataProps {
  publicKey: string;
  networkDetails: NetworkDetails;
  tokenId?: string;
  shouldPoll?: boolean;
}

interface UseGetHistoryDataReturn {
  historyData: HistoryData | null;
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
 * while leveraging the centralized store for state management and polling.
 * Follows the same pattern as useBalancesList for consistent behavior.
 *
 * @param publicKey - The account public key
 * @param networkDetails - Network configuration details
 * @param tokenId - Optional token ID for filtering operations
 * @param shouldPoll - Whether to enable automatic polling (default: true)
 * @returns Object containing history data, status, and fetch function
 */
function useGetHistoryData({
  publicKey,
  networkDetails,
  tokenId,
  shouldPoll = true,
}: UseGetHistoryDataProps): UseGetHistoryDataReturn {
  const {
    rawHistoryData,
    isLoading,
    error,
    shouldRefreshAfterNavigation,
    fetchAccountHistory,
    getFilteredHistoryData,
    startPolling,
    stopPolling,
    clearRefreshAfterNavigation,
  } = useHistoryStore();

  const [isMounting, setIsMounting] = useState(true);
  const [hasAttemptedInitialLoad, setHasAttemptedInitialLoad] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNavigationRefresh, setIsNavigationRefresh] = useState(false);
  const { isHideDustEnabled } = usePreferencesStore();

  const historyData = useMemo(() => {
    if (!rawHistoryData) return null;

    return getFilteredHistoryData({
      publicKey,
      tokenId,
      isHideDustEnabled,
    });
  }, [
    rawHistoryData,
    getFilteredHistoryData,
    publicKey,
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

  // Handle polling - only start after initial load is complete
  useEffect(() => {
    if (shouldPoll && hasAttemptedInitialLoad && publicKey) {
      startPolling({
        publicKey,
        network: networkDetails.network,
      });

      return () => stopPolling();
    }

    return undefined;
  }, [
    publicKey,
    networkDetails.network,
    shouldPoll,
    startPolling,
    stopPolling,
    hasAttemptedInitialLoad,
  ]);

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
        // Clear navigation refresh state immediately when data is ready
        setIsNavigationRefresh(false);
        clearRefreshAfterNavigation();

        if (isRefresh) {
          // Add a minimum spinner delay only for native RefreshControl to prevent flickering
          setTimeout(() => {
            setIsRefreshing(false);
          }, DEFAULT_REFRESH_DELAY);
        }
      }
    },
    [
      fetchAccountHistory,
      publicKey,
      networkDetails.network,
      clearRefreshAfterNavigation,
    ],
  );

  // Handle navigation refresh
  useEffect(() => {
    if (
      shouldRefreshAfterNavigation &&
      hasAttemptedInitialLoad &&
      !isMounting
    ) {
      setIsNavigationRefresh(true);
      fetchData({ isRefresh: true, isBackgroundRefresh: true });
    }
  }, [
    shouldRefreshAfterNavigation,
    hasAttemptedInitialLoad,
    isMounting,
    fetchData,
  ]);

  // Only show error if we're not in the initial loading state and there is an error
  const shouldShowError = !isMounting && hasAttemptedInitialLoad && error;

  // Only show full-screen loading when there's no existing data and we're loading for the first time
  const shouldShowFullScreenLoading =
    (isLoading || isMounting) &&
    !isRefreshing &&
    !rawHistoryData &&
    !shouldRefreshAfterNavigation;

  return {
    historyData,
    error: shouldShowError ? error : null,
    isLoading: shouldShowFullScreenLoading,
    isRefreshing,
    isNavigationRefresh: isNavigationRefresh || shouldRefreshAfterNavigation,
    fetchData,
  };
}

export { useGetHistoryData };
export type {
  HistoryItemOperation,
  HistorySection,
  HistoryData,
} from "ducks/history";

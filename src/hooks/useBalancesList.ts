import { NETWORKS } from "config/constants";
import { AssetTypeWithCustomToken, PricedBalance } from "config/types";
import { useBalancesStore } from "ducks/balances";
import { getAssetType } from "helpers/balances";
import { useCallback, useEffect, useMemo, useState } from "react";

interface UseBalancesListResult {
  balanceItems: Array<
    PricedBalance & { id: string; assetType: AssetTypeWithCustomToken }
  >;
  isLoading: boolean;
  error: string | null;
  noBalances: boolean;
  isRefreshing: boolean;
  isFunded: boolean;
  handleRefresh: () => void;
}

interface UseBalancesListProps {
  publicKey: string;
  network: NETWORKS;
  shouldPoll?: boolean;
  searchTerm?: string;
}

export const useBalancesList = ({
  publicKey,
  network,
  shouldPoll = true,
  searchTerm,
}: UseBalancesListProps): UseBalancesListResult => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMounting, setIsMounting] = useState(true);
  const [hasAttemptedInitialLoad, setHasAttemptedInitialLoad] = useState(false);

  const {
    pricedBalances,
    isLoading: isBalancesLoading,
    error: balancesError,
    isFunded,
    fetchAccountBalances,
    startPolling,
    stopPolling,
  } = useBalancesStore();

  const noBalances = Object.keys(pricedBalances).length === 0;

  // Initial data fetch
  const fetchInitialData = useCallback(async () => {
    try {
      await fetchAccountBalances({
        publicKey,
        network,
      });
    } finally {
      setHasAttemptedInitialLoad(true);
      setIsMounting(false);
    }
  }, [fetchAccountBalances, publicKey, network]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Handle polling
  useEffect(() => {
    if (shouldPoll && hasAttemptedInitialLoad) {
      startPolling({ publicKey, network });
      return () => stopPolling();
    }
    return undefined;
  }, [
    publicKey,
    network,
    shouldPoll,
    startPolling,
    stopPolling,
    hasAttemptedInitialLoad,
  ]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);

    // Start fetching balances and prices
    fetchAccountBalances({
      publicKey,
      network,
    });

    // Add a minimum spinner delay to prevent flickering
    new Promise((resolve) => {
      setTimeout(resolve, 1000);
    }).finally(() => {
      setIsRefreshing(false);
    });
  }, [fetchAccountBalances, publicKey, network]);

  // Utility: check if a balance item matches the current search term
  const matchesSearchTerm = (
    item: PricedBalance & { id: string; assetType: AssetTypeWithCustomToken },
    term: string,
  ): boolean => {
    if (!term) {
      return true;
    }

    const normalizedTerm = term.toLowerCase();

    if (item.tokenCode?.toLowerCase().includes(normalizedTerm)) {
      return true;
    }

    if (item.displayName?.toLowerCase().includes(normalizedTerm)) {
      return true;
    }

    if (item.id.toLowerCase().includes(normalizedTerm)) {
      return true;
    }

    return false;
  };

  // Convert balances object to array and apply optional filtering
  const balanceItems = useMemo(
    () =>
      Object.entries(pricedBalances)
        .map(([id, balance]) => {
          const assetType = getAssetType(id);

          return {
            id,
            assetType,
            ...balance,
          } as PricedBalance & {
            id: string;
            assetType: AssetTypeWithCustomToken;
          };
        })
        .filter((item) => matchesSearchTerm(item, searchTerm ?? "")),
    [pricedBalances, searchTerm],
  );

  // Only show error if we're not in the initial loading state and there is an error
  const shouldShowError =
    !isMounting && hasAttemptedInitialLoad && balancesError;

  return useMemo(
    () => ({
      balanceItems,
      isLoading: isBalancesLoading || isMounting,
      error: shouldShowError ? balancesError : null,
      noBalances,
      isRefreshing,
      isFunded,
      handleRefresh,
    }),
    [
      balanceItems,
      isBalancesLoading,
      isMounting,
      shouldShowError,
      balancesError,
      noBalances,
      isRefreshing,
      isFunded,
      handleRefresh,
    ],
  );
};

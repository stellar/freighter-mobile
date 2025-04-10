import { NETWORKS } from "config/constants";
import { PricedBalance } from "config/types";
import { useBalancesStore } from "ducks/balances";
import { useCallback, useEffect, useState } from "react";

interface UseBalancesListResult {
  balanceItems: Array<PricedBalance & { id: string }>;
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
}

export const useBalancesList = ({
  publicKey,
  network,
  shouldPoll = true,
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
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        await fetchAccountBalances({
          publicKey,
          network,
        });
      } finally {
        setHasAttemptedInitialLoad(true);
        setIsMounting(false);
      }
    };

    fetchInitialData();
  }, [fetchAccountBalances, publicKey, network]);

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

  // Convert balances object to array
  const balanceItems = Object.entries(pricedBalances).map(
    ([id, balance]) =>
      ({
        id,
        ...balance,
      }) as PricedBalance & { id: string },
  );

  // Only show error if we're not in the initial loading state and there is an error
  const shouldShowError =
    !isMounting && hasAttemptedInitialLoad && balancesError;

  return {
    balanceItems,
    isLoading: isBalancesLoading || isMounting,
    error: shouldShowError ? balancesError : null,
    noBalances,
    isRefreshing,
    isFunded,
    handleRefresh,
  };
};

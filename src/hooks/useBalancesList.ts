import { DEFAULT_REFRESH_DELAY, NETWORKS } from "config/constants";
import { PricedBalance, TokenTypeWithCustomToken } from "config/types";
import { useBalancesStore } from "ducks/balances";
import { getTokenType } from "helpers/balances";
import { useCallback, useEffect, useMemo, useState } from "react";

interface UseBalancesListResult {
  balanceItems: Array<
    PricedBalance & { id: string; tokenType: TokenTypeWithCustomToken }
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
  searchTerm?: string;
}

export const useBalancesList = ({
  publicKey,
  network,
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

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);

    // Start fetching balances and prices
    fetchAccountBalances({
      publicKey,
      network,
    });

    // Add a minimum spinner delay to prevent flickering
    new Promise((resolve) => {
      setTimeout(resolve, DEFAULT_REFRESH_DELAY);
    }).finally(() => {
      setIsRefreshing(false);
    });
  }, [fetchAccountBalances, publicKey, network]);

  // Utility: check if a balance item matches the current search term
  const matchesSearchTerm = (
    item: PricedBalance & { id: string; tokenType: TokenTypeWithCustomToken },
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
          const tokenType = getTokenType(id);

          return {
            id,
            tokenType,
            ...balance,
          } as PricedBalance & {
            id: string;
            tokenType: TokenTypeWithCustomToken;
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

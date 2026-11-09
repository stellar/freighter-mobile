import Blockaid from "@blockaid/client";
import { DEFAULT_REFRESH_DELAY, NETWORKS } from "config/constants";
import { PricedBalance, TokenTypeWithCustomToken } from "config/types";
import { useBalancesStore } from "ducks/balances";
import { getTokenType } from "helpers/balances";
import { useCallback, useMemo, useState } from "react";

/**
 * A held PricedBalance that carries the canonical `id` ("XLM" or
 * "CODE:ISSUER") plus the resolved `tokenType`. Re-exported so swap
 * hooks share a single source of truth instead of redeclaring this
 * intersection locally.
 */
export type HeldBalanceItem = PricedBalance & {
  id: string;
  tokenType: TokenTypeWithCustomToken;
};

interface UseBalancesListResult {
  /**
   * The held balances, minus the ones the user hid unless `includeHidden` is
   * set. Filtered by `searchTerm` when one is given.
   */
  balanceItems: HeldBalanceItem[];
  /** The held balances the user hid, for the hidden-tokens sheet. */
  hiddenBalanceItems: HeldBalanceItem[];
  scanResults: Blockaid.TokenBulk.TokenBulkScanResponse["results"];
  isLoading: boolean;
  error: string | null;
  noBalances: boolean;
  isRefreshing: boolean;
  isFunded: boolean;
  /**
   * Contract IDs that are only in the list because the user saved them
   * locally — the only contract tokens the manage view may offer to remove.
   */
  localOnlyTokenIds: string[];
  handleRefresh: () => void;
}

interface UseBalancesListProps {
  publicKey: string;
  network: NETWORKS;
  searchTerm?: string;
  /**
   * Keeps hidden tokens in `balanceItems`. Off by default so Home and the
   * Send and Swap pickers never show a hidden token; on for views that must
   * see everything the account holds, like Add token's trustline check.
   */
  includeHidden?: boolean;
}

export const useBalancesList = ({
  publicKey,
  network,
  searchTerm,
  includeHidden = false,
}: UseBalancesListProps): UseBalancesListResult => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    pricedBalances,
    scanResults,
    isLoading: isBalancesLoading,
    error: balancesError,
    isFunded,
    localOnlyTokenIds,
    hiddenTokenIds,
    fetchAccountBalances,
  } = useBalancesStore();

  const noBalances = Object.keys(pricedBalances).length === 0;

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);

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

  // Convert balances object to array once; the visible and hidden lists are
  // both views over it.
  const allBalanceItems = useMemo(
    () =>
      Object.entries(pricedBalances).map(([id, balance]) => {
        const tokenType = getTokenType(id);

        return {
          id,
          tokenType,
          ...balance,
        } as HeldBalanceItem;
      }),
    [pricedBalances],
  );

  const hiddenBalanceItems = useMemo(
    () => allBalanceItems.filter((item) => hiddenTokenIds.includes(item.id)),
    [allBalanceItems, hiddenTokenIds],
  );

  // Apply the hidden filter and the optional search filter
  const balanceItems = useMemo(
    () =>
      allBalanceItems
        .filter((item) => includeHidden || !hiddenTokenIds.includes(item.id))
        .filter((item) => matchesSearchTerm(item, searchTerm ?? "")),
    [allBalanceItems, hiddenTokenIds, includeHidden, searchTerm],
  );

  // Only show error if we're not in the initial loading state and there is an error
  const shouldShowError = !isBalancesLoading && balancesError;

  return useMemo(
    () => ({
      balanceItems,
      hiddenBalanceItems,
      scanResults,
      isLoading: isBalancesLoading,
      error: shouldShowError ? balancesError : null,
      noBalances,
      isRefreshing,
      isFunded,
      localOnlyTokenIds,
      handleRefresh,
    }),
    [
      balanceItems,
      hiddenBalanceItems,
      scanResults,
      isBalancesLoading,
      shouldShowError,
      balancesError,
      noBalances,
      isRefreshing,
      isFunded,
      localOnlyTokenIds,
      handleRefresh,
    ],
  );
};

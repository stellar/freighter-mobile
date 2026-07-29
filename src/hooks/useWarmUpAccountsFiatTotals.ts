import { useAccountsFiatTotalsStore } from "ducks/accountsFiatTotals";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useCollectiblesStore } from "ducks/collectibles";
import { useEffect, useRef } from "react";

/**
 * Warms up the wallets-list USD totals in the background while the user is
 * still on Home, so the account list already shows final values the first
 * time it opens. Deliberately deferred until the more critical Home requests
 * (the active account's balances and collectibles) have settled; since a
 * balances refetch (account/network switch, transfers) resets the wait,
 * totals re-warm behind the scenes too. Redundant runs are no-ops thanks to
 * the accounts-fiat-totals store's TTL.
 */
export const useWarmUpAccountsFiatTotals = () => {
  const network = useAuthenticationStore((state) => state.network);
  const allAccounts = useAuthenticationStore((state) => state.allAccounts);
  const isLoadingBalances = useBalancesStore((state) => state.isLoading);
  const isLoadingCollectibles = useCollectiblesStore(
    (state) => state.isLoading,
  );
  const fetchAccountsFiatTotals = useAccountsFiatTotalsStore(
    (state) => state.fetchAccountsFiatTotals,
  );

  const hasBalancesFetchStarted = useRef(false);

  useEffect(() => {
    if (isLoadingBalances) {
      hasBalancesFetchStarted.current = true;
      return;
    }

    if (
      !hasBalancesFetchStarted.current ||
      isLoadingCollectibles ||
      allAccounts.length === 0
    ) {
      return;
    }

    fetchAccountsFiatTotals({
      publicKeys: allAccounts.map((walletAccount) => walletAccount.publicKey),
      network,
    });
  }, [
    isLoadingBalances,
    isLoadingCollectibles,
    allAccounts,
    network,
    fetchAccountsFiatTotals,
  ]);
};

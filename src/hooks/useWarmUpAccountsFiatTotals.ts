import { useAccountsFiatTotalsStore } from "ducks/accountsFiatTotals";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useCollectiblesStore } from "ducks/collectibles";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useEffect, useRef } from "react";

/**
 * Warms up the wallets-list USD totals in the background when the user lands
 * on Home, so the account list already shows final values the first time it
 * opens. Deliberately deferred until the more critical Home requests (the
 * active account's balances and collectibles) have settled, and fired only
 * ONCE per mount — later refreshes belong to the explicit triggers
 * (pull-to-refresh, sheet open, account switch), not the 30s balances poll.
 * The active account is excluded: its total is synced from the app's own
 * balances.
 */
export const useWarmUpAccountsFiatTotals = () => {
  const network = useAuthenticationStore((state) => state.network);
  const allAccounts = useAuthenticationStore((state) => state.allAccounts);
  const isLoadingBalances = useBalancesStore((state) => state.isLoading);
  const isLoadingCollectibles = useCollectiblesStore(
    (state) => state.isLoading,
  );
  const { account } = useGetActiveAccount();
  const fetchAccountsFiatTotals = useAccountsFiatTotalsStore(
    (state) => state.fetchAccountsFiatTotals,
  );

  const hasBalancesFetchStarted = useRef(false);
  const hasWarmedUp = useRef(false);

  useEffect(() => {
    if (hasWarmedUp.current) {
      return;
    }

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

    hasWarmedUp.current = true;

    fetchAccountsFiatTotals({
      publicKeys: allAccounts.map((walletAccount) => walletAccount.publicKey),
      network,
      excludePublicKey: account?.publicKey,
    });
  }, [
    isLoadingBalances,
    isLoadingCollectibles,
    allAccounts,
    network,
    account?.publicKey,
    fetchAccountsFiatTotals,
  ]);
};

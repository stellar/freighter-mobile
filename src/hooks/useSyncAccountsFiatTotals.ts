import { NETWORKS } from "config/constants";
import { useAccountsFiatTotalsStore } from "ducks/accountsFiatTotals";
import { useBalancesStore } from "ducks/balances";
import { useEffect } from "react";

interface UseSyncAccountsFiatTotalsParams {
  publicKey: string;
  network: NETWORKS;
}

/**
 * Mirrors the active account's balance changes into the accounts fiat totals
 * store (the manage-accounts sheet's per-account USD values). Whenever the
 * balances store updates — polling, pull-to-refresh, post-transaction — the
 * active account's row stays current without extra requests, and a real
 * value change marks the other accounts' totals stale so the next sheet
 * open refetches them.
 */
export const useSyncAccountsFiatTotals = ({
  publicKey,
  network,
}: UseSyncAccountsFiatTotalsParams) => {
  const pricedBalances = useBalancesStore((state) => state.pricedBalances);
  const fetchedPublicKey = useBalancesStore((state) => state.fetchedPublicKey);
  const fetchedNetwork = useBalancesStore((state) => state.fetchedNetwork);
  const isLoadingBalances = useBalancesStore((state) => state.isLoading);
  const syncAccountFiatTotal = useAccountsFiatTotalsStore(
    (state) => state.syncAccountFiatTotal,
  );

  useEffect(() => {
    if (!publicKey) {
      return;
    }

    // Right after an account (or network) switch, the balances snapshot
    // still belongs to the PREVIOUS account for a moment — syncing then
    // would write the old account's total under the new key. Only sync when
    // the snapshot provably matches: same account/network stamp and no
    // fetch in flight (the stamp is written with the raw balances, before
    // pricedBalances catches up).
    if (
      fetchedPublicKey !== publicKey ||
      fetchedNetwork !== network ||
      isLoadingBalances
    ) {
      return;
    }

    syncAccountFiatTotal({ publicKey, network, pricedBalances });
  }, [
    publicKey,
    network,
    pricedBalances,
    fetchedPublicKey,
    fetchedNetwork,
    isLoadingBalances,
    syncAccountFiatTotal,
  ]);
};

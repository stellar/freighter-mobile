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
  const syncAccountFiatTotal = useAccountsFiatTotalsStore(
    (state) => state.syncAccountFiatTotal,
  );

  useEffect(() => {
    if (!publicKey) {
      return;
    }

    syncAccountFiatTotal({ publicKey, network, pricedBalances });
  }, [publicKey, network, pricedBalances, syncAccountFiatTotal]);
};

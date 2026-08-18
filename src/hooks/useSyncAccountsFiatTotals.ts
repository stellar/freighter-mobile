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
 * active account's row stays current without extra requests; fetch cycles
 * skip it entirely, and the other accounts' rows only refresh on the
 * explicit triggers (warm-up, pull-to-refresh, sheet open, account switch).
 */
export const useSyncAccountsFiatTotals = ({
  publicKey,
  network,
}: UseSyncAccountsFiatTotalsParams) => {
  const pricedBalances = useBalancesStore((state) => state.pricedBalances);
  const fetchedPublicKey = useBalancesStore((state) => state.fetchedPublicKey);
  const fetchedNetwork = useBalancesStore((state) => state.fetchedNetwork);
  const isLoadingBalances = useBalancesStore((state) => state.isLoading);
  // Funded state and the fetch error decide between "$0.00" and "--" for the
  // active account's row, the same way they do for the Home header.
  const isFunded = useBalancesStore((state) => state.isFunded);
  const balancesError = useBalancesStore((state) => state.error);
  const syncAccountFiatTotal = useAccountsFiatTotalsStore(
    (state) => state.syncAccountFiatTotal,
  );

  useEffect(() => {
    if (!publicKey) {
      return;
    }

    const hasError = balancesError != null;
    // Right after an account (or network) switch, the balances snapshot
    // still belongs to the PREVIOUS account for a moment — syncing then
    // would write the old account's total under the new key. Only sync when
    // the snapshot provably matches: same account/network stamp and no
    // fetch in flight (the stamp is written with the raw balances, before
    // pricedBalances catches up).
    const snapshotMatches =
      fetchedPublicKey === publicKey && fetchedNetwork === network;

    // A failed fetch is never stamped, so requiring the stamp would drop the
    // error and leave this row on a confident "$0.00" while the Home header
    // shows "--" for the same account. The failure label doesn't read the
    // snapshot at all, so syncing it without that proof is safe.
    if (isLoadingBalances || (!snapshotMatches && !hasError)) {
      return;
    }

    syncAccountFiatTotal({
      publicKey,
      network,
      pricedBalances,
      isFunded,
      hasError,
    });
  }, [
    publicKey,
    network,
    pricedBalances,
    fetchedPublicKey,
    fetchedNetwork,
    isLoadingBalances,
    isFunded,
    balancesError,
    syncAccountFiatTotal,
  ]);
};

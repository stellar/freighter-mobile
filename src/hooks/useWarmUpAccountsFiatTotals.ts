import { NETWORKS } from "config/constants";
import { useAccountsFiatTotalsStore } from "ducks/accountsFiatTotals";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useCollectiblesStore } from "ducks/collectibles";
import { isMainnet } from "helpers/networks";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * Warms up the wallets-list USD totals in the background when the user lands
 * on Home — and again after a network switch — so the account list already
 * shows the right values the first time it opens instead of stale ones from
 * the previous network. Deliberately deferred until the more critical
 * requests (the active account's balances and collectibles for the current
 * network) have settled, and fired only ONCE per network — later refreshes
 * belong to the explicit triggers (pull-to-refresh, sheet open, account
 * switch), never the 30s balances poll. The active account is excluded: its
 * total is synced from the app's own balances.
 *
 * The cycle also feeds the `funded_account_count` analytics user property. So
 * when the app returns to the foreground on mainnet, the hook starts the cycle
 * again without `forceRefresh`. The store's 3-minute freshness check skips it
 * when the last cycle is recent.
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

  // Network whose balances fetch has been seen starting — a switch requires
  // a fresh balances cycle for the NEW network before warming up, so the
  // warm-up never races the critical requests.
  const balancesStartedForNetwork = useRef<NETWORKS | null>(null);
  // Network already warmed up; balances polls on it never re-trigger.
  const warmedUpNetwork = useRef<NETWORKS | null>(null);

  useEffect(() => {
    if (warmedUpNetwork.current === network) {
      return;
    }

    if (isLoadingBalances) {
      balancesStartedForNetwork.current = network;
      return;
    }

    if (
      balancesStartedForNetwork.current !== network ||
      isLoadingCollectibles ||
      allAccounts.length === 0
    ) {
      return;
    }

    warmedUpNetwork.current = network;

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

  // The AppState listener reads the latest values through this ref, so it
  // does not subscribe again on each change.
  const latest = useRef({ network, allAccounts, account });
  latest.current = { network, allAccounts, account };

  useEffect(() => {
    let previousAppState = AppState.currentState;

    const subscription = AppState.addEventListener("change", (nextState) => {
      const cameToForeground =
        previousAppState !== "active" && nextState === "active";
      previousAppState = nextState;

      if (!cameToForeground) {
        return;
      }

      const { current } = latest;

      // Mainnet only. Wait for the first warm-up on this network, so the
      // critical requests still go first after a network switch.
      if (
        !isMainnet(current.network) ||
        warmedUpNetwork.current !== current.network ||
        current.allAccounts.length === 0
      ) {
        return;
      }

      fetchAccountsFiatTotals({
        publicKeys: current.allAccounts.map(
          (walletAccount) => walletAccount.publicKey,
        ),
        network: current.network,
        excludePublicKey: current.account?.publicKey,
      });
    });

    return () => subscription.remove();
  }, [fetchAccountsFiatTotals]);
};

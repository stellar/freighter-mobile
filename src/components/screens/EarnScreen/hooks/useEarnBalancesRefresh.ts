import { useFocusEffect } from "@react-navigation/native";
import { BALANCES_FETCH_POLLING_INTERVAL, NETWORKS } from "config/constants";
import { useBalancesStore } from "ducks/balances";
import { useCallback } from "react";

/**
 * Keeps the account's balances fresh on the screen that calls it.
 *
 * Home's balance polling pauses while Earn is pushed over the tabs, so
 * without this the token picker kept showing what the account held when
 * Earn opened: after a swap, a Buy or a Receive, the row stayed at 0 and
 * "Not enough" opened again.
 *
 * Refreshes each time the screen gains focus (back from the amount screen or
 * from Add Funds), then on Home's polling interval while it stays focused.
 * The interval is what catches a Receive: that sheet opens over the picker,
 * so the picker never loses focus while funds arrive.
 *
 * Returns the refresh for callers that know the balances just changed, such
 * as a completed swap.
 */
export const useEarnBalancesRefresh = ({
  publicKey,
  network,
}: {
  publicKey: string;
  network: NETWORKS;
}) => {
  const { fetchAccountBalances } = useBalancesStore();

  const refreshBalances = useCallback(() => {
    if (!publicKey) {
      return;
    }
    fetchAccountBalances({ publicKey, network });
  }, [publicKey, network, fetchAccountBalances]);

  useFocusEffect(
    useCallback(() => {
      refreshBalances();
      const intervalId = setInterval(
        refreshBalances,
        BALANCES_FETCH_POLLING_INTERVAL,
      );
      return () => clearInterval(intervalId);
    }, [refreshBalances]),
  );

  return refreshBalances;
};

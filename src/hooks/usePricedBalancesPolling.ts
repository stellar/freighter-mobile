import { BALANCES_FETCH_POLLING_INTERVAL, NETWORKS } from "config/constants";
import { useBalancesStore } from "ducks/balances";
import { useFocusedPolling } from "hooks/useFocusedPolling";
import { useCallback, useEffect } from "react";

interface UsePricedBalancesPollingParams {
  publicKey: string;
  network: NETWORKS;
}

/**
 * Hook to manage polling of priced balances
 * Uses focused polling to start and stop polling when the screen is focused and app is active
 * @param params - Parameters for the polling
 * @param params.publicKey - The public key to fetch balances for
 * @param params.network - The network to fetch balances from
 */
export const usePricedBalancesPolling = ({
  publicKey,
  network,
}: UsePricedBalancesPollingParams) => {
  const { fetchAccountBalances } = useBalancesStore();

  const handlePoll = useCallback(() => {
    fetchAccountBalances({
      publicKey,
      network,
    });
  }, [publicKey, network, fetchAccountBalances]);

  // Ensure initial fetch on mount
  useEffect(() => {
    handlePoll();
  }, [handlePoll]);

  useFocusedPolling({
    onPoll: handlePoll,
    interval: BALANCES_FETCH_POLLING_INTERVAL,
  });
};

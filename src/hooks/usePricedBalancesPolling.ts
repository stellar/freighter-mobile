import { NETWORKS } from "config/constants";
import { useBalancesStore } from "ducks/balances";
import { useFocusedPolling } from "hooks/useFocusedPolling";
import { useCallback } from "react";

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
  const { startPolling, stopPolling } = useBalancesStore();

  const handleStart = useCallback(() => {
    startPolling({
      publicKey,
      network,
    });
  }, [publicKey, network, startPolling]);

  const handleStop = useCallback(() => {
    stopPolling();
  }, [stopPolling]);

  useFocusedPolling({
    onStart: handleStart,
    onStop: handleStop,
  });
};

import { NETWORKS } from "config/constants";
import { useBalancesStore } from "ducks/balances";
import { useEffect } from "react";

interface UsePricedBalancesPollingParams {
  publicKey: string;
  network: NETWORKS;
}

/**
 * Hook to manage polling of priced balances
 * Automatically starts polling when mounted and stops when unmounted
 *
 * @param params - Parameters for the polling
 * @param params.publicKey - The public key to fetch balances for
 * @param params.network - The network to fetch balances from
 */
export const usePricedBalancesPolling = ({
  publicKey,
  network,
}: UsePricedBalancesPollingParams) => {
  const { startPolling, stopPolling } = useBalancesStore();

  useEffect(() => {
    // Start polling when component mounts
    startPolling({
      publicKey,
      network,
    });

    // Cleanup polling when component unmounts
    return () => {
      // Previous polling (if any) will be automatically stopped by React
      // before this effect runs again with new publicKey or network values
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, network]);
};

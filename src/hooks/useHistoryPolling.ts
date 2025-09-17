import { NETWORKS } from "config/constants";
import { useHistoryStore } from "ducks/history";
import { useEffect } from "react";

interface UseHistoryPollingParams {
  publicKey: string;
  network: NETWORKS;
}

/**
 * Hook to manage polling of account history
 * Automatically starts polling when mounted and stops when unmounted
 *
 * @param params - Parameters for the polling
 * @param params.publicKey - The public key to fetch history for
 * @param params.network - The network to fetch history from
 */
export const useHistoryPolling = ({
  publicKey,
  network,
}: UseHistoryPollingParams) => {
  const { startPolling, stopPolling } = useHistoryStore();

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

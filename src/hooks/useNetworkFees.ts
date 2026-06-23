import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { FeePresets, FeePriority, NetworkCongestion } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useEffect, useState } from "react";
import { getNetworkFees, stellarSdkServer } from "services/stellar";

const NETWORK_FEES_POLL_INTERVAL_MS = 30000;

export interface NetworkFeesData {
  recommendedFee: string;
  networkCongestion: NetworkCongestion;
  feePresets: FeePresets;
}

// Empty presets so the priority selector resolves to "Custom" (not a spurious
// preset match) until the real network fees have loaded.
const EMPTY_FEE_PRESETS: FeePresets = {
  [FeePriority.LOW]: "",
  [FeePriority.MEDIUM]: "",
  [FeePriority.HIGH]: "",
};

const DEFAULT_NETWORK_FEES: NetworkFeesData = {
  recommendedFee: "",
  networkCongestion: NetworkCongestion.LOW,
  feePresets: EMPTY_FEE_PRESETS,
};

// Session cache keyed by network. The amount screens mount this hook on entry,
// so by the time the settings bottom sheet opens the fees are already loaded
// and read from the cache immediately — no cold-start flicker on each open.
const networkFeesCache: Partial<Record<NETWORKS, NetworkFeesData>> = {};

/**
 * Hook to retrieve and monitor network fees and congestion levels.
 *
 * @returns An object containing the recommended fee, network congestion level
 * and the Low/Med/High inclusion-fee presets
 */
export const useNetworkFees = (): NetworkFeesData => {
  const { network } = useAuthenticationStore();
  const [fees, setFees] = useState<NetworkFeesData>(
    () => networkFeesCache[network] ?? DEFAULT_NETWORK_FEES,
  );

  useEffect(() => {
    // Reflect any cached value for this network immediately (e.g. on switch).
    const cached = networkFeesCache[network];
    if (cached) {
      setFees(cached);
    }

    const fetchNetworkFees = async () => {
      try {
        const { networkUrl } = mapNetworkToNetworkDetails(network);
        const server = stellarSdkServer(networkUrl);

        const data = await getNetworkFees(server);

        // Guard against an invalid/empty result so the hook never returns
        // undefined to consumers.
        if (!data?.recommendedFee) {
          return;
        }

        networkFeesCache[network] = data;
        setFees(data);
      } catch (error) {
        logger.error("[useNetworkFees]", "Error fetching network fees:", error);
      }
    };

    fetchNetworkFees();

    const interval = setInterval(() => {
      fetchNetworkFees();
    }, NETWORK_FEES_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [network]);

  return fees;
};

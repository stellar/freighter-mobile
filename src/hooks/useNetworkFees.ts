import { mapNetworkToNetworkDetails, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { FeePresets, FeePriority, NetworkCongestion } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useEffect, useState } from "react";
import { getNetworkFees, stellarSdkServer } from "services/stellar";

export interface NetworkFeesData {
  recommendedFee: string;
  networkCongestion: NetworkCongestion;
  feePresets: FeePresets;
}

// Empty presets until the first fetch resolves: a selected preset tier then
// shows the floored store fee (presetTotalFee returns undefined) rather than a
// bogus value. This is a DIFFERENT "no data" representation than the
// fetch-error path, where `getNetworkFees` falls back to the XLM minimum fee.
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

/**
 * Fee snapshot per network, fetched once and then frozen for the duration of a
 * send/swap/collectible flow so the congestion level and fees stay consistent
 * to the user (and only change when they manually edit). Cleared on flow exit
 * via `clearNetworkFeesCache`, so the next flow re-fetches fresh values.
 */
const networkFeesCache: Partial<Record<NETWORKS, NetworkFeesData>> = {};

/** Clears the frozen fee snapshot so the next flow re-fetches. Call on flow exit. */
export const clearNetworkFeesCache = (): void => {
  (Object.keys(networkFeesCache) as NETWORKS[]).forEach((key) => {
    delete networkFeesCache[key];
  });
};

/**
 * Hook to retrieve network fees and congestion for the current flow.
 *
 * The values are fetched once and frozen (no polling): the first consumer to
 * mount populates the cache, later consumers (e.g. the settings sheet) read the
 * same snapshot, and it stays put for the whole flow.
 *
 * @returns The recommended fee, network congestion, and Low/Med/High presets.
 */
export const useNetworkFees = (): NetworkFeesData => {
  const { network } = useAuthenticationStore();
  const [fees, setFees] = useState<NetworkFeesData>(
    () => networkFeesCache[network] ?? DEFAULT_NETWORK_FEES,
  );

  useEffect(() => {
    const cached = networkFeesCache[network];
    if (cached) {
      // Frozen snapshot already loaded for this flow — reuse it, don't refetch.
      setFees(cached);
      return undefined;
    }

    let cancelled = false;
    const fetchNetworkFees = async () => {
      try {
        const { networkUrl } = mapNetworkToNetworkDetails(network);
        const server = stellarSdkServer(networkUrl);

        const data = await getNetworkFees(server);

        // Guard against an invalid/empty result so the hook never returns
        // undefined to consumers.
        if (cancelled || !data?.recommendedFee) {
          return;
        }

        networkFeesCache[network] = data;
        setFees(data);
      } catch (error) {
        logger.error("[useNetworkFees]", "Error fetching network fees:", error);
      }
    };

    fetchNetworkFees();

    return () => {
      cancelled = true;
    };
  }, [network]);

  return fees;
};

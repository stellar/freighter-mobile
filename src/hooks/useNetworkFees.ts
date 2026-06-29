import { mapNetworkToNetworkDetails, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { NetworkCongestion } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useEffect, useState } from "react";
import { getNetworkFees, stellarSdkServer } from "services/stellar";

interface NetworkFeesSnapshot {
  recommendedFee: string;
  networkCongestion: NetworkCongestion;
}

/**
 * Last successful fetch per network. New mounts seed their initial state from
 * this so a freshly mounted consumer doesn't flash the defaults (empty fee,
 * "Low" congestion) before its own fetch resolves. Most visible on the shared
 * transaction-settings sheet, which mounts its own useNetworkFees after the
 * screen behind it has already loaded the real values.
 */
const lastNetworkFees: Partial<Record<NETWORKS, NetworkFeesSnapshot>> = {};

/**
 * Hook to retrieve and monitor network fees and congestion levels.
 *
 * @returns An object containing the recommended fee and network congestion level
 */
export const useNetworkFees = () => {
  const { network } = useAuthenticationStore();
  const cached = lastNetworkFees[network];

  const [recommendedFee, setRecommendedFee] = useState(
    cached?.recommendedFee ?? "",
  );
  const [networkCongestion, setNetworkCongestion] = useState<NetworkCongestion>(
    cached?.networkCongestion ?? NetworkCongestion.LOW,
  );

  useEffect(() => {
    const fetchNetworkFees = async () => {
      try {
        const { networkUrl } = mapNetworkToNetworkDetails(network);
        const server = stellarSdkServer(networkUrl);

        const { recommendedFee: fee, networkCongestion: congestion } =
          await getNetworkFees(server);

        lastNetworkFees[network] = {
          recommendedFee: fee,
          networkCongestion: congestion,
        };
        setRecommendedFee(fee);
        setNetworkCongestion(congestion);
      } catch (error) {
        logger.error("[useNetworkFees]", "Error fetching network fees:", error);
      }
    };

    fetchNetworkFees();

    const interval = setInterval(() => {
      fetchNetworkFees();
    }, 30000);

    return () => clearInterval(interval);
  }, [network]);

  return { recommendedFee, networkCongestion };
};

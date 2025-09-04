import { mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { NetworkCongestion } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useEffect, useState } from "react";
import { getNetworkFees, stellarSdkServer } from "services/stellar";

/**
 * Hook to retrieve and monitor network fees and congestion levels.
 *
 * @returns An object containing the recommended fee and network congestion level
 */
export const useNetworkFees = () => {
  const [recommendedFee, setRecommendedFee] = useState("");
  const [networkCongestion, setNetworkCongestion] = useState<NetworkCongestion>(
    NetworkCongestion.LOW,
  );
  const { network } = useAuthenticationStore();

  useEffect(() => {
    const fetchNetworkFees = async () => {
      try {
        const { networkUrl } = mapNetworkToNetworkDetails(network);
        const server = stellarSdkServer(networkUrl);

        const { recommendedFee: fee, networkCongestion: congestion } =
          await getNetworkFees(server);

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

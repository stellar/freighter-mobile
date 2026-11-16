import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import {
  dismissEthenaLaunchBanner,
  isEthenaLaunchBannerDismissed,
} from "helpers/ethenaLaunchPromo";
import { isMainnet } from "helpers/networks";
import { useCallback, useEffect, useState } from "react";
import { analytics } from "services/analytics";

/**
 * Whether Home shows the Ethena launch banner, and a way to dismiss it for
 * good. It shows only on Mainnet. It stays hidden until the stored dismissal
 * has been read, and if it can't be, so a dismissed banner never flashes back.
 *
 * @param network - The wallet's current network
 */
export const useEthenaLaunchBanner = (network: NETWORKS) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    isEthenaLaunchBannerDismissed()
      .then((isDismissed) => {
        if (isCurrent) {
          setIsVisible(!isDismissed);
        }
      })
      .catch(() => {
        // Unreadable: leave it hidden.
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    dismissEthenaLaunchBanner();
    analytics.track(AnalyticsEvent.ETHENA_LAUNCH_BANNER_DISMISSED);
  }, []);

  return { isVisible: isVisible && isMainnet(network), dismiss };
};

import { AnalyticsEvent } from "config/analyticsConfig";
import {
  dismissEthenaLaunchBanner,
  isEthenaLaunchBannerDismissed,
} from "helpers/ethenaLaunchPromo";
import { useCallback, useEffect, useState } from "react";
import { analytics } from "services/analytics";

/**
 * Whether Home shows the Ethena launch banner, and a way to dismiss it for
 * good. It stays hidden until the stored dismissal has been read, and if it
 * can't be, so a dismissed banner never flashes back.
 */
export const useEthenaLaunchBanner = () => {
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

  return { isVisible, dismiss };
};

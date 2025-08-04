import Blockaid from "@blockaid/client";
import { DEFAULT_BLOCKAID_SCAN_DELAY } from "config/constants";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { useCallback, useEffect, useState } from "react";
import { scanSite } from "services/blockaid/api";

interface UseBlockaidSiteProps {
  url: string;
}

interface UseBlockaidSiteResponse {
  scannedSite: Blockaid.SiteScanResponse;
  isLoading: boolean;
  error: string | null;
}

export const useBlockaidSite = ({
  url,
}: UseBlockaidSiteProps): UseBlockaidSiteResponse => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { network } = useAuthenticationStore();
  const [scannedSite, setScannedSite] = useState(
    {} as Blockaid.SiteScanResponse,
  );

  const fetchScanSiteStatus = useCallback(async () => {
    if (!url) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const scanResult = await scanSite({ url, network });

      setScannedSite(scanResult);

      // Set isLoading with delay to prevent UI from flashing
      setTimeout(() => {
        setIsLoading(false);
      }, DEFAULT_BLOCKAID_SCAN_DELAY);
    } catch (err) {
      logger.error(err as string, "Error fetching scan site status");

      setError(err as string);
      setIsLoading(false);
    }
  }, [url, network]);

  useEffect(() => {
    fetchScanSiteStatus();
  }, [fetchScanSiteStatus]);

  return { scannedSite, isLoading, error };
};

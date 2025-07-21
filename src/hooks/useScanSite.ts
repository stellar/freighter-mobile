import { logger } from "config/logger";
import { useState, useCallback } from "react";
import { scanSiteSDK, isBlockaidSDKAvailable } from "services/blockaidSDK";
import type {
  ScanSiteParams,
  BlockAidScanSiteResult,
  BlockaidHookResult,
} from "types/blockaid";

/**
 * Hook for scanning websites/dApps for security threats
 */
export const useScanSite = (): BlockaidHookResult<BlockAidScanSiteResult> & {
  scanSite: (params: ScanSiteParams) => Promise<void>;
} => {
  const [data, setData] = useState<BlockAidScanSiteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const scanSite = useCallback(async (params: ScanSiteParams) => {
    try {
      setLoading(true);
      setError(null);
      setData(null);

      logger.info("useScanSite", "Starting site scan", {
        url: params.url,
        hasSDK: isBlockaidSDKAvailable(),
      });

      let result: BlockAidScanSiteResult | null = null;

      // Try SDK first if available
      if (isBlockaidSDKAvailable()) {
        result = await scanSiteSDK(params);
      }

      // TODO: Add backend proxy fallback if SDK fails
      if (!result) {
        logger.warn(
          "useScanSite",
          "SDK scan failed, backend proxy not implemented yet",
        );
        throw new Error("Site scan not available");
      }

      setData(result);
      logger.info("useScanSite", "Site scan completed successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("useScanSite", "Site scan failed", { error: errorMessage });
      setError(new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    if (data) {
      // Re-run last scan if data exists
      const lastUrl = (data as { url?: string })?.url;
      if (lastUrl) {
        scanSite({ url: lastUrl });
      }
    }
  }, [data, scanSite]);

  return {
    data,
    loading,
    error,
    refetch,
    scanSite,
  };
};

import { logger } from "config/logger";
import { useState, useCallback } from "react";
import { scanSiteBackend } from "services/backend";
import { scanSiteSDK, isBlockaidSDKAvailable } from "services/blockaidSDK";
import type {
  ScanSiteParams,
  BlockAidScanSiteResult,
  BlockaidHookResult,
} from "types/blockaid";

// Hook for scanning websites/dApps for security threats
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

      // Try backend first (recommended approach)
      result = await scanSiteBackend(params);

      // Fallback to SDK if backend fails and SDK is available
      if (!result && isBlockaidSDKAvailable()) {
        logger.warn("useScanSite", "Backend failed, trying SDK fallback");
        result = await scanSiteSDK(params);
      }

      if (!result) {
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

import { useCallback, useState } from "react";
import { scanSiteBackend } from "services/backend";
import { scanSiteSDK, isBlockaidSDKAvailable } from "services/blockaidSDK";
import {
  ScanSiteParams,
  BlockAidScanSiteResult,
  BlockaidHookResult,
} from "types/blockaid";

export const useScanSite = (): BlockaidHookResult<BlockAidScanSiteResult> & {
  scanSite: (params: ScanSiteParams) => Promise<BlockAidScanSiteResult | null>;
} => {
  const [data, setData] = useState<BlockAidScanSiteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const scanSite = useCallback(async (params: ScanSiteParams) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      let result: BlockAidScanSiteResult | null = null;

      // Try backend first (recommended approach)
      result = await scanSiteBackend(params);

      // Fallback to SDK if backend fails and SDK is available
      if (!result && isBlockaidSDKAvailable()) {
        result = await scanSiteSDK(params);
      }

      if (!result) {
        throw new Error("Site scan not available");
      }

      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(new Error(errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    // This is a placeholder for refetch functionality
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    scanSite,
  };
};

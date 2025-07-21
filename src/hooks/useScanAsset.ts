import { logger } from "config/logger";
import { useState, useCallback } from "react";
import { scanAssetSDK, isBlockaidSDKAvailable } from "services/blockaidSDK";
import type {
  ScanAssetParams,
  BlockAidScanAssetResult,
  BlockaidHookResult,
} from "types/blockaid";

/**
 * Hook for scanning Stellar assets/tokens for security threats
 */
export const useScanAsset = (): BlockaidHookResult<BlockAidScanAssetResult> & {
  scanAsset: (params: ScanAssetParams) => Promise<void>;
} => {
  const [data, setData] = useState<BlockAidScanAssetResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const scanAsset = useCallback(async (params: ScanAssetParams) => {
    try {
      setLoading(true);
      setError(null);
      setData(null);

      logger.info("useScanAsset", "Starting asset scan", {
        assetCode: params.assetCode,
        network: params.network,
        hasSDK: isBlockaidSDKAvailable(),
      });

      let result: BlockAidScanAssetResult | null = null;

      // Try SDK first if available
      if (isBlockaidSDKAvailable()) {
        result = await scanAssetSDK(params);
      }

      // TODO: Add backend proxy fallback if SDK fails
      if (!result) {
        logger.warn(
          "useScanAsset",
          "SDK scan failed, backend proxy not implemented yet",
        );
        throw new Error("Asset scan not available");
      }

      setData(result);
      logger.info("useScanAsset", "Asset scan completed successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("useScanAsset", "Asset scan failed", {
        error: errorMessage,
      });
      setError(new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    if (data) {
      // Re-run last scan if data exists - reconstruct params from result
      const lastAddress = (data as { address?: string })?.address;
      const lastChain = (data as { chain?: string })?.chain;

      if (lastAddress && lastChain === "stellar") {
        // Parse address back to assetCode/assetIssuer format
        const [assetCode, issuerOrNative] = lastAddress.split("-");
        const params: ScanAssetParams = {
          assetCode,
          assetIssuer: issuerOrNative === "native" ? undefined : issuerOrNative,
          network: "public", // Default to public, TODO: store original network
        };
        scanAsset(params);
      }
    }
  }, [data, scanAsset]);

  return {
    data,
    loading,
    error,
    refetch,
    scanAsset,
  };
};

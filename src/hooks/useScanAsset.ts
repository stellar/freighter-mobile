import { NETWORKS } from "config/constants";
import { useState, useCallback } from "react";
import { scanAssetBackend } from "services/backend";
import { scanAssetSDK, isBlockaidSDKAvailable } from "services/blockaidSDK";
import type {
  ScanAssetParams,
  BlockAidScanAssetResult,
  BlockaidHookResult,
} from "types/blockaid";

// Hook for scanning Stellar assets/tokens for security threats
export const useScanAsset = (): BlockaidHookResult<BlockAidScanAssetResult> & {
  scanAsset: (
    params: ScanAssetParams,
  ) => Promise<BlockAidScanAssetResult | null>;
} => {
  const [data, setData] = useState<BlockAidScanAssetResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const scanAsset = useCallback(async (params: ScanAssetParams) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      let result: BlockAidScanAssetResult | null = null;

      // Try backend first (recommended approach)
      result = await scanAssetBackend(params);

      // Fallback to SDK if backend fails and SDK is available
      if (!result && isBlockaidSDKAvailable()) {
        result = await scanAssetSDK(params);
      }

      if (!result) {
        throw new Error("Asset scan not available");
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
    if (data) {
      // Reconstruct params from result data
      const lastResult = data as { address?: string };
      if (lastResult.address) {
        let assetCode: string;
        let assetIssuer: string | undefined;

        // Parse address back to params
        if (lastResult.address === "XLM-native") {
          assetCode = "XLM";
          assetIssuer = undefined;
        } else if (lastResult.address.includes("-")) {
          const [code, issuer] = lastResult.address.split("-");
          assetCode = code;
          assetIssuer = issuer;
        } else {
          // Fallback for unexpected format
          return;
        }

        scanAsset({
          assetCode,
          assetIssuer,
          network: NETWORKS.PUBLIC, // Default network for refetch
        });
      }
    }
  }, [data, scanAsset]);

  return {
    data,
    loading,
    error,
    scanAsset,
    refetch,
  };
};

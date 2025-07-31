import { NETWORKS } from "config/constants";
import { useState, useCallback } from "react";
import { scanAssetBackend } from "services/backend";
import type {
  ScanAssetParams,
  BlockAidScanAssetResult,
  BlockaidHookResult,
} from "types/blockaid";

// Hook for scanning Stellar assets/tokens for security threats
export const useScanAsset = (): BlockaidHookResult<{
  data: BlockAidScanAssetResult;
  error: null;
}> & {
  scanAsset: (
    params: ScanAssetParams,
  ) => Promise<{ data: BlockAidScanAssetResult; error: null } | null>;
} => {
  const [data, setData] = useState<{
    data: BlockAidScanAssetResult;
    error: null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const scanAsset = useCallback(async (params: ScanAssetParams) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      // Use only backend for security (no SDK fallback)
      const result = await scanAssetBackend(params);

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
    if (data?.data) {
      // Reconstruct params from result data
      const lastResult = data.data as { address?: string };
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

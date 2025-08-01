import Blockaid from "@blockaid/client";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { useCallback, useEffect, useState } from "react";
import { scanAsset } from "services/blockaid/api";

interface UseBlockaidAssetProps {
  assetCode: string;
  assetIssuer?: string;
}

interface UseBlockaidAssetResponse {
  scannedAsset: Blockaid.TokenScanResponse;
  isLoading: boolean;
  error: string | null;
}

export const useBlockaidAsset = ({
  assetCode,
  assetIssuer,
}: UseBlockaidAssetProps): UseBlockaidAssetResponse => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { network } = useAuthenticationStore();
  const [scannedAsset, setScannedAsset] = useState(
    {} as Blockaid.TokenScanResponse,
  );

  const fetchScanAssetStatus = useCallback(async () => {
    if (!assetCode) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const scanResult = await scanAsset({ assetCode, assetIssuer, network });

      setScannedAsset(scanResult);
    } catch (err) {
      logger.error(err as string, "Error fetching scan asset status");
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  }, [assetCode, assetIssuer, network]);

  useEffect(() => {
    fetchScanAssetStatus();
  }, [fetchScanAssetStatus]);

  return { scannedAsset, isLoading, error };
};

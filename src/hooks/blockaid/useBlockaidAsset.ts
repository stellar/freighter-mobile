import Blockaid from "@blockaid/client";
import { useAuthenticationStore } from "ducks/auth";
import { useCallback } from "react";
import { scanAsset } from "services/blockaid/api";

interface UseBlockaidAssetResponse {
  scanAsset: (
    assetCode: string,
    assetIssuer?: string,
  ) => Promise<Blockaid.TokenScanResponse>;
}

export const useBlockaidAsset = (): UseBlockaidAssetResponse => {
  const { network } = useAuthenticationStore();

  const scanAssetFunction = useCallback(
    async (
      assetCode: string,
      assetIssuer?: string,
    ): Promise<Blockaid.TokenScanResponse> => {
      if (!assetCode) {
        throw new Error("No asset code provided for scanning");
      }

      return scanAsset({ assetCode, assetIssuer, network });
    },
    [network],
  );

  return { scanAsset: scanAssetFunction };
};

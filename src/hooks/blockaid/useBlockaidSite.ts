import Blockaid from "@blockaid/client";
import { useAuthenticationStore } from "ducks/auth";
import { useCallback } from "react";
import { scanSite } from "services/blockaid/api";

interface UseBlockaidSiteResponse {
  scanSite: (url: string) => Promise<Blockaid.SiteScanResponse>;
}

export const useBlockaidSite = (): UseBlockaidSiteResponse => {
  const { network } = useAuthenticationStore();

  const scanSiteFunction = useCallback(
    async (url: string): Promise<Blockaid.SiteScanResponse> => {
      if (!url) {
        throw new Error("No URL provided for scanning");
      }

      return scanSite({ url, network });
    },
    [network],
  );

  return { scanSite: scanSiteFunction };
};

import Blockaid from "@blockaid/client";
import { useAuthenticationStore } from "ducks/auth";
import { useCallback } from "react";
import { scanTransaction } from "services/blockaid/api";

interface UseBlockaidTransactionResponse {
  scanTransaction: (
    xdr: string,
    url: string,
  ) => Promise<Blockaid.StellarTransactionScanResponse>;
}

export const useBlockaidTransaction = (): UseBlockaidTransactionResponse => {
  const { network } = useAuthenticationStore();

  const scanTransactionFunction = useCallback(
    async (
      xdr: string,
      url: string,
    ): Promise<Blockaid.StellarTransactionScanResponse> => {
      if (!xdr) {
        throw new Error("No XDR provided for scanning");
      }

      if (!url) {
        throw new Error("No URL provided for scanning");
      }

      return scanTransaction({ xdr, url, network });
    },
    [network],
  );

  return { scanTransaction: scanTransactionFunction };
};

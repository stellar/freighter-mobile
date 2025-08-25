import Blockaid from "@blockaid/client";
import { useAuthenticationStore } from "ducks/auth";
import { useCallback } from "react";
import { scanBulkTokens, scanToken } from "services/blockaid/api";

interface UseBlockaidTokenResponse {
  scanToken: (
    tokenCode: string,
    tokenIssuer?: string,
  ) => Promise<Blockaid.TokenScanResponse>;
  scanBulkTokens: (
    addressList: string[],
  ) => Promise<Blockaid.TokenBulkScanResponse>;
}

export const useBlockaidToken = (): UseBlockaidTokenResponse => {
  const { network } = useAuthenticationStore();

  const scanTokenFunction = useCallback(
    async (
      tokenCode: string,
      tokenIssuer?: string,
    ): Promise<Blockaid.TokenScanResponse> => {
      if (!tokenCode) {
        throw new Error("No token code provided for scanning");
      }

      return scanToken({ tokenCode, tokenIssuer, network });
    },
    [network],
  );

  const scanBulkTokensFunction = useCallback(
    async (addressList: string[]): Promise<Blockaid.TokenBulkScanResponse> => {
      if (!addressList.length) {
        throw new Error("No token codes provided for scanning");
      }

      return scanBulkTokens({ addressList, network });
    },
    [network],
  );

  return {
    scanToken: scanTokenFunction,
    scanBulkTokens: scanBulkTokensFunction,
  };
};

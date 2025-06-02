/* eslint-disable react-hooks/exhaustive-deps */
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { isContractId } from "helpers/soroban";
import { useEffect, useState } from "react";
import { getTokenDetails } from "services/backend";

interface TokenDetails {
  symbol: string;
  name: string;
}

interface UseTokenDetailsProps {
  tokenId: string;
  tokenSymbol: string;
  publicKey?: string;
  network: NETWORKS;
}

interface UseTokenDetailsReturn {
  actualTokenDetails: TokenDetails | null;
  displayTitle: string;
}

const useTokenDetails = ({
  tokenId,
  tokenSymbol,
  publicKey,
  network,
}: UseTokenDetailsProps): UseTokenDetailsReturn => {
  const [actualTokenDetails, setActualTokenDetails] =
    useState<TokenDetails | null>(null);

  useEffect(() => {
    const fetchTokenDetailsForSoroban = async () => {
      if (!isContractId(tokenId) || !publicKey) {
        return;
      }

      try {
        const tokenDetails = await getTokenDetails({
          contractId: tokenId,
          publicKey,
          network,
        });

        if (tokenDetails?.symbol && tokenDetails?.name) {
          const displaySymbol =
            tokenDetails.symbol === "native"
              ? NATIVE_TOKEN_CODE
              : tokenDetails.symbol;

          setActualTokenDetails({
            symbol: displaySymbol,
            name: tokenDetails.name,
          });
        }
      } catch (error) {
        logger.warn("Failed to fetch token details:", String(error));
      }
    };

    fetchTokenDetailsForSoroban();
  }, [tokenId, publicKey, network]);

  const displayTitle = (() => {
    if (tokenId === "native") {
      return NATIVE_TOKEN_CODE;
    }

    if (isContractId(tokenId) && actualTokenDetails) {
      return actualTokenDetails.symbol;
    }

    return tokenSymbol;
  })();

  return {
    actualTokenDetails,
    displayTitle,
  };
};

export default useTokenDetails;

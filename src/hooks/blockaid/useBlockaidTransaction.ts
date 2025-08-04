import Blockaid from "@blockaid/client";
import { DEFAULT_BLOCKAID_SCAN_DELAY } from "config/constants";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { useCallback, useEffect, useState } from "react";
import { scanTransaction } from "services/blockaid/api";

interface UseBlockaidTransactionProps {
  xdr: string;
  url: string;
}

interface UseBlockaidTransactionResponse {
  scannedTransaction: Blockaid.StellarTransactionScanResponse;
  isLoading: boolean;
  error: string | null;
}

export const useBlockaidTransaction = ({
  xdr,
  url,
}: UseBlockaidTransactionProps): UseBlockaidTransactionResponse => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { network } = useAuthenticationStore();
  const [scannedTransaction, setScannedTransaction] = useState(
    {} as Blockaid.StellarTransactionScanResponse,
  );

  const fetchScanTransactionStatus = useCallback(async () => {
    if (!url) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const scanResult = await scanTransaction({ xdr, url, network });

      setScannedTransaction(scanResult);

      // Set isLoading with delay to prevent UI from flashing
      setTimeout(() => {
        setIsLoading(false);
      }, DEFAULT_BLOCKAID_SCAN_DELAY);
    } catch (err) {
      logger.error(err as string, "Error fetching scan transaction status");

      setError(err as string);
      setIsLoading(false);
    }
  }, [xdr, url, network]);

  useEffect(() => {
    fetchScanTransactionStatus();
  }, [fetchScanTransactionStatus]);

  return { scannedTransaction, isLoading, error };
};

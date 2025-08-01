import Blockaid from "@blockaid/client";
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
    } catch (err) {
      logger.error(err as string, "Error fetching scan transaction status");
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  }, [xdr, url, network]);

  useEffect(() => {
    fetchScanTransactionStatus();
  }, [fetchScanTransactionStatus]);

  return { scannedTransaction, isLoading, error };
};

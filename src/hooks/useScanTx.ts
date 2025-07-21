import { logger } from "config/logger";
import { useState, useCallback } from "react";
import {
  scanTransactionSDK,
  isBlockaidSDKAvailable,
} from "services/blockaidSDK";
import type {
  ScanTxParams,
  BlockAidScanTxResult,
  BlockaidHookResult,
  BlockaidTransactionResult,
  SecurityStatus,
} from "types/blockaid";

/**
 * Hook for scanning Stellar transactions for security threats
 */
export const useScanTx = (): BlockaidHookResult<BlockaidTransactionResult> & {
  scanTransaction: (params: ScanTxParams) => Promise<void>;
} => {
  const [data, setData] = useState<BlockaidTransactionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const scanTransaction = useCallback(async (params: ScanTxParams) => {
    try {
      setLoading(true);
      setError(null);
      setData(null);

      logger.info("useScanTx", "Starting transaction scan", {
        network: params.network,
        sourceAccount: `${params.sourceAccount.substring(0, 10)}...`,
        hasSDK: isBlockaidSDKAvailable(),
      });

      let rawResult: BlockAidScanTxResult | null = null;

      // Try SDK first if available
      if (isBlockaidSDKAvailable()) {
        rawResult = await scanTransactionSDK(params);
      }

      // TODO: Add backend proxy fallback if SDK fails
      if (!rawResult) {
        logger.warn(
          "useScanTx",
          "SDK scan failed, backend proxy not implemented yet",
        );
        throw new Error("Transaction scan not available");
      }

      // Transform raw result into structured format
      const result: BlockaidTransactionResult = {
        simulation: rawResult.simulation
          ? {
              ...rawResult.simulation,
              accountExposures:
                rawResult.simulation.account_summary?.account_exposures,
            }
          : undefined,
        validation: rawResult.validation || {
          status: "unknown" as SecurityStatus,
          warnings: [],
          errors: [],
        },
        raw: rawResult,
      };

      setData(result);
      logger.info("useScanTx", "Transaction scan completed successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("useScanTx", "Transaction scan failed", {
        error: errorMessage,
      });
      setError(new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    if (data?.raw) {
      // Cannot easily reconstruct transaction params from result
      // Transaction scans are typically one-time operations
      logger.warn("useScanTx", "Refetch not supported for transaction scans");
    }
  }, [data]);

  return {
    data,
    loading,
    error,
    refetch,
    scanTransaction,
  };
};

import { logger } from "config/logger";
import { useState, useCallback } from "react";
import { scanTransactionBackend } from "services/backend";
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

// Hook for scanning Stellar transactions for security threats
export const useScanTransaction =
  (): BlockaidHookResult<BlockaidTransactionResult> & {
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

        logger.info("useScanTransaction", "Starting transaction scan", {
          network: params.network,
          sourceAccount: `${params.sourceAccount.slice(0, 10)}...`,
          hasSDK: isBlockaidSDKAvailable(),
        });

        let rawResult: BlockAidScanTxResult | null = null;

        // Try backend first (recommended approach)
        rawResult = await scanTransactionBackend(params);

        // Fallback to SDK if backend fails and SDK is available
        if (!rawResult && isBlockaidSDKAvailable()) {
          logger.warn(
            "useScanTransaction",
            "Backend failed, trying SDK fallback",
          );
          rawResult = await scanTransactionSDK(params);
        }

        if (!rawResult) {
          throw new Error("Transaction scan not available");
        }

        // Transform raw result into structured format
        const result: BlockaidTransactionResult = {
          raw: rawResult,
          validation: rawResult.validation || {
            status: "unknown" as SecurityStatus,
            warnings: [],
            errors: [],
          },
          simulation: rawResult.simulation
            ? {
                ...rawResult.simulation,
                accountExposures:
                  rawResult.simulation.account_summary.account_exposures,
              }
            : undefined,
        };

        setData(result);
        logger.info(
          "useScanTransaction",
          "Transaction scan completed successfully",
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        logger.error("useScanTransaction", "Transaction scan failed", {
          error: errorMessage,
        });
        setError(new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    }, []);

    const refetch = useCallback(() => {
      if (data) {
        logger.warn(
          "useScanTransaction",
          "Refetch not supported for transaction scans",
        );
      }
      // Transaction refetch not supported - would need to store original params
    }, [data]);

    return {
      data,
      loading,
      error,
      scanTransaction,
      refetch,
    };
  };

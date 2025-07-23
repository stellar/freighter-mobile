import { useState, useCallback } from "react";
import { scanTransactionBackend } from "services/backend";
import {
  scanTransactionSDK,
  isBlockaidSDKAvailable,
} from "services/blockaidSDK";
import type {
  ScanTransactionParams,
  BlockAidScanTxResult,
  BlockaidHookResult,
  BlockaidTransactionResult,
  SecurityStatus,
} from "types/blockaid";

// Hook for scanning Stellar transactions for security threats
export const useScanTransaction =
  (): BlockaidHookResult<BlockaidTransactionResult> & {
    scanTransaction: (
      params: ScanTransactionParams,
    ) => Promise<BlockaidTransactionResult | null>;
  } => {
    const [data, setData] = useState<BlockaidTransactionResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const scanTransaction = useCallback(
      async (params: ScanTransactionParams) => {
        setLoading(true);
        setError(null);
        setData(null);

        try {
          let rawResult: BlockAidScanTxResult | null = null;

          // Try backend first (recommended approach)
          rawResult = await scanTransactionBackend(params);

          // Fallback to SDK if backend fails and SDK is available
          if (!rawResult && isBlockaidSDKAvailable()) {
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
          return result;
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Unknown error";
          setError(new Error(errorMessage));
          return null;
        } finally {
          setLoading(false);
        }
      },
      [],
    );

    const refetch = useCallback(() => {
      if (data) {
        // Transaction refetch not supported - would need to store original params
      }
    }, [data]);

    return {
      data,
      loading,
      error,
      scanTransaction,
      refetch,
    };
  };

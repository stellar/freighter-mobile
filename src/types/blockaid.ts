import Blockaid from "@blockaid/client";
import { NETWORKS } from "config/constants";

// Re-export types from Blockaid package
export type BlockAidScanAssetResult = Blockaid.TokenScanResponse;
export type BlockAidScanSiteResult = Blockaid.SiteScanResponse;
export type BlockAidScanTxResult = Blockaid.StellarTransactionScanResponse & {
  request_id: string;
};
export type BlockAidBulkScanAssetResult = Blockaid.TokenBulkScanResponse;

// Parameter types for scanning
export interface ScanSiteParams {
  url: string;
}

export interface ScanAssetParams {
  assetCode: string;
  assetIssuer?: string;
  network: NETWORKS;
}

export interface ScanTransactionParams {
  xdr: string;
  network: NETWORKS;
  url?: string;
}

// Hook result type for consistency
export interface BlockaidHookResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

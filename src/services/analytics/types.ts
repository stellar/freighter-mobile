import { AnalyticsEvent } from "config/analyticsConfig";

// -----------------------------------------------------------------------------
// CORE TYPES
// -----------------------------------------------------------------------------

export enum TransactionType {
  Classic = "classic",
  Soroban = "soroban",
}

export type AnalyticsEventName = AnalyticsEvent;
export type AnalyticsProps = Record<string, unknown> | undefined;

// -----------------------------------------------------------------------------
// EVENT INTERFACES
// -----------------------------------------------------------------------------

export interface SignedTransactionEvent {
  transactionHash: string;
  transactionType: TransactionType;
  dappDomain?: string;
}

export interface TransactionSuccessEvent {
  sourceAsset: string;
  destAsset?: string;
  allowedSlippage?: string;
  transactionType?: "payment" | "pathPayment" | "swap" | "sorobanToken";
}

export interface SwapSuccessEvent {
  sourceAsset: string;
  destAsset: string;
  allowedSlippage?: string;
  isSwap: true;
}

export interface TransactionErrorEvent {
  error: string;
  errorCode?: string;
  transactionType?: "payment" | "pathPayment" | "swap" | "sorobanToken";
  isSwap?: boolean;
}

export interface QRScanEvent {
  context: "wallet_connect" | "address_input" | "import_wallet";
  timeToScan?: number;
  error?: string;
}

// -----------------------------------------------------------------------------
// DEBUG TYPES
// -----------------------------------------------------------------------------

export interface AnalyticsDebugInfo {
  isEnabled: boolean;
  userId: string | null;
  hasInitialized: boolean;
  environment: "development" | "production" | "test";
  amplitudeKey: string;
  isSendingToAmplitude: boolean;
  recentEvents: Array<{
    event: string;
    timestamp: number;
    props?: Record<string, unknown>;
  }>;
}

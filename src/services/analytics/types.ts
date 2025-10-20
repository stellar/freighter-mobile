import { AnalyticsEvent } from "config/analyticsConfig";
import { QRCodeSource } from "config/constants";

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
  transactionType?: TransactionType | string;
  dappDomain?: string;
}

export enum TransactionOperationType {
  Payment = "payment",
  PathPayment = "pathPayment",
  Swap = "swap",
  SorobanToken = "sorobanToken",
  SendCollectible = "sendCollectible",
}

export interface TransactionSuccessEvent {
  collectionAddress?: string;
  tokenId?: string;
  sourceToken?: string;
  destToken?: string;
  allowedSlippage?: string;
  operationType?: TransactionOperationType;
}

export interface SwapSuccessEvent {
  sourceToken: string;
  destToken: string;
  allowedSlippage?: string;
  isSwap: true;
}

export interface TransactionErrorEvent {
  error: string;
  errorCode?: string;
  operationType?: TransactionOperationType;
  isSwap?: boolean;
}

export interface QRScanEvent {
  context: QRCodeSource;
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

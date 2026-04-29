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

export interface SubmittedTransactionEvent {
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

export enum SimulationTransactionType {
  ContractTransfer = "contract_transfer",
  CollectibleTransfer = "collectible_transfer",
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

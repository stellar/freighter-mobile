import { AnalyticsEvent } from "config/analyticsConfig";
import { QRCodeSource } from "config/constants";
import { PriceFreshness, PriceSource } from "helpers/confirmationPriceSnapshot";
import {
  AssetIdentity,
  FailureCategory,
  LegUsdResult,
  LegUsdStatus,
} from "helpers/usdVolume";

export enum TransactionType {
  Classic = "classic",
  Soroban = "soroban",
}

/**
 * USD volume telemetry for a settled terminal event's source leg — the raw
 * materials `services/analytics/transactions.ts` flattens into the final
 * Amplitude properties (`amount_usd*`), shared across `payment.completed`,
 * `payment.failed`, `swap.completed`, and `swap.failed`. Optional on the
 * carrying event interfaces: a pre-submit failure never reaches a call site
 * that has this data, so its terminal event emits without volume properties.
 */
export interface PaymentVolume {
  identity: AssetIdentity;
  /** Source token amount, whole units. */
  amount: number;
  sourceLeg: LegUsdResult;
  priceSource: PriceSource;
  priceFreshness: PriceFreshness;
}

/** USD volume telemetry for `swap.completed` — source leg, settled destination leg, and both slippage figures. */
export interface SwapVolume extends PaymentVolume {
  toIdentity: AssetIdentity;
  toAmount?: number;
  /** Destination amount the quote promised, frozen at confirmation. */
  toAmountQuoted?: number;
  /**
   * The catalog also allows `not_observed` for a destination leg, but mobile
   * cannot produce it: the settled amount is read from the submit response,
   * which is already in hand at the emit site.
   */
  toAmountUsdStatus: LegUsdStatus;
  toAmountUsd?: number;
  toAmountUsdRate?: number;
  usdSlippagePct?: number;
  executionSlippagePct?: number;
}

/** USD volume + failure classification for `payment.failed` / `swap.failed`. `toIdentity` present iff the failure is a swap. */
export interface FailureVolume {
  identity: AssetIdentity;
  toIdentity?: AssetIdentity;
  amount: number;
  sourceLeg: LegUsdResult;
  priceSource: PriceSource;
  priceFreshness: PriceFreshness;
  reasonCode: string;
  failureCategory: FailureCategory;
}

export type AnalyticsEventName = AnalyticsEvent;
export type AnalyticsProps = Record<string, unknown> | undefined;

export interface SignedTransactionEvent {
  dappDomain?: string;
}

export interface SubmittedTransactionEvent {
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
  /** Direct-payment volume. Absent for collectible sends (unpriced, out of scope) and the unreachable path-payment branch. */
  volume?: PaymentVolume;
}

export interface SwapSuccessEvent {
  sourceToken: string;
  destToken: string;
  sourceAmount?: string;
  destAmount?: string;
  allowedSlippage?: string;
  isSwap: true;
  volume?: SwapVolume;
}

export interface TransactionErrorEvent {
  error: string;
  errorCode?: string;
  operationType?: TransactionOperationType;
  isSwap?: boolean;
  sourceToken?: string;
  destToken?: string;
  sourceAmount?: string;
  destAmount?: string;
  /** Absent for collectible-send failures (unpriced, out of scope) and any pre-submit failure. */
  volume?: FailureVolume;
}

export interface QRScanEvent {
  context: QRCodeSource;
  timeToScan?: number;
  error?: string;
}

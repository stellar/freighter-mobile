/* eslint-disable @typescript-eslint/no-explicit-any */
import { Horizon } from "@stellar/stellar-sdk";
import { HistorySectionV2 } from "ducks/history";
import { HistoryEntry } from "helpers/history/v2/model";
import { SorobanTokenInterface } from "helpers/soroban";
import { ImageSourcePropType } from "react-native";

// Re-exported so components under HistoryScreen import the v2 section shape
// from the same place as the rest of their types, rather than reaching into
// ducks/history directly. THROWAWAY: goes away with mappers/v2Entry.tsx in
// Phase B, when HistoryList renders HistoryEntry directly.
export type { HistorySectionV2 };

// Asset balance change from Horizon API
export interface AssetBalanceChange {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  type: string;
  from: string;
  to: string;
  amount: string;
}

// Asset diff summary for UI display
export interface AssetDiffSummary {
  assetCode: string;
  assetIssuer: string | null;
  decimals: number;
  amount: string;
  isCredit: boolean;
  destination?: string;
  icon?: string | ImageSourcePropType;
}

export enum TransactionType {
  UNKNOWN = "unknown",
  CREATE_ACCOUNT = "createAccount",
  SWAP = "swap",
  PAYMENT = "payment",
  CHANGE_TRUST = "changeTrust",
  CONTRACT = "contract",
  CONTRACT_MINT = "contractMint",
  CONTRACT_TRANSFER = "contractTransfer",
}

export enum TransactionStatus {
  SUCCESS = "success",
  FAILED = "failed",
}

// Base interfaces for transaction details
export interface CreateAccountDetailsType {
  accountPublicKey: string;
  startingBalance: string;
}

export interface SwapDetailsType {
  sourceTokenCode: string;
  sourceTokenIssuer: string;
  destinationTokenCode: string;
  destinationTokenIssuer: string;
  sourceTokenType: string;
  destinationTokenType: string;
  sourceAmount: string;
  destinationAmount: string;
}

export interface PaymentDetailsType {
  tokenCode: string;
  tokenIssuer?: string;
  tokenType: string;
  amount: string;
  from: string;
  to: string;
}

export interface TokenTransferDetailsType {
  from: string;
  to: string;
  amount: string;
}

export interface TokenMintDetailsType {
  from: string;
  to: string;
  amount: string;
}

export interface CollectibleTransferDetailsType {
  from: string;
  to: string;
  tokenId: string;
  collectibleName: string;
  collectionName: string;
}

export interface ContractDetailsType {
  sorobanTokenInterface: SorobanTokenInterface;
  contractAddress: string;
  contractName?: string;
  contractSymbol?: string;
  contractDecimals?: number;
  transferDetails?: TokenTransferDetailsType;
  mintDetails?: TokenMintDetailsType;
  collectibleTransferDetails?: CollectibleTransferDetailsType;
}

export interface TransactionDetails {
  operation: Horizon.ServerApi.OperationRecord;
  transactionTitle: string;
  transactionType: TransactionType;
  externalUrl: string;
  fee: string;
  memo?: string;
  xdr: string;
  status: TransactionStatus;
  IconComponent: React.ReactNode;
  ActionIconComponent: React.ReactNode;
  createAccountDetails?: CreateAccountDetailsType;
  swapDetails?: SwapDetailsType;
  paymentDetails?: PaymentDetailsType;
  contractDetails?: ContractDetailsType;
  assetDiffs?: AssetDiffSummary[];
}

// Additional types for HistoryItem component
export interface HistoryItemData {
  /**
   * Absent for v2 entries: the v1 detail sheet reads a Horizon operation the
   * v2 model does not carry, so v2 rows never populate this field (see
   * mappers/v2Entry.tsx). `historyEntry` below is what a v2 row carries
   * instead.
   */
  transactionDetails?: TransactionDetails;
  /**
   * THROWAWAY (see mappers/v2Entry.tsx): set only for v2 rows, carrying the
   * raw HistoryEntry alongside the v1-shaped fields above so HistoryItem's
   * press handler has something to open the v2 sheet with. Goes away with
   * the rest of the adapter in Phase B, when HistoryItem renders
   * HistoryEntry directly instead of bridging it onto this type.
   */
  historyEntry?: HistoryEntry;
  rowText: string;
  actionText: string | null;
  ActionIconComponent: React.ReactElement | null;
  dateText: string | null;
  amountText: string | null;
  IconComponent: React.ReactElement | null;
  transactionStatus: TransactionStatus;
  isAddingFunds: boolean | null;
}

export interface HistoryItemProps {
  accountBalances: any; // Using any here to match existing code
  operation: any; // Using any here to match existing code
  publicKey: string;
  networkDetails: any; // Using any here to match existing code
  handleTransactionDetails: (transactionDetail: TransactionDetails) => void;
  /**
   * THROWAWAY: opens the v2 sheet for a v2 row, mirroring
   * handleTransactionDetails' role for v1 rows. Called with the row's
   * historyItemData.historyEntry when present. Goes away with the rest of
   * the adapter in Phase B.
   */
  handleV2TransactionDetails: (entry: HistoryEntry) => void;
  /**
   * THROWAWAY: pre-built row data for v2 entries, bypassing HistoryItem's own
   * useEffect mapping (mapHistoryItemData reads a Horizon operation, which
   * v2 entries don't have). Set by HistoryList for v2 sections; goes away
   * with mappers/v2Entry.tsx in Phase B. When present, `operation` is unused.
   */
  historyItemData?: HistoryItemData;
}

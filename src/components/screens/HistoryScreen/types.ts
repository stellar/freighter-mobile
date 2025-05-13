import { Horizon } from "@stellar/stellar-sdk";
import { SorobanTokenInterface } from "helpers/soroban";

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

export interface TransactionDetails {
  operation: Horizon.ServerApi.OperationRecord;
  transactionTitle: string;
  transactionType: TransactionType;
  externalUrl: string;
  fee: string;
  status: TransactionStatus;
  IconComponent: React.ReactNode;
  ActionIconComponent: React.ReactNode;
  createAccountDetails?: {
    isCreatingExternalAccount: boolean;
    accountPublicKey: string;
    startingBalance: string;
  };
  swapDetails?: {
    sourceAssetCode: string;
    sourceAssetIssuer: string;
    destinationAssetCode: string;
    destinationAssetIssuer: string;
    sourceAssetType: string;
    destinationAssetType: string;
    sourceAmount: string;
    destinationAmount: string;
  };
  paymentDetails?: {
    assetCode: string;
    assetIssuer: string;
    assetType: string;
    amount: string;
    from: string;
    to: string;
  };
  contractDetails?: {
    sorobanTokenInterface: SorobanTokenInterface;
    contractAddress: string;
    contractName?: string;
    contractSymbol?: string;
    contractDecimals?: number;
    transferDetails?: {
      from: string;
      to: string;
      amount: string;
    };
    mintDetails?: {
      from: string;
      to: string;
      amount: string;
    };
  };
}

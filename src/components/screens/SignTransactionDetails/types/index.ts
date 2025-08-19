import type { MemoType, Operation, xdr } from "@stellar/stellar-sdk";

export interface DecodedMemoInterface {
  value: string;
  type: MemoType;
}

export interface SignTransactionSummaryInterface {
  operationsCount: number;
  feeXlm: string;
  sequenceNumber: string;
  memo: DecodedMemoInterface | null;
  xdr: string;
}

export interface InvokeHostFunctionShortDetailsInterface {
  contractId?: string;
  functionName?: string;
}

export interface SignTransactionDetailsInterface {
  summary: SignTransactionSummaryInterface;
  authEntries: xdr.SorobanAuthorizedInvocation[];
  operations: Operation[];
}

import type { MemoType, OperationRecord, xdr } from "@stellar/stellar-sdk";

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

export interface AuthEntryDisplay {
  invocation: xdr.SorobanAuthorizedInvocation;
  /**
   * The address whose authorization the entry's credentials represent.
   * Present for address credentials (incl. CAP-71 ADDRESS_V2 /
   * ADDRESS_WITH_DELEGATES); absent for source-account credentials.
   */
  boundAddress?: string;
}

export interface SignTransactionDetailsInterface {
  summary: SignTransactionSummaryInterface;
  authEntries: AuthEntryDisplay[];
  operations: OperationRecord[];
  hasTrustlineChanges: boolean;
}

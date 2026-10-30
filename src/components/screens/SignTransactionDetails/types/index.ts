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

/**
 * What the signing screens can show for a transaction XDR.
 *
 * - `empty`: there is no XDR, so there is nothing to show and nothing wrong.
 * - `ready`: the XDR decoded and every conversion the details sheet renders
 *   with was dry-run, so `details` can be rendered.
 * - `undisplayable`: the XDR didn't parse, or its display data couldn't be
 *   built. A dApp request in this state can only be rejected.
 *
 * It exists so a dApp request can tell `empty` from `undisplayable`, which a
 * bare `null` for the details can't.
 */
export type SignTransactionDetailsState =
  | { status: "empty" }
  | { status: "ready"; details: SignTransactionDetailsInterface }
  | { status: "undisplayable" };

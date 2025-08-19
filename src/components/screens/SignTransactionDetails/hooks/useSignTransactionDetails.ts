import {
  FeeBumpTransaction,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { decodeMemo } from "components/screens/SignTransactionDetails/helpers/parseTransaction";
import {
  SignTransactionDetailsInterface,
  SignTransactionSummaryInterface,
} from "components/screens/SignTransactionDetails/types";
import { mapNetworkToNetworkDetails, OPERATION_TYPES } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { stroopToXlm } from "helpers/formatAmount";

interface UseSignTransactionDetailsParams {
  xdr: string;
}

interface BuildSummaryParams {
  transaction: Transaction | FeeBumpTransaction;
  xdr: string;
}

const buildSummary = (
  params: BuildSummaryParams,
): SignTransactionSummaryInterface => {
  const { transaction, xdr } = params;

  let sequence = "";
  let memo = {};

  if (!("innerTransaction" in transaction)) {
    sequence = transaction.sequence;
    memo = transaction.memo;
  }

  const decodedMemo = decodeMemo(memo);
  const operations = transaction.operations.map(
    (op) => OPERATION_TYPES[op.type] || op.type,
  );

  const summary: SignTransactionSummaryInterface = {
    operationsCount: operations.length,
    feeXlm: stroopToXlm(String(transaction.fee)).toString(),
    sequenceNumber: sequence,
    memo: decodedMemo,
    xdr,
  };

  return summary;
};

const buildAuthEntries = (transaction: Transaction | FeeBumpTransaction) => {
  const hasAuthEntries = transaction.operations.some(
    (op) => op.type === "invokeHostFunction" && op.auth && op.auth.length,
  );

  if (!hasAuthEntries) return [];

  return (
    (transaction.operations[0] as Operation.InvokeHostFunction).auth?.map(
      (authEntry) => authEntry.rootInvocation(),
    ) || []
  );
};

export const useSignTransactionDetails = ({
  xdr,
}: UseSignTransactionDetailsParams): SignTransactionDetailsInterface | null => {
  const { network } = useAuthenticationStore();
  const networkDetails = mapNetworkToNetworkDetails(network);

  if (!xdr) return null;

  const transaction = TransactionBuilder.fromXDR(
    xdr,
    networkDetails.networkPassphrase,
  );

  const summary = buildSummary({ transaction, xdr });
  const authEntries = buildAuthEntries(transaction);

  const trustlineChanges = transaction.operations.filter(
    (op) => op.type === "changeTrust",
  );

  return {
    summary,
    authEntries,
    operations: transaction.operations,
    hasTrustlineChanges: trustlineChanges.length > 0,
  };
};

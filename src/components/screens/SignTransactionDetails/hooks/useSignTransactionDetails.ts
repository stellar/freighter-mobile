import {
  FeeBumpTransaction,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { getDisplayableDetails } from "components/screens/SignTransactionDetails/helpers/detailsState";
import { decodeMemo } from "components/screens/SignTransactionDetails/helpers/parseTransaction";
import {
  SignTransactionDetailsInterface,
  SignTransactionDetailsState,
  SignTransactionSummaryInterface,
} from "components/screens/SignTransactionDetails/types";
import { mapNetworkToNetworkDetails, OPERATION_TYPES } from "config/constants";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { stroopToXlm } from "helpers/formatAmount";
import {
  assertInvocationDisplayable,
  assertOperationsDisplayable,
} from "helpers/signingDisplay";
import { getAuthEntryBoundAddress } from "helpers/soroban";
import { useMemo } from "react";

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
    (op) => OPERATION_TYPES[op.type as keyof typeof OPERATION_TYPES] || op.type,
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
  const allAuthEntries = transaction.operations
    .filter(
      (op): op is Operation.InvokeHostFunction =>
        op.type === "invokeHostFunction",
    )
    .flatMap((op) => op.auth ?? []);

  if (!allAuthEntries.length) return [];

  return allAuthEntries.map((authEntry) => ({
    invocation: authEntry.rootInvocation,
    boundAddress: getAuthEntryBoundAddress(authEntry),
  }));
};

/**
 * Builds what the signing screens show for a transaction XDR, or says why there
 * is nothing to show.
 *
 * Besides decoding the transaction, it dry-runs every conversion the details
 * sheet makes that can throw (`assertOperationsDisplayable` for the
 * operations, `assertInvocationDisplayable` for each auth entry), so a
 * transaction the sheet couldn't draw is `undisplayable` here rather than a
 * crash there.
 *
 * - No XDR is `empty`.
 * - An XDR that doesn't parse is `undisplayable`, with a `logger.warn`: a
 *   breadcrumb, since the dApp sent something that isn't a transaction.
 * - A decoded transaction whose display data can't be built (the summary, an
 *   auth entry's bound address or the pre-flight) is `undisplayable`, with a
 *   `logger.error`. That reaches Sentry on purpose: the XDR is valid and the
 *   app can't show it, for the same reason `getInvocationDetails` reports.
 *
 * @param xdr - The base64 transaction envelope, or an empty string for none.
 * @param networkPassphrase - The passphrase of the network it was built for.
 * @returns The state the screens render from.
 */
export const buildSignTransactionDetailsState = (
  xdr: string,
  networkPassphrase: string,
): SignTransactionDetailsState => {
  if (!xdr) return { status: "empty" };

  let transaction: Transaction | FeeBumpTransaction;

  try {
    transaction = TransactionBuilder.fromXdr(xdr, networkPassphrase);
  } catch (e) {
    // Malformed or unsupported XDR: report it as undisplayable instead of
    // propagating an uncaught exception through the render cycle.
    logger.warn("useSignTransactionDetails", "Failed to parse XDR", e);
    return { status: "undisplayable" };
  }

  try {
    const summary = buildSummary({ transaction, xdr });
    const authEntries = buildAuthEntries(transaction);

    // Run the conversions the details sheet will, so a throw surfaces here
    // rather than while the user is looking at the sheet.
    assertOperationsDisplayable(transaction.operations);
    authEntries.forEach(({ invocation }) =>
      assertInvocationDisplayable(invocation),
    );

    const trustlineChanges = transaction.operations.filter(
      (op) => op.type === "changeTrust",
    );

    return {
      status: "ready",
      details: {
        summary,
        authEntries,
        operations: transaction.operations,
        hasTrustlineChanges: trustlineChanges.length > 0,
      },
    };
  } catch (e) {
    logger.error(
      "useSignTransactionDetails",
      "Failed to build the display data for a decodable XDR",
      e,
    );
    return { status: "undisplayable" };
  }
};

/**
 * What the signing screens can show for a transaction XDR, as a state: `empty`
 * (no XDR), `ready` (with the details to render) or `undisplayable` (the XDR
 * didn't parse, or its display data couldn't be built).
 *
 * Use this where "nothing to show" and "can't show" must be told apart, as a
 * dApp request must: it can't be confirmed when its details can't be shown. A
 * screen that only draws the details uses {@link useSignTransactionDetails}.
 *
 * @param params - The hook parameters.
 * @param params.xdr - The base64 transaction envelope, or an empty string.
 * @returns The state, the same object on every render for the same XDR and
 * network.
 */
export const useSignTransactionDetailsState = ({
  xdr,
}: UseSignTransactionDetailsParams): SignTransactionDetailsState => {
  const { network } = useAuthenticationStore();
  const { networkPassphrase } = mapNetworkToNetworkDetails(network);

  // Memoized because consumers render the details straight into the details
  // tree: re-parsing on every render would hand down a fresh `operations`
  // array each time, defeating the `React.memo` on the operation details and
  // remounting everything below it. The empty-xdr guard lives inside the
  // builder, which the callback calls, so the hook is never called
  // conditionally.
  return useMemo(
    () => buildSignTransactionDetailsState(xdr, networkPassphrase),
    [xdr, networkPassphrase],
  );
};

/**
 * The details to render for a transaction XDR, or `null` when there is nothing
 * to render: no XDR, an XDR that doesn't parse, or one whose display data can't
 * be built. Built on {@link useSignTransactionDetailsState}, so it keeps that
 * hook's memoization: the details are the same object on every render.
 *
 * `null` doesn't say which of those it was. Send and swap review, which build
 * their own transaction, only need the details. A dApp request must tell "no
 * details" from "can't show them", so it reads the state instead.
 *
 * @param params - The hook parameters.
 * @param params.xdr - The base64 transaction envelope, or an empty string.
 * @returns The details when displayable, otherwise `null`.
 */
export const useSignTransactionDetails = (
  params: UseSignTransactionDetailsParams,
): SignTransactionDetailsInterface | null =>
  getDisplayableDetails(useSignTransactionDetailsState(params));

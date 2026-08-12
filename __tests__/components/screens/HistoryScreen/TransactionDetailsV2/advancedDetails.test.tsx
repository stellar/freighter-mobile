// Initialize the app i18n instance so t() resolves real translations rather
// than returning raw "history.v2.…" key paths (which would make the
// string-literal assertions below vacuous, and would let a typo'd key path
// pass silently). Mirrors the pattern in detailViewCards.test.tsx.
import { Address, Asset, Operation, xdr } from "@stellar/stellar-sdk";
import { fireEvent, render } from "@testing-library/react-native";
import {
  AdvancedDetails,
  decodeOperations,
} from "components/screens/HistoryScreen/TransactionDetailsV2/AdvancedDetails";
import { HistoryEntry, HistoryOperation } from "helpers/history/v2/model";
import "i18n";
import React from "react";

// AdvancedDetails uses useClipboard() for the XDR row's copy action;
// useClipboard() itself calls useToast(), which throws outside a
// ToastProvider. Mocked the same way Operations.test.tsx mocks it, so the
// component can render standalone. A module-scope `jest.fn()` (name must
// start with "mock" for the jest.mock factory hoist allowlist) lets tests
// assert what the row's copy action was actually called with.
const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}));

const op = (
  xdrValue: string,
  overrides: Partial<HistoryOperation> = {},
): HistoryOperation => ({
  id: "1",
  type: "PAYMENT" as HistoryOperation["type"],
  xdr: xdrValue,
  successful: true,
  ...overrides,
});

const validPaymentXdr = (): string =>
  Operation.payment({
    destination: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
    asset: Asset.native(),
    amount: "1",
  })
    .toXDR()
    .toString("base64");

// A real SDK-generated invokeHostFunction operation carrying one Soroban
// authorization entry, built the same way __tests__/helpers/soroban.test.ts
// (getAuthEntryBoundAddress describe block) builds one for its own fixtures —
// a plain contract-fn invocation with ADDRESS credentials, no SAC/WASM
// creation branch, so it exercises SignTransactionAuthorizations' simplest
// (INVOCATION_TYPE_INVOKE) path without depending on contract-type detection.
const BOUND_ADDRESS =
  "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3";
const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

const validInvokeWithAuthXdr = (): string => {
  const rootInvocation = new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(CONTRACT_ID).toScAddress(),
          functionName: "transfer",
          args: [],
        }),
      ),
    subInvocations: [],
  });

  const addressCreds = new xdr.SorobanAddressCredentials({
    address: new Address(BOUND_ADDRESS).toScAddress(),
    nonce: xdr.Int64.fromString("1") as xdr.Int64,
    signatureExpirationLedger: 999999,
    signature: xdr.ScVal.scvVoid(),
  });

  const authEntry = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(addressCreds),
    rootInvocation,
  });

  return Operation.invokeContractFunction({
    contract: CONTRACT_ID,
    function: "transfer",
    args: [],
    auth: [authEntry],
  })
    .toXDR()
    .toString("base64");
};

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry =>
  ({
    id: "hash",
    kind: "sent",
    createdAt: "2024-04-08T14:33:00Z",
    rowIcon: { type: "contract" },
    primaryText: "XLM",
    secondaryText: "Sent",
    secondaryIcon: "sent",
    amounts: null,
    details: {
      title: "Sent XLM",
      status: "success",
      fee: "0.00001",
      rate: null,
      contractId: null,
      functionName: null,
      protocol: null,
      counterparty: null,
      balanceChanges: [],
      stateChangeCards: [],
      operations: [],
    },
    ...overrides,
  }) as HistoryEntry;

describe("decodeOperations", () => {
  it("records no operations, and reports every id as failed, when all the XDR is malformed", () => {
    // All-bad batch: nothing decodes. The mixed batch (bad + good, "one
    // operation degrades itself without emptying the rest") is the separate
    // test below.
    const { records, failedIds } = decodeOperations([
      op("not-valid-xdr", { id: "a" }),
      op("also-bad", { id: "b" }),
    ]);

    expect(records).toEqual([]);
    // The ids matter: the XDR list keeps a row per operation and marks the
    // failures, so a decoder that returned an empty `failedIds` here would
    // silently unmark every one of them.
    expect([...failedIds].sort()).toEqual(["a", "b"]);
  });

  it("returns both halves empty for no operations", () => {
    const { records, failedIds } = decodeOperations([]);
    expect(records).toEqual([]);
    expect(failedIds.size).toBe(0);
  });

  it("does not throw on malformed input", () => {
    expect(() => decodeOperations([op("!!!")])).not.toThrow();
  });

  it("decodes a valid operation and reports no failures", () => {
    const { records, failedIds } = decodeOperations([op(validPaymentXdr())]);

    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("payment");
    expect(failedIds.size).toBe(0);
  });

  it("drops a malformed operation while keeping a valid one alongside it, reporting only the bad id", () => {
    // The brief's own cases only cover all-bad and all-good; a mixed batch is
    // the actual "one operation degrades itself, not the view" scenario this
    // decoder exists for.
    const { records, failedIds } = decodeOperations([
      op("not-valid-xdr", { id: "bad" }),
      op(validPaymentXdr(), { id: "good" }),
    ]);

    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("payment");
    // Exactly the bad one — a decoder that flagged both would mark the valid
    // operation's XDR row as a decode failure.
    expect([...failedIds]).toEqual(["bad"]);
  });
});

describe("AdvancedDetails", () => {
  beforeEach(() => {
    mockCopyToClipboard.mockClear();
  });

  it("renders the title, the operations heading, and the back affordance with real copy", () => {
    const onBack = jest.fn();
    const { getByTestId, getByText, getByLabelText } = render(
      <AdvancedDetails entry={entry()} onBack={onBack} />,
    );

    expect(getByTestId("advanced-details")).toBeTruthy();
    // Exact match, not a substring regex: a typo'd key path (e.g.
    // "advancedTitlex") would make i18next fall back to the raw key path,
    // which would still satisfy a loose substring check.
    expect(getByText("Transaction details")).toBeTruthy();
    expect(getByText("Operations")).toBeTruthy();
    // The "back" key only ever surfaces as an accessibilityLabel, never as
    // visible text — getByText would never catch a typo here.
    expect(getByLabelText("Back")).toBeTruthy();

    fireEvent.press(getByTestId("detail-sheet-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders one XDR row per operation, titled by type, copying that operation's own xdr on press, and mounts SignTransactionAuthorizations for a real auth-bearing invokeHostFunction operation", () => {
    const paymentXdr = validPaymentXdr();
    const invokeXdr = validInvokeWithAuthXdr();

    const testEntry = entry({
      details: {
        ...entry().details,
        operations: [
          op(paymentXdr, {
            id: "op-1",
            type: "PAYMENT" as HistoryOperation["type"],
          }),
          op(invokeXdr, {
            id: "op-2",
            type: "INVOKE_HOST_FUNCTION" as HistoryOperation["type"],
          }),
        ],
      },
    });

    const { getByTestId, getByText } = render(
      <AdvancedDetails entry={testEntry} onBack={jest.fn()} />,
    );

    // One row per raw operation, titled by its own (untranslated) `type`
    // field so it correlates with the decoded card `Operations` renders
    // above it — neither row is decode-failed, so neither carries the
    // "Failed to decode" marker.
    expect(getByText("PAYMENT")).toBeTruthy();
    expect(getByText("INVOKE_HOST_FUNCTION")).toBeTruthy();

    fireEvent.press(getByTestId("xdr-row-op-1"));
    expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
    expect(mockCopyToClipboard).toHaveBeenCalledWith(paymentXdr);

    fireEvent.press(getByTestId("xdr-row-op-2"));
    expect(mockCopyToClipboard).toHaveBeenCalledTimes(2);
    expect(mockCopyToClipboard).toHaveBeenLastCalledWith(invokeXdr);

    // The invokeHostFunction operation's auth entry flows through the
    // buildAuthEntries-style mapping into SignTransactionAuthorizations,
    // which renders its own real (untranslated-key) title.
    expect(getByText("Authorizations")).toBeTruthy();
  });

  it("marks the row for an operation that failed to decode, leaving the successfully-decoded row's title untouched", () => {
    const paymentXdr = validPaymentXdr();

    const testEntry = entry({
      details: {
        ...entry().details,
        operations: [
          op(paymentXdr, {
            id: "op-1",
            type: "PAYMENT" as HistoryOperation["type"],
          }),
          op("not-valid-xdr", {
            id: "op-2",
            type: "CREATE_ACCOUNT" as HistoryOperation["type"],
          }),
        ],
      },
    });

    const { getByText, queryByText } = render(
      <AdvancedDetails entry={testEntry} onBack={jest.fn()} />,
    );

    // The successfully-decoded row's title is the bare type, no marker.
    expect(getByText("PAYMENT")).toBeTruthy();
    expect(queryByText(/PAYMENT.*Failed to decode/)).toBeNull();

    // The row for the operation that dropped out of `decoded` explains why
    // it's still here (and why the row count exceeds `Operations`' card
    // count) instead of silently outnumbering the decoded cards.
    expect(getByText("CREATE_ACCOUNT · Failed to decode")).toBeTruthy();
  });

  it("renders the decoded operations immediately, with no loading step", () => {
    // The shared `Operations` component holds a VISUAL_DELAY_MS (500ms)
    // spinner before its first render, for the sign flow's collapsible-section
    // layout. Nothing here is async — `decodeOperations` runs synchronously in
    // a useMemo before `Operations` mounts — so AdvancedDetails passes
    // deferInitialRender={false} and the operation content must be present on
    // the first render pass.
    //
    // getByText, deliberately not findByText: findByText would also pass with
    // the delay in place, which is exactly the bug. A synchronous query is the
    // only form of this assertion that can fail.
    const testEntry = entry({
      details: {
        ...entry().details,
        operations: [op(validPaymentXdr(), { id: "op-1" })],
      },
    });

    const { getByText } = render(
      <AdvancedDetails entry={testEntry} onBack={jest.fn()} />,
    );

    // "Payment" is the OPERATION_TYPES label (config/constants.ts) that
    // Operations renders for a decoded payment. It exists only inside the
    // gated subtree, so its synchronous presence proves the gate is open —
    // not merely that the surrounding chrome rendered.
    expect(getByText("Payment")).toBeTruthy();
  });
});

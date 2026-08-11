// Initialize the app i18n instance so t() resolves real translations rather
// than returning raw "history.v2.…" key paths (which would make the
// string-literal assertions below vacuous, and would let a typo'd key path
// pass silently). Mirrors the pattern in advancedDetails.test.tsx.
import { Asset, Operation } from "@stellar/stellar-sdk";
import { fireEvent, render } from "@testing-library/react-native";
import { TransactionDetailsV2 } from "components/screens/HistoryScreen/TransactionDetailsV2";
import { HistoryEntry, HistoryOperation } from "helpers/history/v2/model";
import { truncateAddress } from "helpers/stellar";
import "i18n";
import React from "react";

// The composed AdvancedDetails view calls useClipboard() unconditionally
// (for its XDR row's copy action), and useClipboard() calls useToast(),
// which throws outside a ToastProvider. Mocked the same way
// advancedDetails.test.tsx mocks it, so the state machine can mount
// AdvancedDetails without a real provider tree.
const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}));

const entry = (
  overrides: Partial<HistoryEntry["details"]> = {},
): HistoryEntry =>
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
      ...overrides,
    },
  }) as HistoryEntry;

// A real SDK-generated payment operation, base64-encoded — the same shape
// AdvancedDetails.decodeOperations expects. Used to exercise the composed
// detail->advanced path with a genuinely non-empty operations list, per the
// carried coverage item: AdvancedDetails' non-empty render path had only
// ever been exercised through its own direct tests, never through the sheet.
const PAYMENT_DESTINATION =
  "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

const validPaymentOperation = (): HistoryOperation => ({
  id: "op-1",
  type: "PAYMENT" as HistoryOperation["type"],
  xdr: Operation.payment({
    destination: PAYMENT_DESTINATION,
    asset: Asset.native(),
    amount: "1",
  })
    .toXDR()
    .toString("base64"),
  successful: true,
});

const b64 = (s: string) => Buffer.from(s).toString("base64");

describe("TransactionDetailsV2", () => {
  it("starts on the detail view", () => {
    const { getByText } = render(<TransactionDetailsV2 entry={entry()} />);
    expect(getByText("Sent XLM")).toBeTruthy();
  });

  it("navigates to the advanced view (with real, decodable operations) and back", async () => {
    const withOperations = entry({ operations: [validPaymentOperation()] });

    const { getByTestId, getByText, findByText, queryByTestId } = render(
      <TransactionDetailsV2 entry={withOperations} />,
    );

    fireEvent.press(getByTestId("advanced-details-link"));
    expect(getByTestId("advanced-details")).toBeTruthy();
    // The raw-list XDR row: AdvancedDetails.xdrItems maps over the raw
    // entry.details.operations unconditionally, so this row renders whether
    // or not the operation actually decoded (deliberate — see
    // AdvancedDetails.tsx's comment on xdrItems). This assertion alone would
    // still pass against undecodable garbage XDR, so it only proves the
    // operations array reached the sheet non-empty.
    expect(getByTestId("xdr-row-op-1")).toBeTruthy();
    // The decode-sensitive assertion: Operations only renders this
    // destination row from decodeOperations' *parsed* output (the
    // "payment" case in Operations.tsx), so it renders exclusively when the
    // XDR above actually decoded. This is what proves the composed path
    // decodes and renders a real operation, not just that the array was
    // non-empty. findByText (not getByText): Operations gates its real
    // content behind a VISUAL_DELAY_MS-timed "isReady" flag (see
    // Operations.tsx), the same real-timer wait
    // Operations.test.tsx's own suite uses (its `FIND = { timeout: 3000 }`).
    expect(
      await findByText(
        truncateAddress(PAYMENT_DESTINATION),
        {},
        {
          timeout: 3000,
        },
      ),
    ).toBeTruthy();

    fireEvent.press(getByTestId("detail-sheet-back"));
    expect(getByText("Sent XLM")).toBeTruthy();
    expect(queryByTestId("advanced-details")).toBeNull();
  });

  it("navigates to the dataEntry view from a tappable key row and back", () => {
    const withDataEntry = entry({
      stateChangeCards: [
        {
          kind: "dataEntry",
          verb: "added",
          entries: [{ key: "myKey", valueOldB64: null, valueNewB64: null }],
        },
      ],
    });

    const { getByText, getByTestId, queryByTestId } = render(
      <TransactionDetailsV2 entry={withDataEntry} />,
    );

    fireEvent.press(getByText("myKey"));
    expect(getByTestId("data-entry-details")).toBeTruthy();

    fireEvent.press(getByTestId("detail-sheet-back"));
    expect(getByText("Sent XLM")).toBeTruthy();
    expect(queryByTestId("data-entry-details")).toBeNull();
  });

  it("renders a dataEntry selection strictly from its fields, even when they mismatch its verb", () => {
    // verb says "updated" (implying both an old and a new value), but only
    // valueNewB64 is present. DataEntryDetails is guarded on the fields, not
    // selection.verb, so it must still render — showing only the new-value
    // row — rather than assuming a previous value exists or crashing.
    const mismatched = entry({
      stateChangeCards: [
        {
          kind: "dataEntry",
          verb: "updated",
          entries: [
            {
              key: "mismatchKey",
              valueOldB64: null,
              valueNewB64: b64("newval"),
            },
          ],
        },
      ],
    });

    const { getByText, queryByText, getByTestId } = render(
      <TransactionDetailsV2 entry={mismatched} />,
    );

    fireEvent.press(getByText("mismatchKey"));
    expect(getByTestId("data-entry-details")).toBeTruthy();
    // literal copy for history.v2.detail.dataEntryValue
    expect(getByText("Value")).toBeTruthy();
    expect(getByText("newval")).toBeTruthy();
    // the previous-value row is omitted outright, not rendered empty —
    // literal copy for history.v2.detail.dataEntryPreviousValue must be absent
    expect(queryByText("Previous value")).toBeNull();
  });

  it("puts every state-change card's rows in one shared changes card, with no per-card headings", () => {
    const withCards = entry({
      stateChangeCards: [
        { kind: "accountMerged" },
        { kind: "flags", set: ["AUTH_REQUIRED"], cleared: [] },
      ],
      balanceChanges: [
        {
          token: {
            code: "XLM",
            contractId: null,
            issuer: null,
            icon: null,
            decimals: 7,
          },
          amount: "40",
          direction: "debit",
        },
      ],
    });

    const { getByText, queryByText, queryAllByTestId } = render(
      <TransactionDetailsV2 entry={withCards} />,
    );

    // Rows from both state-change cards and from the balance changes all
    // render, because the design puts them in a single card together.
    expect(getByText("Account merged")).toBeTruthy();
    expect(getByText("Flags set")).toBeTruthy();
    expect(getByText("Sent")).toBeTruthy();

    // The per-card headings an earlier revision rendered above each card are
    // not in the design. Exact-string queries, so "Flags" here cannot be
    // satisfied by the "Flags set" row text above it.
    expect(queryByText("Account merge")).toBeNull();
    expect(queryByText("Flags")).toBeNull();

    // ...and each card no longer gets a container of its own.
    expect(queryAllByTestId("state-change-card")).toHaveLength(0);
  });

  it("shows the advanced-details link with its literal copy", () => {
    // literal copy for history.v2.detail.advancedTitle, reused for both this
    // link and the advanced sheet's own title — matches the extension design
    // (history-redesign-plan.md: `"Transaction details" link row -> advanced
    // sheet`), where both read "Transaction details".
    const { getByText } = render(<TransactionDetailsV2 entry={entry()} />);
    expect(getByText("Transaction details")).toBeTruthy();
  });
});

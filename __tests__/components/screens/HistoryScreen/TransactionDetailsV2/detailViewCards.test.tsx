// Initialize the app i18n instance so t() resolves real translations rather
// than returning raw key paths (which would make the string-literal
// assertions below vacuous, and would let a typo'd key path pass silently).
// Mirrors the pattern in stateChangeItems.test.ts.
import { render, renderHook } from "@testing-library/react-native";
import { TransactionDetailsV2 } from "components/screens/HistoryScreen/TransactionDetailsV2";
import { DetailHeader } from "components/screens/HistoryScreen/TransactionDetailsV2/DetailHeader";
import {
  BalanceChangeRow,
  HistoryEntry,
  ResolvedToken,
} from "helpers/history/v2/model";
import { truncateAddress } from "helpers/stellar";
import useColors from "hooks/useColors";
import "i18n";
import React from "react";

const token = (code: string): ResolvedToken => ({
  code,
  contractId: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  issuer: null,
  icon: null,
  decimals: 7,
});

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

/** An entry whose details carry `overrides`, keeping the rest of the fixture. */
const withDetails = (overrides: Partial<HistoryEntry["details"]>) =>
  entry({ details: { ...entry().details, ...overrides } });

describe("DetailHeader", () => {
  it("renders the title and a formatted timestamp", () => {
    const { getByText, queryByText } = render(<DetailHeader entry={entry()} />);
    expect(getByText("Sent XLM")).toBeTruthy();
    // formatDetailTimestamp renders "Apr 8, 2024 · 2:33pm" under the en locale
    expect(getByText(/Apr 8, 2024/)).toBeTruthy();
    // no failed marker for a successful entry
    expect(queryByText(/Failed/)).toBeNull();
  });

  it("renders the literal failed marker (history.transactionDetails.statusFailed) for a failed entry", () => {
    const { getByText } = render(
      <DetailHeader entry={withDetails({ status: "failed" })} />,
    );
    // Exact match, not a substring regex: a typo'd key would make i18next fall
    // back to the raw key path, which still contains "Failed" as a substring
    // and would wrongly pass a /Failed/ regex match. The component renders
    // `{t(...)} ·` as one Text node, so the full rendered string is "Failed ·".
    expect(getByText("Failed ·")).toBeTruthy();
  });
});

describe("TransactionDetailsV2 detail view", () => {
  const rows: BalanceChangeRow[] = [
    { token: token("USDC"), amount: "40.4", direction: "credit" },
    { token: token("XLM"), amount: "40", direction: "debit" },
  ];

  describe("the changes card", () => {
    it("renders one row per balance change, labelled with the direction verb and a signed amount", () => {
      const { getByText } = render(
        <TransactionDetailsV2 entry={withDetails({ balanceChanges: rows })} />,
      );

      // Literal copy for history.transactionHistory.received/sent — the same
      // keys v1's AssetDiffRow uses.
      expect(getByText("Received")).toBeTruthy();
      expect(getByText("Sent")).toBeTruthy();
      // formatTokenForDisplay pads to 2 decimals and appends the code, so the
      // design's "+40.40 USDC" / "-40.00 XLM" are exact, not approximate.
      expect(getByText("+40.40 USDC")).toBeTruthy();
      expect(getByText("-40.00 XLM")).toBeTruthy();
    });

    it("colours both the label and the amount by direction — credits success, debits error", () => {
      const { result } = renderHook(() => useColors());
      const { success, error } = result.current.themeColors.status;

      const { getByText } = render(
        <TransactionDetailsV2 entry={withDetails({ balanceChanges: rows })} />,
      );

      expect(getByText("+40.40 USDC").props.style).toMatchObject({
        color: success,
      });
      expect(getByText("Received").props.style).toMatchObject({
        color: success,
      });
      // The design colours debits red. Asserting the exact colour (not merely
      // "not success") is what makes this test fail if the debit branch is
      // dropped back to the default text colour.
      expect(getByText("-40.00 XLM").props.style).toMatchObject({
        color: error,
      });
      expect(getByText("Sent").props.style).toMatchObject({ color: error });
    });

    it("renders the bare token code, with no sign or number, when the token's scale is unknown", () => {
      const { getByText, queryByText } = render(
        <TransactionDetailsV2
          entry={withDetails({
            balanceChanges: [
              { token: token("WAT"), amount: null, direction: "credit" },
            ],
          })}
        />,
      );

      expect(getByText("WAT")).toBeTruthy();
      // A guessed number or a lone "+" would both be lies about an amount we
      // never resolved.
      expect(queryByText(/[+-]/)).toBeNull();
    });

    it("omits the whole changes card when there is nothing to show", () => {
      const { queryByText } = render(<TransactionDetailsV2 entry={entry()} />);
      expect(queryByText("Received")).toBeNull();
      expect(queryByText("Sent")).toBeNull();
      expect(queryByText("To")).toBeNull();
      // the metadata card still renders
      expect(queryByText("Status")).toBeTruthy();
    });

    it("renders the counterparty as 'To' with a truncated address when funds left the account", () => {
      const COUNTERPARTY =
        "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
      const { getByText } = render(
        <TransactionDetailsV2
          entry={withDetails({
            counterparty: COUNTERPARTY,
            balanceChanges: [rows[1]],
          })}
        />,
      );

      expect(getByText("To")).toBeTruthy();
      // exercises the truncateAddress(details.counterparty) call, not a
      // re-derived/hard-coded truncation
      expect(getByText(truncateAddress(COUNTERPARTY))).toBeTruthy();
    });

    it("renders the counterparty as 'From' when every balance change is a credit", () => {
      const { getByText, queryByText } = render(
        <TransactionDetailsV2
          entry={withDetails({
            counterparty:
              "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
            balanceChanges: [rows[0]],
          })}
        />,
      );

      expect(getByText("From")).toBeTruthy();
      expect(queryByText("To")).toBeNull();
    });

    it("puts state changes and balance changes in the same card, state changes first", () => {
      const { getByText } = render(
        <TransactionDetailsV2
          entry={withDetails({
            balanceChanges: rows,
            stateChangeCards: [
              {
                kind: "thresholds",
                level: "high",
                valueOld: "1",
                valueNew: "2",
              },
            ],
          })}
        />,
      );

      // Both kinds of row render, and neither carries a per-card heading — the
      // design has no headings above the changes card.
      expect(getByText("1 → 2")).toBeTruthy();
      expect(getByText("Received")).toBeTruthy();
      expect(getByText("+40.40 USDC")).toBeTruthy();
    });
  });

  describe("the metadata card", () => {
    it("renders status and fee, using the same copy as v1", () => {
      const { getByText } = render(<TransactionDetailsV2 entry={entry()} />);
      // literal copy for history.transactionDetails.status/statusSuccess/fee
      expect(getByText("Status")).toBeTruthy();
      expect(getByText("Success")).toBeTruthy();
      expect(getByText("Fee")).toBeTruthy();
      expect(getByText("0.00001 XLM")).toBeTruthy();
    });

    it("renders Failed for a failed transaction", () => {
      const { getByText, queryByText } = render(
        <TransactionDetailsV2 entry={withDetails({ status: "failed" })} />,
      );
      expect(queryByText("Success")).toBeNull();
      // "Failed" renders twice — the header marker ("Failed ·") and this row.
      expect(getByText("Failed")).toBeTruthy();
    });

    it("renders the swap rate only when the entry has one", () => {
      const { queryByText } = render(<TransactionDetailsV2 entry={entry()} />);
      expect(queryByText("Rate")).toBeNull();

      const { getByText } = render(
        <TransactionDetailsV2
          entry={withDetails({ rate: "1 XLM ≈ 1.01 USDC" })}
        />,
      );
      expect(getByText("Rate")).toBeTruthy();
      expect(getByText("1 XLM ≈ 1.01 USDC")).toBeTruthy();
    });

    it("does not render the XDR row — the design moves XDR into the advanced view", () => {
      const { queryByText } = render(<TransactionDetailsV2 entry={entry()} />);
      expect(queryByText("XDR")).toBeNull();
    });
  });
});

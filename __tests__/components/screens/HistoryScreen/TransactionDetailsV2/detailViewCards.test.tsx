// Initialize the app i18n instance so t() resolves real translations rather
// than returning raw "history.v2.…" key paths (which would make the
// string-literal assertions below vacuous, and would let a typo'd key path
// pass silently). Mirrors the pattern in stateChangeItems.test.ts.
import { render, renderHook } from "@testing-library/react-native";
import { BalanceChangesCard } from "components/screens/HistoryScreen/TransactionDetailsV2/BalanceChangesCard";
import { DetailHeader } from "components/screens/HistoryScreen/TransactionDetailsV2/DetailHeader";
import { MetaCard } from "components/screens/HistoryScreen/TransactionDetailsV2/MetaCard";
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

describe("DetailHeader", () => {
  it("renders the title and a formatted timestamp", () => {
    const { getByText, queryByText } = render(<DetailHeader entry={entry()} />);
    expect(getByText("Sent XLM")).toBeTruthy();
    // formatDetailTimestamp renders "Apr 8, 2024 · 2:33pm" under the en locale
    expect(getByText(/Apr 8, 2024/)).toBeTruthy();
    // no failed marker for a successful entry
    expect(queryByText(/Failed/)).toBeNull();
  });

  it("renders the literal failed marker (history.v2.detail.statusFailed) for a failed entry", () => {
    const failedEntry = entry({
      details: { ...entry().details, status: "failed" },
    });
    const { getByText } = render(<DetailHeader entry={failedEntry} />);
    // Exact match, not a substring regex: a typo'd key (e.g.
    // "statusFailedx") would make i18next fall back to the raw key path
    // "history.v2.detail.statusFailedx", which still contains "Failed" as a
    // substring and would wrongly pass a /Failed/ regex match. The component
    // renders `{t(...)} ·` as one Text node, so the full rendered string is
    // "Failed ·".
    expect(getByText("Failed ·")).toBeTruthy();
  });
});

describe("BalanceChangesCard", () => {
  const rows: BalanceChangeRow[] = [
    { token: token("USDC"), amount: "40.4", direction: "credit" },
    { token: token("XLM"), amount: "40", direction: "debit" },
  ];

  it("renders one row per balance change with a signed amount", () => {
    const { getByText } = render(<BalanceChangesCard rows={rows} />);
    expect(getByText(/\+.*40\.4/)).toBeTruthy();
    expect(getByText(/-.*40/)).toBeTruthy();
    // literal copy for history.v2.detail.balanceChanges — a typo'd key would
    // resolve to the raw key path instead of this string.
    expect(getByText("Balance changes")).toBeTruthy();
  });

  it("renders an em dash when the token's scale is unknown", () => {
    const { getByText } = render(
      <BalanceChangesCard
        rows={[{ token: token("WAT"), amount: null, direction: "credit" }]}
      />,
    );
    expect(getByText("—")).toBeTruthy();
  });

  it("renders nothing when there are no balance changes", () => {
    const { toJSON } = render(<BalanceChangesCard rows={[]} />);
    expect(toJSON()).toBeNull();
  });

  it("colours the credit amount with the success status colour, matching v1's AssetDiffRow treatment, and leaves the debit amount uncoloured", () => {
    const { result } = renderHook(() => useColors());
    const { success } = result.current.themeColors.status;

    const { getByText } = render(<BalanceChangesCard rows={rows} />);

    const creditValue = getByText(/\+.*40\.4/);
    expect(creditValue.props.style).toMatchObject({ color: success });

    const debitValue = getByText(/-.*40/);
    expect(debitValue.props.style).not.toMatchObject({ color: success });
  });
});

describe("MetaCard", () => {
  it("always renders the fee", () => {
    const { getByText } = render(<MetaCard details={entry().details} />);
    expect(getByText(/0\.00001/)).toBeTruthy();
    // literal copy for history.v2.detail.fee
    expect(getByText("Fee")).toBeTruthy();
  });

  it("renders the swap rate when present", () => {
    const details = { ...entry().details, rate: "1 XLM ≈ 1.01 USDC" };
    const { getByText } = render(<MetaCard details={details} />);
    expect(getByText("1 XLM ≈ 1.01 USDC")).toBeTruthy();
    // literal copy for history.v2.detail.rate
    expect(getByText("Rate")).toBeTruthy();
  });

  it("omits the counterparty row when there is no counterparty", () => {
    const { queryByText } = render(<MetaCard details={entry().details} />);
    expect(queryByText(/G[A-Z0-9]{3}/)).toBeNull();
    // the whole row is omitted, not just the address — the literal
    // history.v2.detail.counterparty label must not render either.
    expect(queryByText("To / From")).toBeNull();
  });

  it("renders the counterparty row (literal label and truncated address) when present", () => {
    const COUNTERPARTY =
      "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
    const details = { ...entry().details, counterparty: COUNTERPARTY };
    const { getByText } = render(<MetaCard details={details} />);
    // literal copy for history.v2.detail.counterparty
    expect(getByText("To / From")).toBeTruthy();
    // exercises the truncateAddress(details.counterparty) call, not a
    // re-derived/hard-coded truncation
    expect(getByText(truncateAddress(COUNTERPARTY))).toBeTruthy();
  });
});

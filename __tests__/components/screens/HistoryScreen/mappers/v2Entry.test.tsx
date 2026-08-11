import { mapV2EntryToHistoryItemData } from "components/screens/HistoryScreen/mappers/v2Entry";
import { HistoryEntry } from "helpers/history/v2/model";

const baseEntry = (overrides: Partial<HistoryEntry>): HistoryEntry =>
  ({
    id: "abc123",
    kind: "sent",
    createdAt: "2024-04-08T14:33:00Z",
    rowIcon: { type: "contract" },
    primaryText: "XLM",
    secondaryText: "Sent",
    secondaryIcon: "sent",
    amounts: [{ text: "-40 XLM", direction: "debit" }],
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

describe("mapV2EntryToHistoryItemData", () => {
  it("maps primary and secondary text onto row and action text", () => {
    const result = mapV2EntryToHistoryItemData(baseEntry({}));
    expect(result.rowText).toBe("XLM");
    expect(result.actionText).toBe("Sent");
  });

  it("formats the date as month and day", () => {
    expect(mapV2EntryToHistoryItemData(baseEntry({})).dateText).toBe("Apr 8");
  });

  it("renders a single debit amount without marking it as adding funds", () => {
    const result = mapV2EntryToHistoryItemData(baseEntry({}));
    expect(result.amountText).toBe("-40 XLM");
    expect(result.isAddingFunds).toBe(false);
  });

  it("marks a credit as adding funds", () => {
    const result = mapV2EntryToHistoryItemData(
      baseEntry({ amounts: [{ text: "+40.4 USDC", direction: "credit" }] }),
    );
    expect(result.amountText).toBe("+40.4 USDC");
    expect(result.isAddingFunds).toBe(true);
  });

  it("joins a swap pair credit-first", () => {
    const result = mapV2EntryToHistoryItemData(
      baseEntry({
        amounts: [
          { text: "+40.4 USDC", direction: "credit" },
          { text: "-40 XLM", direction: "debit" },
        ],
      }),
    );
    expect(result.amountText).toBe("+40.4 USDC");
  });

  it("renders no amount for a pure config change", () => {
    const result = mapV2EntryToHistoryItemData(baseEntry({ amounts: null }));
    expect(result.amountText).toBeNull();
  });

  it("passes 'multiple' through as a translated label", () => {
    const result = mapV2EntryToHistoryItemData(
      baseEntry({ amounts: "multiple" }),
    );
    expect(result.amountText).not.toBeNull();
  });

  it("marks a failed entry's status", () => {
    const entry = baseEntry({});
    entry.details.status = "failed";
    expect(mapV2EntryToHistoryItemData(entry).transactionStatus).toBe("failed");
  });
});

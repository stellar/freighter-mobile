// Initialize the app i18n instance so t() resolves real translations rather
// than returning raw "history.v2.…" key paths (which would make the
// exact-string assertions below vacuous, and would let a typo'd key path
// pass silently). Mirrors the pattern in advancedDetails.test.tsx.
import { fireEvent, render } from "@testing-library/react-native";
import { DataEntryDetails } from "components/screens/HistoryScreen/TransactionDetailsV2/DataEntryDetails";
import "i18n";
import React from "react";

const b64 = (s: string) => Buffer.from(s).toString("base64");

describe("DataEntryDetails", () => {
  it("renders the untruncated key", () => {
    const { getByText } = render(
      <DataEntryDetails
        selection={{
          verb: "added",
          entry: {
            key: "a-very-long-data-entry-key",
            valueOldB64: null,
            valueNewB64: b64("v"),
          },
        }}
        onBack={jest.fn()}
      />,
    );
    expect(getByText("a-very-long-data-entry-key")).toBeTruthy();
  });

  it("renders a decoded printable value", () => {
    const { getByText } = render(
      <DataEntryDetails
        selection={{
          verb: "added",
          entry: { key: "k", valueOldB64: null, valueNewB64: b64("café") },
        }}
        onBack={jest.fn()}
      />,
    );
    expect(getByText("café")).toBeTruthy();
    // Exact-string assertion for the "dataEntryValue" key, so a typo'd or
    // unresolved key (which would render as the raw key path) fails here
    // rather than only being caught by the substring-prone checks above.
    expect(getByText("Value")).toBeTruthy();
  });

  it("falls back to base64 for a binary value", () => {
    const binary = Buffer.from(Uint8Array.from([0xff, 0xfe])).toString(
      "base64",
    );
    const { getByText } = render(
      <DataEntryDetails
        selection={{
          verb: "added",
          entry: { key: "k", valueOldB64: null, valueNewB64: binary },
        }}
        onBack={jest.fn()}
      />,
    );
    expect(getByText(binary)).toBeTruthy();
  });

  it("renders both sides for an updated entry", () => {
    const { getByText } = render(
      <DataEntryDetails
        selection={{
          verb: "updated",
          entry: { key: "k", valueOldB64: b64("old"), valueNewB64: b64("new") },
        }}
        onBack={jest.fn()}
      />,
    );
    expect(getByText("old")).toBeTruthy();
    expect(getByText("new")).toBeTruthy();
    // Exact-string assertions for both labels — an "updated" entry is the
    // only verb that renders both, so this is where a mixed-up label pairing
    // (e.g. "Value" attached to the old side) would be caught.
    expect(getByText("Previous value")).toBeTruthy();
    expect(getByText("Value")).toBeTruthy();
  });

  it("renders only the previous value for a removed entry, guarded on the field rather than the verb", () => {
    const { getByText, queryByText } = render(
      <DataEntryDetails
        selection={{
          verb: "removed",
          entry: { key: "k", valueOldB64: b64("gone"), valueNewB64: null },
        }}
        onBack={jest.fn()}
      />,
    );
    expect(getByText("gone")).toBeTruthy();
    expect(getByText("Previous value")).toBeTruthy();
    expect(queryByText("Value")).toBeNull();
  });

  it("calls onBack when the back affordance is pressed", () => {
    const onBack = jest.fn();
    const { getByTestId } = render(
      <DataEntryDetails
        selection={{
          verb: "added",
          entry: { key: "k", valueOldB64: null, valueNewB64: b64("v") },
        }}
        onBack={onBack}
      />,
    );
    fireEvent.press(getByTestId("detail-sheet-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

import Clipboard from "@react-native-clipboard/clipboard";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { RecoveryPhraseField } from "components/RecoveryPhraseField";
import { logger } from "config/logger";
import { renderWithProviders } from "helpers/testUtils";
import React, { useState } from "react";
import { StyleSheet } from "react-native";

const mockGetClipboardText = jest.fn<Promise<string>, []>();
const mockClearClipboard = jest.fn<Promise<void>, []>(() => Promise.resolve());
jest.mock("services/SecureClipboardService", () => ({
  SecureClipboardService: {
    getClipboardText: () => mockGetClipboardText(),
    clearClipboard: () => mockClearClipboard(),
    copyToClipboard: jest.fn(),
  },
}));

const Harness: React.FC<{ error?: string | null }> = ({ error }) => {
  const [phrase, setPhrase] = useState("");

  return (
    <RecoveryPhraseField
      testID="phrase"
      value={phrase}
      onChangeText={setPhrase}
      placeholder="Enter your recovery phrase"
      error={error}
    />
  );
};

describe("RecoveryPhraseField", () => {
  it("offers Paste inside the field while it is empty", () => {
    const { getByTestId, getByText, queryByLabelText } = renderWithProviders(
      <Harness />,
    );

    expect(getByTestId("clipboard-button")).toBeTruthy();
    expect(getByText("Paste")).toBeTruthy();
    expect(queryByLabelText("Show recovery phrase")).toBeNull();
  });

  it("pastes the clipboard normalized, then offers the eye instead", async () => {
    mockGetClipboardText.mockResolvedValue("  Abandon  ABILITY\nable  ");
    const { getByTestId, queryByTestId, getByLabelText, getByDisplayValue } =
      renderWithProviders(<Harness />);

    fireEvent.press(getByTestId("clipboard-button"));

    await waitFor(() =>
      expect(getByDisplayValue("••••••• ••••••• ••••")).toBeTruthy(),
    );
    expect(queryByTestId("clipboard-button")).toBeNull();

    fireEvent.press(getByLabelText("Show recovery phrase"));
    expect(getByDisplayValue("abandon ability able")).toBeTruthy();
  });

  // A pasted phrase leaves nothing behind on the system clipboard, where any
  // app could read it, and reading it goes through the secure clipboard.
  describe("pasting securely", () => {
    beforeEach(() => {
      mockGetClipboardText.mockReset();
      mockClearClipboard.mockClear();
    });

    it("clears the clipboard once the phrase is in the field", async () => {
      mockGetClipboardText.mockResolvedValue("abandon ability able");
      const { getByTestId, getByDisplayValue } = renderWithProviders(
        <Harness />,
      );

      fireEvent.press(getByTestId("clipboard-button"));

      await waitFor(() => expect(mockClearClipboard).toHaveBeenCalledTimes(1));
      expect(getByDisplayValue("••••••• ••••••• ••••")).toBeTruthy();
      expect(Clipboard.getString).not.toHaveBeenCalled();
    });

    // Its Copy would put a shown phrase on the clipboard as plain text, and
    // its Paste would leave the phrase there.
    it("has no edit menu", () => {
      const { getByTestId } = renderWithProviders(<Harness />);

      expect(getByTestId("phrase").props.contextMenuHidden).toBe(true);
    });

    it("pastes and clears nothing from an empty clipboard", async () => {
      mockGetClipboardText.mockResolvedValue("");
      const { getByTestId } = renderWithProviders(<Harness />);

      fireEvent.press(getByTestId("clipboard-button"));

      await waitFor(() => expect(mockGetClipboardText).toHaveBeenCalled());
      await act(async () => {});
      expect(getByTestId("clipboard-button")).toBeTruthy();
      expect(mockClearClipboard).not.toHaveBeenCalled();
    });

    it("leaves the field and the clipboard as they are when it can't read it", async () => {
      const warn = jest.spyOn(logger, "warn").mockImplementation(() => {});
      mockGetClipboardText.mockRejectedValue(new Error("No clipboard"));
      const { getByTestId } = renderWithProviders(<Harness />);

      fireEvent.press(getByTestId("clipboard-button"));

      await waitFor(() => expect(warn).toHaveBeenCalled());
      expect(getByTestId("clipboard-button")).toBeTruthy();
      expect(mockClearClipboard).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  it("masks a new phrase again after the field is emptied", () => {
    const { getByTestId, getByLabelText, getByDisplayValue } =
      renderWithProviders(<Harness />);

    fireEvent.changeText(getByTestId("phrase"), "abandon ability");
    fireEvent.press(getByLabelText("Show recovery phrase"));
    expect(getByDisplayValue("abandon ability")).toBeTruthy();

    fireEvent.changeText(getByTestId("phrase"), "");
    fireEvent.changeText(getByTestId("phrase"), "abandon ability");
    expect(getByDisplayValue("••••••• •••••••")).toBeTruthy();
  });

  it("shows an error under the field", () => {
    const { getByText } = renderWithProviders(
      <Harness error="Invalid recovery phrase" />,
    );

    expect(getByText("Invalid recovery phrase")).toBeTruthy();
  });

  it("shows Varial's focus ring while focused", () => {
    const { getByTestId } = renderWithProviders(<Harness />);

    fireEvent(getByTestId("phrase"), "focus");

    expect(
      StyleSheet.flatten(getByTestId("phrase-focus-ring").props.style)
        .borderColor,
    ).toBe("rgba(143, 143, 143, 0.12)");
  });
});

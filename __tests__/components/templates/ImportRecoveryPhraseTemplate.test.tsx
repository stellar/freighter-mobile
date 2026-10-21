import { fireEvent } from "@testing-library/react-native";
import { ImportRecoveryPhraseTemplate } from "components/templates/ImportRecoveryPhraseTemplate";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Add Account's copy (Figma ?node-id=2554-161020), the template's next user.
const renderTemplate = (phrase: string, onSubmit = jest.fn()) =>
  renderWithProviders(
    <ImportRecoveryPhraseTemplate
      title="Import Recovery Phrase"
      description="Restore your wallet with the 12 or 24-word recovery phrase"
      placeholder="Recovery phrase"
      submitButtonText="Import"
      phrase={phrase}
      onChangePhrase={jest.fn()}
      onSubmit={onSubmit}
      testID="phrase"
    />,
  );

describe("ImportRecoveryPhraseTemplate", () => {
  it("lays out the title, the description, the field and the button from its props", () => {
    const { getByText, getByPlaceholderText, getByTestId } = renderTemplate("");

    expect(getByText("Import Recovery Phrase")).toBeTruthy();
    expect(
      getByText("Restore your wallet with the 12 or 24-word recovery phrase"),
    ).toBeTruthy();
    expect(getByPlaceholderText("Recovery phrase")).toBeTruthy();
    expect(getByTestId("clipboard-button")).toBeTruthy();
    expect(getByText("Import")).toBeTruthy();
  });

  it("submits only once there is a phrase", () => {
    const onSubmit = jest.fn();

    const empty = renderTemplate("", onSubmit);
    fireEvent.press(empty.getByTestId("default-action-button"));
    expect(onSubmit).not.toHaveBeenCalled();
    empty.unmount();

    const filled = renderTemplate("abandon ability able", onSubmit);
    fireEvent.press(filled.getByTestId("default-action-button"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

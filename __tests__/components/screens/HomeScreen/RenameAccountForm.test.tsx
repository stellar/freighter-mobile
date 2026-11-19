import { fireEvent } from "@testing-library/react-native";
import RenameAccountForm from "components/screens/HomeScreen/RenameAccountForm";
import { Account } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const baseAccount: Account = {
  id: "account-id",
  sourceId: "phrase-1",
  name: "Account 1",
  publicKey: "GACCOUNT",
};

const renderForm = (account: Account) =>
  renderWithProviders(
    <RenameAccountForm
      account={account}
      isRenamingAccount={false}
      onCancel={jest.fn()}
      onSave={jest.fn()}
    />,
  );

describe("RenameAccountForm", () => {
  it("keeps typed text when the account is refetched as a new object", () => {
    const screen = renderForm(baseAccount);

    fireEvent.changeText(screen.getByDisplayValue("Account 1"), "Draft");

    screen.rerender(
      <RenameAccountForm
        account={{ ...baseAccount }}
        isRenamingAccount={false}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Draft")).toBeTruthy();
  });

  it("resets the field when the stored name changes", () => {
    const screen = renderForm(baseAccount);

    fireEvent.changeText(screen.getByDisplayValue("Account 1"), "Draft");

    screen.rerender(
      <RenameAccountForm
        account={{ ...baseAccount, name: "Renamed" }}
        isRenamingAccount={false}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Renamed")).toBeTruthy();
  });
});

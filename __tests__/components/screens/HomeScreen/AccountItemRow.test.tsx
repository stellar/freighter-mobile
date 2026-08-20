import { fireEvent } from "@testing-library/react-native";
import AccountItemRow from "components/screens/HomeScreen/AccountItemRow";
import { Account } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("AccountItemRow", () => {
  const mockAccount: Account = {
    id: "account-1",
    name: "my account 1",
    publicKey: "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM",
  };

  const defaultProps = {
    account: mockAccount,
    handleSelectAccount: jest.fn().mockResolvedValue(undefined),
    isSelected: false,
    isAccountSwitching: false,
    isSwitchingToThisAccount: false,
    testID: "account-row-0",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the account name and truncated address", () => {
    const { getByText } = renderWithProviders(
      <AccountItemRow {...defaultProps} />,
    );

    expect(getByText("my account 1")).toBeTruthy();
    expect(getByText("GDNF...3VPM")).toBeTruthy();
  });

  it("selects the account when pressed", () => {
    const { getByTestId } = renderWithProviders(
      <AccountItemRow {...defaultProps} />,
    );

    fireEvent.press(getByTestId("account-row-0-select"));

    expect(defaultProps.handleSelectAccount).toHaveBeenCalledWith(
      mockAccount.publicKey,
    );
  });

  it("does not select while another switch is in progress", () => {
    const { getByTestId } = renderWithProviders(
      <AccountItemRow {...defaultProps} isAccountSwitching />,
    );

    fireEvent.press(getByTestId("account-row-0-select"));

    expect(defaultProps.handleSelectAccount).not.toHaveBeenCalled();
  });

  it("shows the formatted fiat total when available", () => {
    const { getByText } = renderWithProviders(
      <AccountItemRow {...defaultProps} fiatTotal={{ label: "$1,149.23", hasError: false }} />,
    );

    expect(getByText("$1,149.23")).toBeTruthy();
  });

  it("shows a spinner while the fiat total is loading", () => {
    const { getByTestId, queryByText } = renderWithProviders(
      <AccountItemRow {...defaultProps} isLoadingFiatTotal />,
    );

    expect(getByTestId("account-row-0-total-spinner")).toBeTruthy();
    expect(queryByText("$0.00")).toBeNull();
  });

  it("shows the placeholder when the total could not be read", () => {
    const { getByText, queryByTestId } = renderWithProviders(
      <AccountItemRow
        {...defaultProps}
        fiatTotal={{ label: "--", hasError: true }}
      />,
    );

    // A zero here would claim the account is empty when its balances are
    // simply unknown.
    expect(getByText("--")).toBeTruthy();
    expect(queryByTestId("account-row-0-total-spinner")).toBeNull();
  });

  it("shows the spinner while a failed total is being retried", () => {
    const { getByTestId, queryByText } = renderWithProviders(
      <AccountItemRow
        {...defaultProps}
        fiatTotal={{ label: "--", hasError: true }}
        isLoadingFiatTotal
      />,
    );

    expect(getByTestId("account-row-0-total-spinner")).toBeTruthy();
    expect(queryByText("--")).toBeNull();
  });

  it("keeps a fetched total visible while other rows refresh", () => {
    const { getByText, queryByTestId } = renderWithProviders(
      <AccountItemRow
        {...defaultProps}
        fiatTotal={{ label: "$1,149.23", hasError: false }}
        isLoadingFiatTotal
      />,
    );

    expect(getByText("$1,149.23")).toBeTruthy();
    expect(queryByTestId("account-row-0-total-spinner")).toBeNull();
  });

  it("shows a zero fiat total when none was fetched and nothing is loading", () => {
    const { getByText } = renderWithProviders(
      <AccountItemRow {...defaultProps} />,
    );

    expect(getByText("$0.00")).toBeTruthy();
  });

  it("shows no selected badge on unselected accounts", () => {
    const { queryByTestId } = renderWithProviders(
      <AccountItemRow {...defaultProps} />,
    );

    expect(queryByTestId("account-row-0-selected-badge")).toBeNull();
  });

  it("shows the selected badge on the selected account", () => {
    const { getByTestId } = renderWithProviders(
      <AccountItemRow {...defaultProps} isSelected />,
    );

    expect(getByTestId("account-row-0-selected-badge")).toBeTruthy();
  });

  it("shows the badge on the row being switched to", () => {
    const { getByTestId } = renderWithProviders(
      <AccountItemRow
        {...defaultProps}
        isAccountSwitching
        isSwitchingToThisAccount
      />,
    );

    expect(getByTestId("account-row-0-selected-badge")).toBeTruthy();
  });

  it("marks imported accounts", () => {
    const { getByText } = renderWithProviders(
      <AccountItemRow
        {...defaultProps}
        account={{ ...mockAccount, importedFromSecretKey: true }}
      />,
    );

    expect(getByText(/Imported/)).toBeTruthy();
  });

  it("announces the row's visible content, skipping the total while it loads", () => {
    const { getByTestId, rerender } = renderWithProviders(
      <AccountItemRow
        {...defaultProps}
        account={{ ...mockAccount, importedFromSecretKey: true }}
        fiatTotal={{ label: "$1,149.23", hasError: false }}
      />,
    );

    expect(getByTestId("account-row-0-select").props.accessibilityLabel).toBe(
      "my account 1, Imported, $1,149.23",
    );

    // While the total is loading (spinner), no placeholder $0.00 is spoken.
    rerender(
      <AccountItemRow
        {...defaultProps}
        account={mockAccount}
        isLoadingFiatTotal
      />,
    );

    expect(getByTestId("account-row-0-select").props.accessibilityLabel).toBe(
      "my account 1",
    );
  });
});

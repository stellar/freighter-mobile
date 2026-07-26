import { fireEvent } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import ManageAccountBottomSheet, {
  ManageAccountSheetHeader,
} from "components/screens/HomeScreen/ManageAccountBottomSheet";
import { Account } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("ManageAccountBottomSheet", () => {
  const PK_1 = "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
  const PK_2 = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

  const mockAccounts: Account[] = [
    { id: "account-1", name: "my account 1", publicKey: PK_1 },
    { id: "account-2", name: "my account 2", publicKey: PK_2 },
  ];

  const mockActiveAccount: ActiveAccount = {
    publicKey: PK_1,
    privateKey: "SECRET",
    accountName: "my account 1",
    id: "account-1",
    subentryCount: 0,
  };

  const defaultProps = {
    onPressMyQRCode: jest.fn(),
    onPressCopyAddress: jest.fn(),
    onPressViewOnExplorer: jest.fn(),
    onPressRenameAccount: jest.fn(),
    accounts: mockAccounts,
    activeAccount: mockActiveAccount,
    handleSelectAccount: jest.fn().mockResolvedValue(undefined),
    isAccountSwitching: false,
    switchingToPublicKey: null,
    fiatTotals: {
      [PK_1]: new BigNumber("1149.23"),
      [PK_2]: new BigNumber("872.48"),
    },
    isLoadingFiatTotals: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the active account hero section", () => {
    const { getAllByText, getByText, getByTestId } = renderWithProviders(
      <ManageAccountBottomSheet {...defaultProps} />,
    );

    expect(getByTestId("manage-accounts-active-avatar")).toBeTruthy();
    // Hero + account row both show the active account's name
    expect(getAllByText("my account 1").length).toBe(2);
    expect(getAllByText("GDNF...3VPM").length).toBe(2);
    expect(getByText("my account 2")).toBeTruthy();
  });

  it("renders each account's fiat total", () => {
    const { getByText } = renderWithProviders(
      <ManageAccountBottomSheet {...defaultProps} />,
    );

    expect(getByText("$1,149.23")).toBeTruthy();
    expect(getByText("$872.48")).toBeTruthy();
  });

  it.each([
    ["manage-accounts-qr-button", "onPressMyQRCode"],
    ["manage-accounts-copy-button", "onPressCopyAddress"],
    ["manage-accounts-explorer-button", "onPressViewOnExplorer"],
    ["manage-accounts-rename-button", "onPressRenameAccount"],
  ] as const)("pressing %s calls %s", (testID, handlerName) => {
    const { getByTestId } = renderWithProviders(
      <ManageAccountBottomSheet {...defaultProps} />,
    );

    fireEvent.press(getByTestId(testID));

    expect(defaultProps[handlerName]).toHaveBeenCalledTimes(1);
  });

  it("selects an account from the list", () => {
    const { getByTestId } = renderWithProviders(
      <ManageAccountBottomSheet {...defaultProps} />,
    );

    fireEvent.press(getByTestId("account-row-1-select"));

    expect(defaultProps.handleSelectAccount).toHaveBeenCalledWith(PK_2);
  });

  it("marks only the active account as selected", () => {
    const { getByTestId, queryByTestId } = renderWithProviders(
      <ManageAccountBottomSheet {...defaultProps} />,
    );

    expect(getByTestId("account-row-0-selected-badge")).toBeTruthy();
    expect(queryByTestId("account-row-1-selected-badge")).toBeNull();
  });

  it("always renders list-end spacing after the last row", () => {
    const { getByTestId } = renderWithProviders(
      <ManageAccountBottomSheet {...defaultProps} />,
    );

    expect(getByTestId("manage-accounts-list-end-spacing")).toBeTruthy();
  });
});

describe("ManageAccountSheetHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ["manage-accounts-settings-button", "onPressSettings"],
    ["manage-accounts-close-button", "onPressClose"],
  ] as const)("pressing %s calls %s", (testID, handlerName) => {
    const props = { onPressSettings: jest.fn(), onPressClose: jest.fn() };
    const { getByTestId } = renderWithProviders(
      <ManageAccountSheetHeader {...props} />,
    );

    fireEvent.press(getByTestId(testID));

    expect(props[handlerName]).toHaveBeenCalledTimes(1);
  });
});

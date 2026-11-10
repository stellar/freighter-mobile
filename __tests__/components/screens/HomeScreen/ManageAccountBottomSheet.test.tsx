import { fireEvent, within } from "@testing-library/react-native";
import ManageAccountBottomSheet, {
  ManageAccountSheetHeader,
} from "components/screens/HomeScreen/ManageAccountBottomSheet";
import { Account, SecretSource, SecretSourceType } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("ManageAccountBottomSheet", () => {
  const PK_1 = "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
  const PK_2 = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
  const PK_3 = "GBJ5JHXZJLI4QGZQ3OHQ6CN7TQHZMTPVKTPY6MZ2BQOXLK3QMSFZPRFY";

  const phrase: SecretSource = {
    id: "phrase-1",
    type: SecretSourceType.PHRASE,
    label: "Seed Phrase 1",
    createdAt: 1,
  };
  const key: SecretSource = {
    id: "key-1",
    type: SecretSourceType.SECRET_KEY,
    label: "Secret Key 1",
    createdAt: 2,
  };

  const mockAccounts: Account[] = [
    {
      id: "account-1",
      name: "my account 1",
      publicKey: PK_1,
      sourceId: phrase.id,
    },
    {
      id: "account-2",
      name: "my account 2",
      publicKey: PK_2,
      sourceId: phrase.id,
    },
  ];
  const importedAccount: Account = {
    id: "account-3",
    name: "imported",
    publicKey: PK_3,
    sourceId: key.id,
    importedFromSecretKey: true,
  };

  const mockActiveAccount: ActiveAccount = {
    publicKey: PK_1,
    privateKey: "SECRET",
    accountName: "my account 1",
    id: "account-1",
    subentryCount: 0,
  };

  const defaultProps = {
    onPressCopyAddress: jest.fn(),
    accounts: mockAccounts,
    sources: [phrase],
    activeAccount: mockActiveAccount,
    handleSelectAccount: jest.fn().mockResolvedValue(undefined),
    isAccountSwitching: false,
    switchingToPublicKey: null,
    fiatTotals: {
      [PK_1]: { label: "$1,149.23", hasError: false },
      [PK_2]: { label: "$872.48", hasError: false },
    },
    isLoadingFiatTotals: false,
  };

  const groupedProps = {
    ...defaultProps,
    accounts: [...mockAccounts, importedAccount],
    sources: [key, phrase],
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

  it("copies the active address from the header, its only action", () => {
    const { getByTestId, queryByTestId } = renderWithProviders(
      <ManageAccountBottomSheet {...defaultProps} />,
    );

    fireEvent.press(getByTestId("manage-accounts-copy-button"));

    expect(defaultProps.onPressCopyAddress).toHaveBeenCalledTimes(1);
    // QR is reached from Home's scan button; rename and the explorer link
    // live on Edit account.
    expect(queryByTestId("manage-accounts-qr-button")).toBeNull();
    expect(queryByTestId("manage-accounts-explorer-button")).toBeNull();
    expect(queryByTestId("manage-accounts-rename-button")).toBeNull();
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

  // Regression: the rows wrapper is a flex child of a gap-[24px] column, so
  // rendering it empty claimed a gap slot and left a blank band under the
  // divider while the account list was still loading.
  it("skips the rows wrapper entirely when there are no accounts", () => {
    const { queryByTestId, getByTestId } = renderWithProviders(
      <ManageAccountBottomSheet {...defaultProps} accounts={[]} />,
    );

    expect(queryByTestId("manage-accounts-list")).toBeNull();
    // The rest of the sheet still renders.
    expect(getByTestId("manage-accounts-active-avatar")).toBeTruthy();
  });

  it("holds the list back until the sources are read", () => {
    const { queryByTestId } = renderWithProviders(
      <ManageAccountBottomSheet {...groupedProps} sources={null} />,
    );

    expect(queryByTestId("manage-accounts-list")).toBeNull();
  });

  it("lists a single source flat, with no group header", () => {
    const { getByTestId, queryAllByTestId } = renderWithProviders(
      <ManageAccountBottomSheet {...defaultProps} />,
    );

    expect(getByTestId("manage-accounts-list")).toBeTruthy();
    expect(queryAllByTestId("manage-accounts-group")).toHaveLength(0);
  });

  it("groups wallets under their phrase, then their key", () => {
    const { getAllByTestId } = renderWithProviders(
      <ManageAccountBottomSheet {...groupedProps} />,
    );

    const [phraseGroup, keyGroup] = getAllByTestId("manage-accounts-group");
    expect(within(phraseGroup).getByText("Recovery phrase 1")).toBeTruthy();
    expect(within(phraseGroup).getByText("my account 2")).toBeTruthy();
    expect(within(keyGroup).getByText("Secret key 1")).toBeTruthy();
    expect(within(keyGroup).getByText("imported")).toBeTruthy();
  });

  it("collapses a group, and keeps it collapsed when the sheet reopens", () => {
    const first = renderWithProviders(
      <ManageAccountBottomSheet {...groupedProps} />,
    );
    const [, keyToggle] = first.getAllByTestId("manage-accounts-group-toggle");

    fireEvent.press(keyToggle);

    expect(first.queryByText("imported")).toBeNull();
    expect(keyToggle.props.accessibilityState).toEqual({ expanded: false });
    first.unmount();

    // The sheet's content unmounts on dismiss; the collapse outlives it.
    const reopened = renderWithProviders(
      <ManageAccountBottomSheet {...groupedProps} />,
    );
    expect(reopened.queryByText("imported")).toBeNull();
    expect(reopened.getByText("my account 2")).toBeTruthy();

    // Expanding again restores the rows, and the state for later tests.
    fireEvent.press(reopened.getAllByTestId("manage-accounts-group-toggle")[1]);
    expect(reopened.getByText("imported")).toBeTruthy();
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

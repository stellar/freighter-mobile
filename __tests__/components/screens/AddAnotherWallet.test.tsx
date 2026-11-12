import { fireEvent } from "@testing-library/react-native";
import AddAnotherWalletScreen from "components/screens/AddAnotherWallet";
import { MANAGE_WALLETS_ROUTES } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const navigation = { navigate: jest.fn() };

const renderScreen = () =>
  renderWithProviders(
    <AddAnotherWalletScreen
      navigation={navigation as never}
      route={{} as never}
    />,
  );

describe("AddAnotherWalletScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ["add-wallet-create", MANAGE_WALLETS_ROUTES.CREATE_WALLET_SCREEN],
    [
      "add-wallet-import-phrase",
      MANAGE_WALLETS_ROUTES.IMPORT_RECOVERY_PHRASE_SCREEN,
    ],
    [
      "add-wallet-import-secret-key",
      MANAGE_WALLETS_ROUTES.IMPORT_SECRET_KEY_SCREEN,
    ],
  ])("%s opens %s", (testID, route) => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId(testID));

    expect(navigation.navigate).toHaveBeenCalledWith(route);
  });

  it("offers only the ways mobile supports", () => {
    const { getByText, queryByText } = renderScreen();

    expect(getByText("Add account")).toBeTruthy();
    expect(getByText("Import Recovery Phrase")).toBeTruthy();
    expect(queryByText("Connect Hardware Wallet")).toBeNull();
  });
});

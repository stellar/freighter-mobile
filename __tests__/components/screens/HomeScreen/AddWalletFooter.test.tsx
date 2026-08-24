import { fireEvent } from "@testing-library/react-native";
import AddWalletFooter from "components/screens/HomeScreen/AddWalletFooter";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("AddWalletFooter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the add wallet label", () => {
    const { getByText } = renderWithProviders(
      <AddWalletFooter onPress={jest.fn()} />,
    );

    expect(getByText("Add wallet")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <AddWalletFooter onPress={onPress} />,
    );

    fireEvent.press(getByTestId("manage-accounts-add-wallet-button"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while disabled", () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <AddWalletFooter onPress={onPress} disabled />,
    );

    fireEvent.press(getByTestId("manage-accounts-add-wallet-button"));

    expect(onPress).not.toHaveBeenCalled();
  });
});

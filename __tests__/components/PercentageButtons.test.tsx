/* eslint-disable @fnando/consistent-import/consistent-import */
import { fireEvent } from "@testing-library/react-native";
import { PercentageButtons } from "components/PercentageButtons";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("PercentageButtons", () => {
  it("renders all four shortcut buttons", () => {
    const { getByTestId } = renderWithProviders(
      <PercentageButtons onPress={jest.fn()} />,
    );

    expect(getByTestId("percentage-25")).toBeTruthy();
    expect(getByTestId("percentage-50")).toBeTruthy();
    expect(getByTestId("percentage-75")).toBeTruthy();
    expect(getByTestId("percentage-100")).toBeTruthy();
  });

  it("calls onPress with each button's percentage value", () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <PercentageButtons onPress={onPress} />,
    );

    fireEvent.press(getByTestId("percentage-25"));
    fireEvent.press(getByTestId("percentage-50"));
    fireEvent.press(getByTestId("percentage-75"));
    fireEvent.press(getByTestId("percentage-100"));

    expect(onPress).toHaveBeenNthCalledWith(1, 25);
    expect(onPress).toHaveBeenNthCalledWith(2, 50);
    expect(onPress).toHaveBeenNthCalledWith(3, 75);
    expect(onPress).toHaveBeenNthCalledWith(4, 100);
  });

  it("forwards a custom testID to the row container", () => {
    const { getByTestId } = renderWithProviders(
      <PercentageButtons onPress={jest.fn()} testID="amount-shortcuts" />,
    );

    expect(getByTestId("amount-shortcuts")).toBeTruthy();
  });
});

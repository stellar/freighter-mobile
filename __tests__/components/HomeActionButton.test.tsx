import { fireEvent } from "@testing-library/react-native";
import { HomeActionButton } from "components/HomeActionButton";
import Icon from "components/sds/Icon";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("HomeActionButton", () => {
  it("renders the title and calls onPress", () => {
    const onPress = jest.fn();
    const { getByText, getByTestId } = renderWithProviders(
      <HomeActionButton
        Icon={Icon.Plus}
        title="Add"
        onPress={onPress}
        testID="icon-button-buy"
      />,
    );

    expect(getByText("Add")).toBeTruthy();

    fireEvent.press(getByTestId("icon-button-buy"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while disabled", () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <HomeActionButton
        Icon={Icon.ArrowUp}
        title="Send"
        onPress={onPress}
        disabled
        testID="icon-button-send"
      />,
    );

    fireEvent.press(getByTestId("icon-button-send"));

    expect(onPress).not.toHaveBeenCalled();
  });

  it("exposes the disabled state to accessibility", () => {
    const { getByTestId } = renderWithProviders(
      <HomeActionButton
        Icon={Icon.RefreshCw02}
        title="Swap"
        onPress={jest.fn()}
        disabled
        testID="icon-button-swap"
      />,
    );

    expect(
      getByTestId("icon-button-swap").props.accessibilityState?.disabled,
    ).toBe(true);
  });
});

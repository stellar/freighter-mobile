import { fireEvent, render } from "@testing-library/react-native";
import { FloatingTabActionButton } from "components/FloatingTabActionButton";
import React from "react";

describe("FloatingTabActionButton", () => {
  it("renders the label and fires onPress", () => {
    const onPress = jest.fn();
    const { getByText, getByTestId } = render(
      <FloatingTabActionButton
        label="Add token"
        onPress={onPress}
        testID="floating-add-button"
      />,
    );

    expect(getByText("Add token")).toBeTruthy();
    fireEvent.press(getByTestId("floating-add-button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

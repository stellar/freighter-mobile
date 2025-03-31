import { render, fireEvent } from "@testing-library/react-native";
import { IconButton } from "components/IconButton";
import Icon from "components/sds/Icon";
import React from "react";

describe("IconButton", () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with all props", () => {
    const { getByText, getByTestId } = render(
      <IconButton Icon={Icon.Home02} title="Home" onPress={mockOnPress} />,
    );

    expect(getByText("Home")).toBeTruthy();
    expect(getByTestId("icon-button")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const { getByTestId } = render(
      <IconButton Icon={Icon.Home02} title="Home" onPress={mockOnPress} />,
    );

    fireEvent.press(getByTestId("icon-button"));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    const { getByTestId } = render(
      <IconButton
        Icon={Icon.Home02}
        title="Home"
        onPress={mockOnPress}
        disabled
      />,
    );

    fireEvent.press(getByTestId("icon-button"));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it("is disabled when onPress is not provided", () => {
    const { getByTestId } = render(
      <IconButton Icon={Icon.Home02} title="Home" />,
    );

    fireEvent.press(getByTestId("icon-button"));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it("renders with correct opacity when disabled", () => {
    const { getByTestId } = render(
      <IconButton Icon={Icon.Home02} title="Home" disabled />,
    );

    const container = getByTestId("icon-button-container");
    expect(container.props.style).toHaveProperty("opacity", 0.6);
  });
});

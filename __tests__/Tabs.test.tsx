import { fireEvent, render, screen } from "@testing-library/react-native";
import Tabs from "components/sds/Tabs";
import React from "react";

const OPTIONS = [
  { label: "Receive", value: "receive" },
  { label: "Scan", value: "scan" },
];

describe("Tabs Component", () => {
  it("renders all option labels", () => {
    render(
      <Tabs
        options={OPTIONS}
        selectedValue="receive"
        onValueChange={jest.fn()}
      />,
    );
    expect(screen.getByText("Receive")).toBeTruthy();
    expect(screen.getByText("Scan")).toBeTruthy();
  });

  it("fires onValueChange with the pressed option value", () => {
    const onValueChange = jest.fn();
    render(
      <Tabs
        options={OPTIONS}
        selectedValue="receive"
        onValueChange={onValueChange}
      />,
    );
    fireEvent.press(screen.getByText("Scan"));
    expect(onValueChange).toHaveBeenCalledWith("scan");
  });

  it("does not fire onValueChange when disabled", () => {
    const onValueChange = jest.fn();
    render(
      <Tabs
        options={OPTIONS}
        selectedValue="receive"
        onValueChange={onValueChange}
        disabled
      />,
    );
    fireEvent.press(screen.getByText("Scan"));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("applies a fixed width via style when width is provided", () => {
    render(
      <Tabs
        testID="tabs"
        options={OPTIONS}
        selectedValue="receive"
        onValueChange={jest.fn()}
        width={240}
      />,
    );
    const container = screen.getByTestId("tabs");
    const style = Array.isArray(container.props.style)
      ? Object.assign({}, ...container.props.style.flat())
      : container.props.style;
    expect(style.width).toBe(240);
  });
});

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

  const flattenStyle = (node: { props: { style?: unknown } }) => {
    const { style } = node.props;
    return Array.isArray(style)
      ? Object.assign({}, ...(style as object[]).flat())
      : ((style ?? {}) as Record<string, unknown>);
  };

  const fireLayout = (node: unknown, width: number) =>
    fireEvent(node as never, "layout", {
      nativeEvent: { layout: { width, height: 40, x: 0, y: 0 } },
    });

  it("hug mode equalizes every tab to the widest measured tab", () => {
    render(
      <Tabs
        options={OPTIONS}
        selectedValue="receive"
        onValueChange={jest.fn()}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    // Each hug-mode tab measures itself via onLayout.
    expect(tabs.every((tab) => typeof tab.props.onLayout === "function")).toBe(
      true,
    );

    // Report differing natural widths; the wider one wins.
    fireLayout(tabs[0], 80);
    fireLayout(tabs[1], 120);

    screen.getAllByRole("tab").forEach((tab) => {
      expect(flattenStyle(tab).minWidth).toBe(120);
    });
  });

  it("fill mode stretches tabs without the measure/equalize pass", () => {
    render(
      <Tabs
        sizing="fill"
        options={OPTIONS}
        selectedValue="receive"
        onValueChange={jest.fn()}
      />,
    );

    screen.getAllByRole("tab").forEach((tab) => {
      // No measuring in fill mode, and no per-tab minWidth is applied.
      expect(tab.props.onLayout).toBeUndefined();
      expect(flattenStyle(tab).minWidth).toBeUndefined();
    });
  });
});

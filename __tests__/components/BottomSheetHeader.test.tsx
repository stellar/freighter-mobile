import { fireEvent } from "@testing-library/react-native";
import {
  BottomSheetHeader,
  PinnedBottomSheetHeader,
} from "components/BottomSheetHeader";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Text, View } from "react-native";

describe("BottomSheetHeader", () => {
  it("renders the title and a close button that calls onClose", () => {
    const onClose = jest.fn();
    const { getByText, getByTestId, getByLabelText } = renderWithProviders(
      <BottomSheetHeader
        title="Before you receive"
        onClose={onClose}
        closeTestID="sheet-close"
      />,
    );

    expect(getByText("Before you receive")).toBeTruthy();
    expect(getByLabelText("Close")).toBeTruthy();

    fireEvent.press(getByTestId("sheet-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables the close button when closeDisabled is set", () => {
    const onClose = jest.fn();
    const { getByTestId } = renderWithProviders(
      <BottomSheetHeader
        title="Rename account"
        onClose={onClose}
        closeDisabled
        closeTestID="sheet-close"
      />,
    );

    const closeButton = getByTestId("sheet-close");
    expect(closeButton.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );

    fireEvent.press(closeButton);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("omits the close button when there is no onClose", () => {
    const { queryByLabelText, getByText } = renderWithProviders(
      <BottomSheetHeader title="Review" />,
    );

    expect(getByText("Review")).toBeTruthy();
    expect(queryByLabelText("Close")).toBeNull();
  });

  it("renders nothing when it has no title, leading element or onClose", () => {
    const { toJSON } = renderWithProviders(
      <View testID="wrapper">
        <BottomSheetHeader />
      </View>,
    );

    // Find the wrapper in the rendered tree. An empty header leaves it with no children.
    type Node = { props?: { testID?: string }; children?: Node[] | null };
    const findWrapper = (node: Node | Node[] | null): Node | null => {
      if (!node) return null;
      if (Array.isArray(node)) {
        return node.reduce<Node | null>((f, n) => f ?? findWrapper(n), null);
      }
      if (node.props?.testID === "wrapper") return node;
      return findWrapper(node.children ?? null);
    };

    const wrapper = findWrapper(toJSON() as Node | Node[] | null);
    expect(wrapper).not.toBeNull();
    expect(wrapper?.children ?? null).toBeNull();
  });

  it("stacks the leading element above the title by default", () => {
    const { getByTestId, getByText } = renderWithProviders(
      <BottomSheetHeader
        title="Not enough XLM"
        leading={<View testID="token-icon" />}
        onClose={jest.fn()}
      />,
    );

    expect(getByTestId("token-icon")).toBeTruthy();
    expect(getByText("Not enough XLM")).toBeTruthy();
  });

  it("stacks without a leading element when asked", () => {
    const { getByText, getByLabelText } = renderWithProviders(
      <BottomSheetHeader
        title="Forgot your password?"
        layout="stacked"
        onClose={jest.fn()}
      />,
    );

    expect(getByText("Forgot your password?")).toBeTruthy();
    expect(getByLabelText("Close")).toBeTruthy();
  });

  it("centers the title in the centered layout", () => {
    const { getByTestId } = renderWithProviders(
      <BottomSheetHeader
        title="Connected apps"
        layout="centered"
        onClose={jest.fn()}
        titleTestID="sheet-title"
      />,
    );

    const title = getByTestId("sheet-title");
    const flatStyle = Array.isArray(title.props.style)
      ? Object.assign({}, ...title.props.style.flat())
      : title.props.style;
    expect(flatStyle.textAlign).toBe("center");
  });

  it("accepts a custom leading element", () => {
    const { getByText } = renderWithProviders(
      <BottomSheetHeader leading={<Text>Settings</Text>} onClose={jest.fn()} />,
    );

    expect(getByText("Settings")).toBeTruthy();
  });
});

describe("PinnedBottomSheetHeader", () => {
  it("renders the header with 24pt below it by default", () => {
    const onClose = jest.fn();
    const { getByText, getByTestId, toJSON } = renderWithProviders(
      <PinnedBottomSheetHeader
        title="Hidden tokens"
        onClose={onClose}
        closeTestID="sheet-close"
      />,
    );

    expect(getByText("Hidden tokens")).toBeTruthy();
    fireEvent.press(getByTestId("sheet-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(toJSON())).toContain("pb-[24px]");
  });

  it("uses 16pt below it when asked", () => {
    const { toJSON } = renderWithProviders(
      <PinnedBottomSheetHeader title="Wallets" spaceBelow={16} />,
    );

    expect(JSON.stringify(toJSON())).toContain("pb-[16px]");
  });
});

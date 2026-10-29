/* eslint-disable react/react-in-jsx-scope */
import { fireEvent } from "@testing-library/react-native";
import HiddenItemsBottomSheet, {
  HiddenItem,
} from "components/HiddenItemsBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { View } from "react-native";

// Record the props passed to the wrapper and render its pinned header, its
// content and its pinned footer inline, since the real modal only mounts
// once presented.
const capturedSheetProps: Record<string, any> = {};

jest.mock("components/BottomSheet", () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const { View: RNView } = require("react-native");
  return {
    __esModule: true,
    default: (props: any) => {
      Object.assign(capturedSheetProps, props);
      return (
        <RNView testID="mock-bottom-sheet">
          {props.scrollViewHeaderComponent?.()}
          {props.customContent}
          {props.scrollViewFooterComponent?.()}
        </RNView>
      );
    },
  };
});

const makeItem = (overrides: Partial<HiddenItem> = {}): HiddenItem => ({
  id: "KALE:GISSUER",
  leading: <View testID="leading-KALE" />,
  title: "KALE",
  subtitle: "kalepail.com",
  onUnhide: jest.fn(),
  ...overrides,
});

describe("HiddenItemsBottomSheet", () => {
  const onClose = jest.fn();
  const modalRef = React.createRef<any>();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(capturedSheetProps).forEach(
      (key) => delete capturedSheetProps[key],
    );
  });

  it("uses the wrapper's scrollable mode with a pinned header and footer", () => {
    renderWithProviders(
      <HiddenItemsBottomSheet
        modalRef={modalRef}
        title="Hidden tokens"
        emptyText="No hidden tokens"
        items={[makeItem()]}
        onClose={onClose}
      />,
    );

    expect(capturedSheetProps.scrollable).toBe(true);
    // The list scrolls once the sheet reaches the wrapper's default max height.
    expect(capturedSheetProps.maxDynamicContentSize).toBeUndefined();
    expect(typeof capturedSheetProps.scrollViewHeaderComponent).toBe(
      "function",
    );
    // No pinned Close footer: the header's X is the only way to dismiss.
    expect(capturedSheetProps.scrollViewFooterComponent).toBeUndefined();
  });

  it("renders the empty state and no rows when nothing is hidden", () => {
    const { getByText, getByTestId, queryByTestId } = renderWithProviders(
      <HiddenItemsBottomSheet
        modalRef={modalRef}
        title="Hidden tokens"
        emptyText="No hidden tokens"
        items={[]}
        onClose={onClose}
      />,
    );

    expect(getByText("Hidden tokens")).toBeTruthy();
    expect(getByText("No hidden tokens")).toBeTruthy();
    expect(getByTestId("hidden-items-sheet-empty")).toBeTruthy();
    expect(queryByTestId("hidden-items-sheet-row-KALE:GISSUER")).toBeNull();
  });

  it("renders a row per item with its Unhide button", () => {
    const item = makeItem();
    const { getByText, getByTestId, queryByTestId } = renderWithProviders(
      <HiddenItemsBottomSheet
        modalRef={modalRef}
        title="Hidden tokens"
        emptyText="No hidden tokens"
        items={[item]}
        onClose={onClose}
      />,
    );

    expect(getByText("KALE")).toBeTruthy();
    expect(getByText("kalepail.com")).toBeTruthy();
    expect(getByTestId("leading-KALE")).toBeTruthy();
    expect(queryByTestId("hidden-items-sheet-empty")).toBeNull();

    fireEvent.press(getByTestId("hidden-items-sheet-unhide-KALE:GISSUER"));

    expect(item.onUnhide).toHaveBeenCalledTimes(1);
  });

  it("closes from the X icon, with no Close button", () => {
    const { getByTestId, queryByText } = renderWithProviders(
      <HiddenItemsBottomSheet
        modalRef={modalRef}
        title="Hidden tokens"
        emptyText="No hidden tokens"
        items={[]}
        onClose={onClose}
      />,
    );

    expect(queryByText("Close")).toBeNull();

    fireEvent.press(getByTestId("hidden-items-sheet-close-icon"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

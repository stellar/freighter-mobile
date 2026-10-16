/* eslint-disable react/react-in-jsx-scope */
import { fireEvent } from "@testing-library/react-native";
import HiddenItemsSheetContent, {
  HiddenItem,
  LIST_MAX_HEIGHT_RATIO,
} from "components/HiddenItemsSheetContent";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Dimensions, ScrollView, View } from "react-native";

const makeItem = (overrides: Partial<HiddenItem> = {}): HiddenItem => ({
  id: "KALE:GISSUER",
  leading: <View testID="leading-KALE" />,
  title: "KALE",
  subtitle: "kalepail.com",
  onUnhide: jest.fn(),
  ...overrides,
});

describe("HiddenItemsSheetContent", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the empty state and no rows when nothing is hidden", () => {
    const { getByText, getByTestId, queryByTestId } = renderWithProviders(
      <HiddenItemsSheetContent
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

  it("caps the list at a share of the window height, in points", () => {
    const items = Array.from({ length: 40 }, (_, i) =>
      makeItem({ id: `TOKEN${i}:GISSUER`, title: `TOKEN${i}` }),
    );
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { UNSAFE_getByType } = renderWithProviders(
      <HiddenItemsSheetContent
        title="Hidden tokens"
        emptyText="No hidden tokens"
        items={items}
        onClose={onClose}
      />,
    );

    const { maxHeight } = UNSAFE_getByType(ScrollView).props.style;
    // A percentage would not resolve inside a content-sized sheet
    expect(typeof maxHeight).toBe("number");
    expect(maxHeight).toBe(
      Dimensions.get("window").height * LIST_MAX_HEIGHT_RATIO,
    );
  });

  it("renders a row per item with its Unhide button", () => {
    const item = makeItem();
    const { getByText, getByTestId, queryByTestId } = renderWithProviders(
      <HiddenItemsSheetContent
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

  it("closes from the X icon and the Close button", () => {
    const { getByTestId, getByText } = renderWithProviders(
      <HiddenItemsSheetContent
        title="Hidden tokens"
        emptyText="No hidden tokens"
        items={[]}
        onClose={onClose}
      />,
    );

    fireEvent.press(getByTestId("hidden-items-sheet-close-icon"));
    fireEvent.press(getByText("Close"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

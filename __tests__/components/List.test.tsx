import { fireEvent } from "@testing-library/react-native";
import { List } from "components/List";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("List", () => {
  const mockItems = [
    {
      title: "Item 1",
      testID: "item-1",
    },
    {
      title: "Item 2",
      testID: "item-2",
    },
    {
      title: "Item 3",
      testID: "item-3",
    },
  ];

  it("renders list items correctly", () => {
    const { getByText } = renderWithProviders(<List items={mockItems} />);

    mockItems.forEach((item) => {
      expect(getByText(item.title)).toBeTruthy();
    });
  });

  it("renders list items with icons", () => {
    const itemsWithIcons = mockItems.map((item) => ({
      ...item,
      icon: <Text testID={`${item.testID}-icon`}>Icon</Text>,
    }));

    const { getByTestId } = renderWithProviders(
      <List items={itemsWithIcons} />,
    );

    itemsWithIcons.forEach((item) => {
      expect(getByTestId(`${item.testID}-icon`)).toBeTruthy();
    });
  });

  it("renders list items with trailing content", () => {
    const itemsWithTrailing = mockItems.map((item) => ({
      ...item,
      trailingContent: <Text testID={`${item.testID}-trailing`}>Trailing</Text>,
    }));

    const { getByTestId } = renderWithProviders(
      <List items={itemsWithTrailing} />,
    );

    itemsWithTrailing.forEach((item) => {
      expect(getByTestId(`${item.testID}-trailing`)).toBeTruthy();
    });
  });

  it("calls onPress when an item is pressed", () => {
    const mockOnPress = jest.fn();
    const itemsWithOnPress = mockItems.map((item) => ({
      ...item,
      onPress: mockOnPress,
    }));

    const { getByText } = renderWithProviders(
      <List items={itemsWithOnPress} />,
    );

    fireEvent.press(getByText("Item 1"));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it("renders items with custom title color", () => {
    const itemsWithCustomColor = mockItems.map((item) => ({
      ...item,
      titleColor: THEME.colors.text.primary,
    }));

    const { getByText } = renderWithProviders(
      <List items={itemsWithCustomColor} />,
    );

    const firstItem = getByText("Item 1");
    expect(firstItem.props.style).toMatchObject({
      color: THEME.colors.text.primary,
    });
  });

  it("renders dividers between items", () => {
    const { getByTestId } = renderWithProviders(<List items={mockItems} />);

    // There should be one less divider than the number of items
    expect(getByTestId("divider-0")).toBeTruthy();
    expect(getByTestId("divider-1")).toBeTruthy();
  });
});

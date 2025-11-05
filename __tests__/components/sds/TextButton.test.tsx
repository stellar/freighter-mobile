import { userEvent } from "@testing-library/react-native";
import { TextButton } from "components/sds/TextButton";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("TextButton", () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders text correctly", () => {
    const { getByText } = renderWithProviders(
      <TextButton text="Test Button" onPress={mockOnPress} />,
    );

    expect(getByText("Test Button")).toBeTruthy();
  });

  it("calls onPress when pressed", async () => {
    const user = userEvent.setup();
    const { getByText } = renderWithProviders(
      <TextButton text="Test Button" onPress={mockOnPress} />,
    );

    await user.press(getByText("Test Button"));

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it("shows spinner when isLoading is true", () => {
    const { getByTestId } = renderWithProviders(
      <TextButton text="Test Button" isLoading onPress={mockOnPress} />,
    );

    expect(getByTestId("spinner")).toBeTruthy();
  });

  it("does not show text when isLoading is true", () => {
    const { queryByText } = renderWithProviders(
      <TextButton text="Test Button" isLoading onPress={mockOnPress} />,
    );

    expect(queryByText("Test Button")).toBeNull();
  });

  it("applies testID when provided", () => {
    const { getByTestId } = renderWithProviders(
      <TextButton
        text="Test Button"
        testID="test-button"
        onPress={mockOnPress}
      />,
    );

    expect(getByTestId("test-button")).toBeTruthy();
  });

  it("renders with different variants", () => {
    const { getByText: getByTextError } = renderWithProviders(
      <TextButton text="Error Button" variant="error" onPress={mockOnPress} />,
    );

    expect(getByTextError("Error Button")).toBeTruthy();

    const { getByText: getByTextWarning } = renderWithProviders(
      <TextButton
        text="Warning Button"
        variant="warning"
        onPress={mockOnPress}
      />,
    );

    expect(getByTextWarning("Warning Button")).toBeTruthy();

    const { getByText: getByTextPrimary } = renderWithProviders(
      <TextButton
        text="Primary Button"
        variant="primary"
        onPress={mockOnPress}
      />,
    );

    expect(getByTextPrimary("Primary Button")).toBeTruthy();

    const { getByText: getByTextSecondary } = renderWithProviders(
      <TextButton text="Secondary Button" onPress={mockOnPress} />,
    );

    expect(getByTextSecondary("Secondary Button")).toBeTruthy();
  });
});

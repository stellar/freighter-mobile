import { fireEvent } from "@testing-library/react-native";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("OnboardLayout", () => {
  it("renders children, title and icon correctly", () => {
    const { getByText, getByTestId } = renderWithProviders(
      <OnboardLayout
        title="Welcome"
        // Pass a custom icon with a testID so we can easily query it.
        icon={<Icon.ArrowLeft />}
      >
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    expect(getByText("Welcome")).toBeTruthy();
    expect(getByText("Test Content")).toBeTruthy();
    expect(getByTestId("SvgMock")).toBeTruthy();
  });

  it("renders footer note text and the default footer button when no footer is provided", () => {
    const mockOnPressDefaultActionButton = jest.fn();
    const { getByText } = renderWithProviders(
      <OnboardLayout
        footerNoteText="Footer Note"
        onPressDefaultActionButton={mockOnPressDefaultActionButton}
        defaultActionButtonText="Default Button"
      >
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    // Verify that the footer note text is rendered.
    expect(getByText("Footer Note")).toBeTruthy();

    // Verify that the default action button is rendered with the correct text.
    const defaultButton = getByText("Default Button");
    expect(defaultButton).toBeTruthy();

    // Simulate button press and verify callback is invoked.
    fireEvent.press(defaultButton);
    expect(mockOnPressDefaultActionButton).toHaveBeenCalledTimes(1);
  });

  it("renders custom footer when footer prop is provided", () => {
    const { getByText, queryByText } = renderWithProviders(
      <OnboardLayout footer={<Text>Custom Footer</Text>}>
        <Text>Test Content</Text>
      </OnboardLayout>,
    );

    // Verify that the custom footer is rendered.
    expect(getByText("Custom Footer")).toBeTruthy();

    // The default footer button should not be rendered.
    expect(queryByText("Continue")).toBeNull();
  });
});

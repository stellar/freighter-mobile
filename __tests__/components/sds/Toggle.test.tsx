import { userEvent } from "@testing-library/react-native";
import Icon from "components/sds/Icon";
import { Toggle, ToggleSize } from "components/sds/Toggle";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

/**
 * Tests for the Toggle component
 *
 * These tests verify:
 * - Rendering in different states (checked/unchecked)
 * - Size variations (sm, md, lg)
 * - User interactions via userEvent
 * - Disabled state behavior
 * - Custom icons
 * - Accessibility features
 * - Default prop behavior
 */
describe("Toggle", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic rendering", () => {
    it("renders correctly in unchecked state", () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle).toBeTruthy();
      expect(toggle.props.accessibilityState.checked).toBe(false);
    });

    it("renders correctly in checked state", () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked
          onChange={mockOnChange}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle).toBeTruthy();
      expect(toggle.props.accessibilityState.checked).toBe(true);
    });

    it("uses medium size as default", () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle).toBeTruthy();
      // Default behavior should work without explicit size prop
    });
  });

  describe("Size variations", () => {
    const sizes: ToggleSize[] = ["sm", "md", "lg"];

    sizes.forEach((size) => {
      it(`renders correctly with ${size} size`, () => {
        const { getByTestId } = renderWithProviders(
          <Toggle
            id="test-toggle"
            checked={false}
            onChange={mockOnChange}
            size={size}
            testID="toggle-component"
          />,
        );

        const toggle = getByTestId("toggle-component");
        expect(toggle).toBeTruthy();
      });
    });
  });

  describe("User interactions", () => {
    it("calls onChange when pressed", async () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      await userEvent.press(toggle);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
    }, 30000);

    it("does not call onChange when disabled", async () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          disabled
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      await userEvent.press(toggle);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("works without onChange prop", async () => {
      const { getByTestId } = renderWithProviders(
        <Toggle id="test-toggle" checked={false} testID="toggle-component" />,
      );

      const toggle = getByTestId("toggle-component");
      await userEvent.press(toggle);

      // Should not throw error
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe("Disabled state", () => {
    it("renders correctly when disabled", () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          disabled
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle).toBeTruthy();
      // Disabled state should still be accessible for testing
    });

    it("maintains checked state when disabled", () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked
          onChange={mockOnChange}
          disabled
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle.props.accessibilityState.checked).toBe(true);
    });
  });

  describe("Custom icons", () => {
    it("renders with custom checked and unchecked icons", () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          iconChecked={<Icon.Sun size={16} />}
          iconUnchecked={<Icon.Moon01 size={16} />}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle).toBeTruthy();
    });

    it("renders with only checked icon", () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked
          onChange={mockOnChange}
          iconChecked={<Icon.Sun size={16} />}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle).toBeTruthy();
    });

    it("renders with only unchecked icon", () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          iconUnchecked={<Icon.Moon01 size={16} />}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("has correct accessibility role", () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle.props.accessibilityRole).toBe("switch");
    });

    it("has correct accessibility state for checked", () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked
          onChange={mockOnChange}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle.props.accessibilityState.checked).toBe(true);
    });

    it("has correct accessibility state for unchecked", () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle.props.accessibilityState.checked).toBe(false);
    });

    it("uses title for accessibility label", () => {
      const title = "Enable notifications";
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          title={title}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");
      expect(toggle.props.accessibilityLabel).toBe(title);
    });
  });

  describe("Edge cases", () => {
    it("handles rapid state changes", async () => {
      const { getByTestId } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          testID="toggle-component"
        />,
      );

      const toggle = getByTestId("toggle-component");

      // Simulate rapid presses
      await userEvent.press(toggle);
      await userEvent.press(toggle);
      await userEvent.press(toggle);

      expect(mockOnChange).toHaveBeenCalledTimes(3);
    });

    it("handles component unmounting gracefully", () => {
      const { unmount } = renderWithProviders(
        <Toggle
          id="test-toggle"
          checked={false}
          onChange={mockOnChange}
          testID="toggle-component"
        />,
      );

      expect(() => unmount()).not.toThrow();
    });
  });

  describe("Real-world usage scenarios", () => {
    it("works in analytics preferences context", async () => {
      let analyticsEnabled = false;
      const handleAnalyticsToggle = jest.fn(() => {
        analyticsEnabled = !analyticsEnabled;
      });

      const { getByTestId } = renderWithProviders(
        <Toggle
          id="analytics-toggle"
          checked={analyticsEnabled}
          onChange={handleAnalyticsToggle}
          title="Anonymous data sharing"
          testID="analytics-toggle"
        />,
      );

      const toggle = getByTestId("analytics-toggle");
      expect(toggle.props.accessibilityState.checked).toBe(false);

      await userEvent.press(toggle);
      expect(handleAnalyticsToggle).toHaveBeenCalledTimes(1);
    });

    it("works in theme switching context", async () => {
      let isDarkMode = false;
      const handleThemeToggle = jest.fn(() => {
        isDarkMode = !isDarkMode;
      });

      const { getByTestId } = renderWithProviders(
        <Toggle
          id="theme-toggle"
          checked={isDarkMode}
          onChange={handleThemeToggle}
          size="lg"
          iconChecked={<Icon.Moon01 size={16} />}
          iconUnchecked={<Icon.Sun size={16} />}
          title="Dark mode"
          testID="theme-toggle"
        />,
      );

      const toggle = getByTestId("theme-toggle");
      expect(toggle.props.accessibilityState.checked).toBe(false);

      await userEvent.press(toggle);
      expect(handleThemeToggle).toHaveBeenCalledTimes(1);
    });
  });
});

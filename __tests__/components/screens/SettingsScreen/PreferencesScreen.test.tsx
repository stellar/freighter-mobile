import { userEvent } from "@testing-library/react-native";
import PreferencesScreen from "components/screens/SettingsScreen/PreferencesScreen";
import { useAnalyticsStore } from "ducks/analytics";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { analytics } from "services/analytics";

jest.mock("ducks/analytics", () => ({
  useAnalyticsStore: jest.fn(),
}));

jest.mock("services/analytics", () => ({
  analytics: {
    setAnalyticsEnabled: jest.fn(),
  },
}));

const mockUseAnalyticsStore = useAnalyticsStore as jest.MockedFunction<
  typeof useAnalyticsStore
>;

describe("PreferencesScreen", () => {
  const mockSetEnabled = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAnalyticsStore.mockReturnValue({
      isEnabled: false,
      setEnabled: mockSetEnabled,
    });
  });

  const renderPreferencesScreen = () =>
    renderWithProviders(
      <PreferencesScreen navigation={{} as never} route={{} as never} />,
    );

  describe("Basic Rendering", () => {
    it("renders correctly with analytics disabled", () => {
      const { getByTestId } = renderPreferencesScreen();

      expect(getByTestId("toggle-analytics-toggle")).toBeTruthy();
      expect(getByTestId("anonymous-data-sharing-item")).toBeTruthy();
    });

    it("renders correctly with analytics enabled", () => {
      mockUseAnalyticsStore.mockReturnValue({
        isEnabled: true,
        setEnabled: mockSetEnabled,
      });

      const { getByTestId } = renderPreferencesScreen();

      expect(getByTestId("toggle-analytics-toggle")).toBeTruthy();

      const toggle = getByTestId("toggle-analytics-toggle");
      expect(toggle.props.accessibilityState.checked).toBe(true);
    });
  });

  describe("Analytics Toggle Interaction", () => {
    it("enables analytics when toggle is pressed while disabled", async () => {
      mockUseAnalyticsStore.mockReturnValue({
        isEnabled: false,
        setEnabled: mockSetEnabled,
      });

      const { getByTestId } = renderPreferencesScreen();

      const toggle = getByTestId("toggle-analytics-toggle");
      expect(toggle.props.accessibilityState.checked).toBe(false);

      await userEvent.press(toggle);

      expect(analytics.setAnalyticsEnabled).toHaveBeenCalledTimes(1);
      expect(analytics.setAnalyticsEnabled).toHaveBeenCalledWith(true);
    }, 15000);

    it("disables analytics when toggle is pressed while enabled", async () => {
      mockUseAnalyticsStore.mockReturnValue({
        isEnabled: true,
        setEnabled: mockSetEnabled,
      });

      const { getByTestId } = renderPreferencesScreen();

      const toggle = getByTestId("toggle-analytics-toggle");
      expect(toggle.props.accessibilityState.checked).toBe(true);

      await userEvent.press(toggle);

      expect(analytics.setAnalyticsEnabled).toHaveBeenCalledTimes(1);
      expect(analytics.setAnalyticsEnabled).toHaveBeenCalledWith(false);
    });

    it("handles rapid toggle presses correctly", async () => {
      const { getByTestId } = renderPreferencesScreen();

      const toggle = getByTestId("toggle-analytics-toggle");

      // Simulate rapid presses - each press calls setEnabled with the opposite of current mock state
      await userEvent.press(toggle);
      await userEvent.press(toggle);
      await userEvent.press(toggle);

      expect(analytics.setAnalyticsEnabled).toHaveBeenCalledTimes(3);
      // Each call should pass the opposite of the mocked isEnabled (false), so all calls should be true
      expect(analytics.setAnalyticsEnabled).toHaveBeenNthCalledWith(1, true);
      expect(analytics.setAnalyticsEnabled).toHaveBeenNthCalledWith(2, true);
      expect(analytics.setAnalyticsEnabled).toHaveBeenNthCalledWith(3, true);
    });
  });

  describe("Accessibility", () => {
    it("has proper accessibility labels for the toggle", () => {
      const { getByTestId } = renderPreferencesScreen();

      const toggle = getByTestId("toggle-analytics-toggle");
      expect(toggle.props.accessibilityRole).toBe("switch");
      expect(toggle.props.accessibilityState.checked).toBe(false);
    });

    it("maintains accessibility when analytics is enabled", () => {
      mockUseAnalyticsStore.mockReturnValue({
        isEnabled: true,
        setEnabled: mockSetEnabled,
      });

      const { getByTestId } = renderPreferencesScreen();

      const toggle = getByTestId("toggle-analytics-toggle");
      expect(toggle.props.accessibilityRole).toBe("switch");
      expect(toggle.props.accessibilityState.checked).toBe(true);
    });
  });

  describe("State Management", () => {
    it("reflects the analytics disabled state correctly", () => {
      mockUseAnalyticsStore.mockReturnValue({
        isEnabled: false,
        setEnabled: mockSetEnabled,
      });

      const { getByTestId } = renderPreferencesScreen();
      const toggle = getByTestId("toggle-analytics-toggle");
      expect(toggle.props.accessibilityState.checked).toBe(false);
    });

    it("reflects the analytics enabled state correctly", () => {
      mockUseAnalyticsStore.mockReturnValue({
        isEnabled: true,
        setEnabled: mockSetEnabled,
      });

      const { getByTestId } = renderPreferencesScreen();
      const toggle = getByTestId("toggle-analytics-toggle");
      expect(toggle.props.accessibilityState.checked).toBe(true);
    });
  });
});

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { userEvent } from "@testing-library/react-native";
import PreferencesScreen from "components/screens/SettingsScreen/PreferencesScreen";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import { useAnalyticsAndPermissions } from "hooks/useAnalyticsAndPermissions";
import React from "react";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn((callback) => {
    callback();
    return () => {};
  }),
}));

const mockHandleAnalyticsToggleClick = jest.fn(() => Promise.resolve());
const mockSyncTrackingPermission = jest.fn();

jest.mock("hooks/useAnalyticsAndPermissions", () => ({
  useAnalyticsAndPermissions: jest.fn(),
}));

const mockUseAnalyticsAndPermissions =
  useAnalyticsAndPermissions as jest.MockedFunction<
    typeof useAnalyticsAndPermissions
  >;

type PreferencesScreenNavigationProp = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.PREFERENCES_SCREEN
>["navigation"];

type PreferencesScreenRouteProp = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.PREFERENCES_SCREEN
>["route"];

const mockNavigation = {
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as unknown as PreferencesScreenNavigationProp;

const mockRoute = {
  key: "preferences",
  name: SETTINGS_ROUTES.PREFERENCES_SCREEN,
} as unknown as PreferencesScreenRouteProp;

describe("PreferencesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAnalyticsAndPermissions.mockReturnValue({
      isTrackingEnabled: false,
      attRequested: false,
      handleAnalyticsToggleClick: mockHandleAnalyticsToggleClick,
      syncTrackingPermission: mockSyncTrackingPermission,
      isPermissionLoading: false,
    });
  });

  const renderPreferencesScreen = () =>
    renderWithProviders(
      <PreferencesScreen navigation={mockNavigation} route={mockRoute} />,
    );

  it("renders the analytics toggle correctly", () => {
    const { getByTestId } = renderPreferencesScreen();

    expect(getByTestId("toggle-analytics-toggle")).toBeTruthy();
    expect(getByTestId("anonymous-data-sharing-item")).toBeTruthy();
  });

  it("shows analytics toggle as disabled by default", () => {
    const { getByTestId } = renderPreferencesScreen();

    const toggle = getByTestId("toggle-analytics-toggle");
    expect(toggle.props.accessibilityState.checked).toBe(false);
  });

  it("calls handleAnalyticsToggleClick when toggle is pressed", async () => {
    const { getByTestId } = renderPreferencesScreen();

    const toggle = getByTestId("toggle-analytics-toggle");
    await userEvent.press(toggle);

    expect(mockHandleAnalyticsToggleClick).toHaveBeenCalledTimes(1);
  });

  it("shows loading spinner when permission is being checked", () => {
    mockUseAnalyticsAndPermissions.mockReturnValue({
      isTrackingEnabled: false,
      attRequested: false,
      handleAnalyticsToggleClick: mockHandleAnalyticsToggleClick,
      syncTrackingPermission: mockSyncTrackingPermission,
      isPermissionLoading: true,
    });

    const { getByTestId } = renderPreferencesScreen();

    expect(getByTestId("analytics-toggle-loading")).toBeTruthy();
  });
});

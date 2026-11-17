import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { userEvent } from "@testing-library/react-native";
import PreferencesScreen from "components/screens/SettingsScreen/PreferencesScreen";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import { useAnalyticsPermissions } from "hooks/useAnalyticsPermissions";
import React from "react";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn((callback) => {
    callback();
    return () => {};
  }),
}));

const mockHandleAnalyticsToggle = jest.fn(() => Promise.resolve());
const mockSyncTrackingPermission = jest.fn();
const mockSetShowPermissionModal = jest.fn();
const mockHandleOpenSettings = jest.fn(() => Promise.resolve());

jest.mock("hooks/useAnalyticsPermissions", () => ({
  useAnalyticsPermissions: jest.fn(),
}));

const mockSelectThemePreference = jest.fn(() => Promise.resolve());
jest.mock("services/themePreference", () => ({
  selectThemePreference: (...args: unknown[]) =>
    mockSelectThemePreference(...(args as [])),
}));

const mockOpenInAppBrowser = jest.fn(() => Promise.resolve());
jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({ open: mockOpenInAppBrowser }),
}));

const mockUseAnalyticsPermissions =
  useAnalyticsPermissions as jest.MockedFunction<
    typeof useAnalyticsPermissions
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

    mockUseAnalyticsPermissions.mockReturnValue({
      isTrackingEnabled: false,
      isAttRequested: false,
      handleAnalyticsToggle: mockHandleAnalyticsToggle,
      syncTrackingPermission: mockSyncTrackingPermission,
      isPermissionLoading: false,
      showPermissionModal: false,
      setShowPermissionModal: mockSetShowPermissionModal,
      handleOpenSettings: mockHandleOpenSettings,
      permissionAction: "enable",
    });
  });

  const renderPreferencesScreen = () =>
    renderWithProviders(
      <PreferencesScreen navigation={mockNavigation} route={mockRoute} />,
    );

  it("renders the hide dust toggle correctly", () => {
    const { getByTestId } = renderPreferencesScreen();
    expect(getByTestId("hide-dust-item")).toBeTruthy();
  });

  it("shows hide dust toggle as enabled by default", () => {
    const { getByTestId } = renderPreferencesScreen();
    const toggle = getByTestId("toggle-hide-dust-toggle");
    expect(toggle.props.accessibilityState.checked).toBe(true);
  });

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

  it("enables analytics when toggle is pressed while disabled", async () => {
    const { getByTestId } = renderPreferencesScreen();

    const toggle = getByTestId("toggle-analytics-toggle");
    expect(toggle.props.accessibilityState.checked).toBe(false);

    await userEvent.press(toggle);

    expect(mockHandleAnalyticsToggle).toHaveBeenCalledTimes(1);
  });

  it("disables analytics when toggle is pressed while enabled", async () => {
    mockUseAnalyticsPermissions.mockReturnValue({
      isTrackingEnabled: true,
      isAttRequested: false,
      handleAnalyticsToggle: mockHandleAnalyticsToggle,
      syncTrackingPermission: mockSyncTrackingPermission,
      isPermissionLoading: false,
      showPermissionModal: false,
      setShowPermissionModal: mockSetShowPermissionModal,
      handleOpenSettings: mockHandleOpenSettings,
      permissionAction: "disable",
    });

    const { getByTestId } = renderPreferencesScreen();

    const toggle = getByTestId("toggle-analytics-toggle");
    expect(toggle.props.accessibilityState.checked).toBe(true);

    await userEvent.press(toggle);

    expect(mockHandleAnalyticsToggle).toHaveBeenCalledTimes(1);
  });

  it("handles rapid toggle presses correctly", async () => {
    const { getByTestId } = renderPreferencesScreen();

    const toggle = getByTestId("toggle-analytics-toggle");

    // Simulate rapid presses
    await userEvent.press(toggle);
    await userEvent.press(toggle);
    await userEvent.press(toggle);

    expect(mockHandleAnalyticsToggle).toHaveBeenCalledTimes(3);
  });

  it("calls handleAnalyticsToggle when toggle is pressed", async () => {
    const { getByTestId } = renderPreferencesScreen();

    const toggle = getByTestId("toggle-analytics-toggle");
    await userEvent.press(toggle);

    expect(mockHandleAnalyticsToggle).toHaveBeenCalledTimes(1);
  });

  it("shows the theme picker with Auto(System) selected by default", () => {
    const { getByTestId } = renderPreferencesScreen();

    expect(
      getByTestId("theme-option-system").props.accessibilityState.checked,
    ).toBe(true);
    expect(
      getByTestId("theme-option-light").props.accessibilityState.checked,
    ).toBe(false);
    expect(
      getByTestId("theme-option-dark").props.accessibilityState.checked,
    ).toBe(false);
  });

  it("selects a theme when its option is pressed", async () => {
    const { getByTestId } = renderPreferencesScreen();

    await userEvent.press(getByTestId("theme-option-dark"));

    expect(mockSelectThemePreference).toHaveBeenCalledWith("dark");
  });

  it("opens the privacy policy from the data sharing row", async () => {
    const { getByTestId } = renderPreferencesScreen();

    await userEvent.press(getByTestId("privacy-policy-link"));

    expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
      "https://varialwallet.com/privacy",
    );
  });

  it("shows loading spinner when permission is being checked", () => {
    mockUseAnalyticsPermissions.mockReturnValue({
      isTrackingEnabled: false,
      isAttRequested: false,
      handleAnalyticsToggle: mockHandleAnalyticsToggle,
      syncTrackingPermission: mockSyncTrackingPermission,
      isPermissionLoading: true,
      showPermissionModal: false,
      setShowPermissionModal: mockSetShowPermissionModal,
      handleOpenSettings: mockHandleOpenSettings,
      permissionAction: "enable",
    });

    const { getByTestId } = renderPreferencesScreen();

    expect(getByTestId("analytics-toggle-loading")).toBeTruthy();
  });
});

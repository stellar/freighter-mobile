import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import SettingsScreen from "components/screens/SettingsScreen/SettingsScreen";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock react-native-device-info
jest.mock("react-native-device-info", () => ({
  getVersion: () => "1.1",
  getBuildNumber: () => "1",
}));

type SettingsScreenNavigationProp = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.SETTINGS_SCREEN
>["navigation"];

type SettingsScreenRouteProp = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.SETTINGS_SCREEN
>["route"];

// Mock useNavigation hook
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: jest.fn(() => ({
    goBack: mockGoBack,
  })),
}));

// Mock useAuthenticationStore
const mockLogout = jest.fn();
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({
    logout: mockLogout,
  })),
}));

// Mock useAppTranslation
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string, params?: { version?: string }) => {
      const translations: Record<string, string> = {
        "settings.title": "Settings",
        "settings.logout": "Logout",
        "settings.version": params?.version || "",
      };
      return translations[key] || key;
    },
  }),
}));

const mockNavigation = {
  goBack: mockGoBack,
  setOptions: jest.fn(),
} as unknown as SettingsScreenNavigationProp;

const mockRoute = {
  key: "settings",
  name: SETTINGS_ROUTES.SETTINGS_SCREEN,
} as unknown as SettingsScreenRouteProp;

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText } = renderWithProviders(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />,
    );
    expect(getByText("Logout")).toBeTruthy();
  });

  it("calls logout when logout button is pressed", () => {
    const { getByTestId } = renderWithProviders(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const logoutButton = getByTestId("logout-button");
    fireEvent.press(logoutButton);

    expect(mockLogout).toHaveBeenCalled();
  });

  it("displays the correct version number", () => {
    const { getByTestId } = renderWithProviders(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const versionText = getByTestId("update-button");
    expect(versionText).toHaveTextContent("v1.1 (1)");
  });
});

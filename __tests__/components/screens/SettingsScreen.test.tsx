import { fireEvent } from "@testing-library/react-native";
import { SettingsScreen } from "components/screens/SettingsScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

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
    t: (key: string) => {
      const translations: Record<string, string> = {
        "settings.title": "Settings",
        "settings.logout": "Logout",
      };
      return translations[key] || key;
    },
  }),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<SettingsScreen />);
    expect(getByText("Settings")).toBeTruthy();
    expect(getByText("Logout")).toBeTruthy();
  });

  it("navigates back when back button is pressed", () => {
    const { getByTestId } = renderWithProviders(<SettingsScreen />);

    const backButton = getByTestId("back-button");
    fireEvent.press(backButton);

    expect(mockGoBack).toHaveBeenCalled();
  });

  it("calls logout when logout button is pressed", () => {
    const { getByTestId } = renderWithProviders(<SettingsScreen />);

    const logoutButton = getByTestId("logout-button");
    fireEvent.press(logoutButton);

    expect(mockLogout).toHaveBeenCalled();
  });
});

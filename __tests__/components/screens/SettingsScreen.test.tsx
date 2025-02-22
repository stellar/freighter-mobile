import { render, fireEvent } from "@testing-library/react-native";
import { SettingsScreen } from "components/screens/SettingsScreen";
import { ROUTES } from "config/routes";
import React from "react";

const mockReplace = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    replace: mockReplace,
  }),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText("Settings")).toBeTruthy();
    expect(getByText("Sign out")).toBeTruthy();
  });

  it("navigates to login screen when sign out is pressed", () => {
    const { getByText } = render(<SettingsScreen />);
    const signOutButton = getByText("Sign out");

    fireEvent.press(signOutButton);

    expect(mockReplace).toHaveBeenCalledWith(ROUTES.LOGIN);
  });
});

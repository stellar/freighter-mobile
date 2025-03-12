import { fireEvent } from "@testing-library/react-native";
import { SettingsScreen } from "components/screens/SettingsScreen";
import { MAIN_TAB_ROUTES } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const mockReplace = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    replace: mockReplace,
  }),
}));

// TODO: Create proper tests when screen is done
describe.skip("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText } = renderWithProviders(
      <SettingsScreen navigation={{} as never} />,
    );
    expect(getByText("Settings")).toBeTruthy();
    expect(getByText("Sign out")).toBeTruthy();
  });

  it("navigates to login screen when sign out is pressed", () => {
    const { getByText } = renderWithProviders(
      <SettingsScreen navigation={{} as never} />,
    );
    const signOutButton = getByText("Sign out");

    fireEvent.press(signOutButton);

    expect(mockReplace).toHaveBeenCalledWith(MAIN_TAB_ROUTES.TAB_HOME);
  });
});

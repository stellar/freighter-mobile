import { fireEvent } from "@testing-library/react-native";
import { LoginScreen } from "components/screens/LoginScreen";
import { renderWithProviders } from "helpers/testing";
import React from "react";

// Mock useNavigation hook
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    replace: mockReplace,
  })),
}));

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(getByText("Login")).toBeTruthy();
  });

  it("navigates to main tabs when login button is pressed", () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    const loginButton = getByText("Login");

    fireEvent.press(loginButton);

    expect(mockReplace).toHaveBeenCalledWith("MainTabs");
  });
});

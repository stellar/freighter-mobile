import { fireEvent } from "@testing-library/react-native";
import { ConfirmPasswordScreen } from "components/screens/ConfirmPasswordScreen";
import { AUTH_STACK_ROUTES } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock useNavigation hook
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
  })),
}));

describe("ConfirmPasswordScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText } = renderWithProviders(
      <ConfirmPasswordScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { password: "password12345" } } as never}
      />,
    );
    expect(getByText("Confirm Password")).toBeTruthy();
  });

  it("has disabled continue button when password is less than 8 characters", () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <ConfirmPasswordScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { password: "password12345" } } as never}
      />,
    );

    const passwordInput = getByPlaceholderText("Confirm your password");
    fireEvent.changeText(passwordInput, "short");

    // The button should be disabled, so pressing it should not trigger navigation
    const continueButton = getByText("Continue");
    fireEvent.press(continueButton);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("has disabled continue button when password is different", () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <ConfirmPasswordScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { password: "password123456" } } as never}
      />,
    );

    const passwordInput = getByPlaceholderText("Confirm your password");
    fireEvent.changeText(passwordInput, "password12345");

    // The button should be disabled, so pressing it should not trigger navigation
    const continueButton = getByText("Continue");
    fireEvent.press(continueButton);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("enables continue button when password is at least 8 characters", () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <ConfirmPasswordScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { password: "password12345" } } as never}
      />,
    );

    const passwordInput = getByPlaceholderText("Confirm your password");
    fireEvent.changeText(passwordInput, "password12345");

    // The button should now be enabled
    const continueButton = getByText("Continue");
    fireEvent.press(continueButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.RECOVERY_PHRASE_ALERT_SCREEN,
      { password: "password12345" },
    );
  });

  it("shows footer note text only when password is valid", () => {
    const { getByText, getByPlaceholderText, queryByText } =
      renderWithProviders(
        <ConfirmPasswordScreen
          navigation={{ navigate: mockNavigate } as never}
          route={{ params: { password: "password12345" } } as never}
        />,
      );

    // Initially footer note should not be visible
    expect(
      queryByText(
        "We cannot recover your password for you.\nMake sure you keep this in a safe place.",
      ),
    ).toBeNull();

    const passwordInput = getByPlaceholderText("Confirm your password");
    fireEvent.changeText(passwordInput, "password12345");

    // Footer note should now be visible
    expect(
      getByText(
        "We cannot recover your password for you.\nMake sure you keep this in a safe place.",
      ),
    ).toBeTruthy();
  });
});

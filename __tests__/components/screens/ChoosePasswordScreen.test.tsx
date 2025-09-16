import { fireEvent } from "@testing-library/react-native";
import { ChoosePasswordScreen } from "components/screens/ChoosePasswordScreen";
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

describe("ChoosePasswordScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText } = renderWithProviders(
      <ChoosePasswordScreen
        navigation={{ navigate: mockNavigate, route: {} } as never}
        route={{ params: { password: "password" } } as never}
      />,
    );
    expect(getByText("Choose a Password")).toBeTruthy();
  });

  it("has disabled continue button when password is less than 8 characters", () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <ChoosePasswordScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { password: "password" } } as never}
      />,
    );

    const passwordInput = getByPlaceholderText("Type your password");
    fireEvent.changeText(passwordInput, "short");

    // The button should be disabled, so pressing it should not trigger navigation
    const continueButton = getByText("Continue");
    fireEvent.press(continueButton);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("enables continue button when password is at least 8 characters", () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <ChoosePasswordScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { password: "password" } } as never}
      />,
    );

    const passwordInput = getByPlaceholderText("Type your password");
    fireEvent.changeText(passwordInput, "password12345");

    // The button should now be enabled
    const continueButton = getByText("Continue");
    fireEvent.press(continueButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.CONFIRM_PASSWORD_SCREEN,
      {
        password: "password12345",
      },
    );
  });

  it("shows footer note text only when password is valid", () => {
    const { getByText, getByPlaceholderText, queryByText } =
      renderWithProviders(
        <ChoosePasswordScreen
          navigation={{ navigate: mockNavigate } as never}
          route={{ params: { password: "password" } } as never}
        />,
      );

    // Initially footer note should not be visible
    expect(
      queryByText(
        "We cannot recover your password for you.\nMake sure you keep this in a safe place.",
      ),
    ).toBeNull();

    // Type a valid password
    const passwordInput = getByPlaceholderText("Type your password");
    fireEvent.changeText(passwordInput, "password12345");

    // Footer note should now be visible
    expect(
      getByText(
        "We cannot recover your password for you.\nMake sure you keep this in a safe place.",
      ),
    ).toBeTruthy();
  });

  it("masks password input by default", () => {
    const { getByPlaceholderText } = renderWithProviders(
      <ChoosePasswordScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { password: "" } } as never}
      />,
    );

    const passwordInput = getByPlaceholderText("Type your password");
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });

  it("toggles password visibility when tapping the Eye icon", () => {
    const { getByPlaceholderText, getByTestId } = renderWithProviders(
      <ChoosePasswordScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { password: "" } } as never}
      />,
    );

    const passwordInput = getByPlaceholderText("Type your password");
    expect(passwordInput.props.secureTextEntry).toBe(true);

    const showIcon = getByTestId("eye-icon");
    fireEvent.press(showIcon);

    expect(passwordInput.props.secureTextEntry).toBe(false);

    const hideIcon = getByTestId("eye-icon-off");
    fireEvent.press(hideIcon);

    expect(passwordInput.props.secureTextEntry).toBe(true);
  });
});

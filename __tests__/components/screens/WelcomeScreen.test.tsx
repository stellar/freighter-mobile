import { fireEvent } from "@testing-library/react-native";
import { WelcomeScreen } from "components/screens/WelcomeScreen";
import { AUTH_STACK_ROUTES } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock useNavigation hook
const mockNavigate = jest.fn();
const mockPush = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    push: mockPush,
  })),
}));

describe("WelcomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText } = renderWithProviders(
      <WelcomeScreen navigation={{ push: mockPush } as never} />,
    );
    expect(getByText("Freighter Wallet")).toBeTruthy();
  });

  it("navigates to choose password screen when create new wallet button is pressed", () => {
    const { getByText } = renderWithProviders(
      <WelcomeScreen navigation={{ push: mockPush } as never} />,
    );

    const createWalletButton = getByText("Create a new wallet");

    fireEvent.press(createWalletButton);

    expect(mockPush).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN,
      { isImporting: false },
    );
  });

  it("navigates to import wallet screen when I already have wallet button is pressed", () => {
    const { getByText } = renderWithProviders(
      <WelcomeScreen navigation={{ push: mockPush } as never} />,
    );

    const importWalletButton = getByText("I already have a wallet");

    fireEvent.press(importWalletButton);

    expect(mockPush).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN,
      { isImporting: true },
    );
  });
});

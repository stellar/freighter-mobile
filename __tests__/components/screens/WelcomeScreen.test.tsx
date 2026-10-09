import { fireEvent, within } from "@testing-library/react-native";
import { WelcomeScreen } from "components/screens/WelcomeScreen";
import { FREIGHTER_PRIVACY_URL, FREIGHTER_TERMS_URL } from "config/constants";
import { AUTH_STACK_ROUTES } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { StyleSheet } from "react-native";

const mockPush = jest.fn();

const mockOpenInAppBrowser = jest.fn();
jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({
    open: mockOpenInAppBrowser,
    isAvailable: jest.fn(() => Promise.resolve(true)),
  }),
}));

const renderWelcomeScreen = () =>
  renderWithProviders(
    <WelcomeScreen navigation={{ push: mockPush } as never} />,
  );

describe("WelcomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("greets with Welcome and tells the user Freighter is now Varial", () => {
    const { getByTestId } = renderWelcomeScreen();
    const screen = getByTestId("welcome-screen");

    expect(within(screen).getByText("Welcome")).toBeTruthy();
    expect(within(screen).getByText("Freighter is now Varial")).toBeTruthy();
  });

  it("sets its heading in Funnel Sans with the Varial tracking", () => {
    const { getByText } = renderWelcomeScreen();

    expect(StyleSheet.flatten(getByText("Welcome").props.style)).toMatchObject({
      fontFamily: "FunnelSans-Medium",
      letterSpacing: -1.28,
    });
  });

  it("starts creating a wallet from the Create a new wallet button", () => {
    const { getByTestId } = renderWelcomeScreen();
    const createWalletButton = getByTestId("create-wallet-button");

    expect(
      within(createWalletButton).getByText("Create a new wallet"),
    ).toBeTruthy();
    fireEvent.press(createWalletButton);

    expect(mockPush).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN,
      { isImporting: false },
    );
  });

  it("starts importing a wallet from the Import wallet button", () => {
    const { getByTestId } = renderWelcomeScreen();
    const importWalletButton = getByTestId("import-wallet-button");

    expect(within(importWalletButton).getByText("Import wallet")).toBeTruthy();
    fireEvent.press(importWalletButton);

    expect(mockPush).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN,
      { isImporting: true },
    );
  });

  it("reads the terms line as one sentence", () => {
    const { getByText } = renderWelcomeScreen();

    expect(
      getByText("By continuing, you agree to the Terms and Privacy Policy."),
    ).toBeTruthy();
  });

  it("underlines the Terms and Privacy Policy links", () => {
    const { getByText } = renderWelcomeScreen();

    ["Terms", "Privacy Policy"].forEach((link) => {
      expect(StyleSheet.flatten(getByText(link).props.style)).toMatchObject({
        textDecorationLine: "underline",
      });
    });
  });

  it("opens the Terms and the Privacy Policy in the in-app browser", () => {
    const { getByText } = renderWelcomeScreen();

    fireEvent.press(getByText("Terms"));
    expect(mockOpenInAppBrowser).toHaveBeenLastCalledWith(FREIGHTER_TERMS_URL);

    fireEvent.press(getByText("Privacy Policy"));
    expect(mockOpenInAppBrowser).toHaveBeenLastCalledWith(
      FREIGHTER_PRIVACY_URL,
    );
    expect(mockOpenInAppBrowser).toHaveBeenCalledTimes(2);
  });
});

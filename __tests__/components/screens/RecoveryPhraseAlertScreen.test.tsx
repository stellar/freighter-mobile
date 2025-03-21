import { fireEvent } from "@testing-library/react-native";
import { RecoveryPhraseAlertScreen } from "components/screens/RecoveryPhraseAlertScreen";
import { AUTH_STACK_ROUTES } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const mockNavigate = jest.fn();

describe("RecoveryPhraseAlertScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText, getByTestId } = renderWithProviders(
      <RecoveryPhraseAlertScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { password: "password" } } as never}
      />,
    );

    expect(getByText("Recovery Phrase")).toBeTruthy();
    expect(getByTestId("recovery-phrase-warning-box")).toBeTruthy();
  });

  it("navigates to recovery phrase screen when continue button is pressed", () => {
    const { getByText } = renderWithProviders(
      <RecoveryPhraseAlertScreen
        navigation={{ navigate: mockNavigate } as never}
        route={{ params: { password: "password" } } as never}
      />,
    );

    const continueButton = getByText("I understand, reveal my phrase");

    fireEvent.press(continueButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN,
      { password: "password" },
    );
  });
});

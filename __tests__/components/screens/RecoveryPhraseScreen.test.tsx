import Clipboard from "@react-native-clipboard/clipboard";
import { fireEvent } from "@testing-library/react-native";
import { RecoveryPhraseScreen } from "components/screens/RecoveryPhraseScreen";
import { AUTH_STACK_ROUTES } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const mockNavigate = jest.fn();

describe("RecoveryPhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText } = renderWithProviders(
      <RecoveryPhraseScreen navigation={{ navigate: mockNavigate } as never} />,
    );

    // Check for title (from the OnboardLayout component)
    expect(getByText("Your Recovery Phrase")).toBeTruthy();

    // Check for warning text
    expect(
      getByText("This is for your eyes only. Never share this."),
    ).toBeTruthy();

    // Check that the fake recovery phrase is rendered
    expect(
      getByText(
        "gloom student label strategy tattoo promote brand mushroom problem divert carbon erode",
      ),
    ).toBeTruthy();

    // Check for the copy button text
    expect(getByText("Copy to clipboard")).toBeTruthy();

    // Check for the continue button text
    expect(getByText("Continue")).toBeTruthy();
  });

  it("navigates when the continue button is pressed", () => {
    const { getByText } = renderWithProviders(
      <RecoveryPhraseScreen navigation={{ navigate: mockNavigate } as never} />,
    );

    const continueButton = getByText("Continue");
    fireEvent.press(continueButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN,
    );
  });

  it("copies the recovery phrase to clipboard when the copy button is pressed", () => {
    const { getByText } = renderWithProviders(
      <RecoveryPhraseScreen navigation={{ navigate: mockNavigate } as never} />,
    );

    const copyButton = getByText("Copy to clipboard");
    fireEvent.press(copyButton);

    const spy = jest.spyOn(Clipboard, "setString");

    expect(spy).toHaveBeenCalledWith(
      "gloom student label strategy tattoo promote brand mushroom problem divert carbon erode",
    );
  });
});

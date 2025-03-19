import Clipboard from "@react-native-clipboard/clipboard";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { ImportWalletScreen } from "components/screens/ImportWalletScreen";
import { AUTH_STACK_ROUTES } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("ImportWalletScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <ImportWalletScreen
        navigation={{ replace: jest.fn() } as never}
        route={{} as never}
      />,
    );

    expect(getByPlaceholderText("Enter recovery phrase")).toBeTruthy();
    expect(getByText("Import Wallet")).toBeTruthy();
  });

  it("does not navigate when recoveryPhrase is empty", () => {
    const mockReplace = jest.fn();
    const { getByText } = renderWithProviders(
      <ImportWalletScreen
        navigation={{ replace: jest.fn() } as never}
        route={{} as never}
      />,
    );

    const continueButton = getByText("Import wallet");
    fireEvent.press(continueButton);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("navigates when recoveryPhrase is entered", () => {
    const mockReplace = jest.fn();
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <ImportWalletScreen
        navigation={{ replace: mockReplace } as never}
        route={{} as never}
      />,
    );

    const textarea = getByPlaceholderText("Enter recovery phrase");
    fireEvent.changeText(textarea, "sample recovery phrase");

    const continueButton = getByText("Import wallet");
    fireEvent.press(continueButton);

    expect(mockReplace).toHaveBeenCalledWith(AUTH_STACK_ROUTES.WELCOME_SCREEN);
  });

  it("updates the recovery phrase when pasting from clipboard", async () => {
    (Clipboard.getString as jest.Mock).mockResolvedValue(
      "clipboard recovery phrase",
    );
    const { getByTestId, getByDisplayValue } = renderWithProviders(
      <ImportWalletScreen
        navigation={{ replace: jest.fn() } as never}
        route={{} as never}
      />,
    );

    const clipboardButton = getByTestId("clipboard-button");
    fireEvent.press(clipboardButton);

    await waitFor(() => {
      expect(getByDisplayValue("clipboard recovery phrase")).toBeTruthy();
    });
  });
});

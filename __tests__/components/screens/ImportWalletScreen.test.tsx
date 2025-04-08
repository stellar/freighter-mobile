import Clipboard from "@react-native-clipboard/clipboard";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { ImportWalletScreen } from "components/screens/ImportWalletScreen";
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
        route={{ params: { password: "password" } } as never}
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
        route={{ params: { password: "password" } } as never}
      />,
    );

    const continueButton = getByText("Import wallet");
    fireEvent.press(continueButton);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("updates the recovery phrase when pasting from clipboard", async () => {
    (Clipboard.getString as jest.Mock).mockResolvedValue(
      "clipboard recovery phrase",
    );
    const { getByTestId, getByDisplayValue } = renderWithProviders(
      <ImportWalletScreen
        navigation={{ replace: jest.fn() } as never}
        route={{ params: { password: "password" } } as never}
      />,
    );

    const clipboardButton = getByTestId("clipboard-button");
    fireEvent.press(clipboardButton);

    await waitFor(
      () => {
        expect(getByDisplayValue("clipboard recovery phrase")).toBeTruthy();
      },
      { timeout: 10000 },
    );
  });
});

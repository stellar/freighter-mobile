import { act, fireEvent } from "@testing-library/react-native";
import ImportRecoveryPhraseScreen from "components/screens/ImportRecoveryPhraseScreen";
import { MANAGE_WALLETS_ROUTES } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const mockHoldPendingRecoveryPhrase = jest.fn();
const mockClearPendingRecoveryPhrase = jest.fn();
jest.mock("ducks/auth", () => ({
  // The providers read the store; the screen itself doesn't.
  useAuthenticationStore: () => ({}),
  holdPendingRecoveryPhrase: (phrase: string) =>
    mockHoldPendingRecoveryPhrase(phrase),
  clearPendingRecoveryPhrase: (id?: string) =>
    mockClearPendingRecoveryPhrase(id),
}));

const VALID_PHRASE = `${"abandon ".repeat(11)}about`;
const mockNavigate = jest.fn();

const renderScreen = () =>
  renderWithProviders(
    <ImportRecoveryPhraseScreen
      navigation={
        {
          navigate: mockNavigate,
          addListener: jest.fn(() => jest.fn()),
        } as never
      }
      route={{} as never}
    />,
  );

const typeAndSubmit = async (
  screen: ReturnType<typeof renderScreen>,
  phrase: string,
) => {
  fireEvent.changeText(
    screen.getByTestId("import-recovery-phrase-input"),
    phrase,
  );
  fireEvent.press(screen.getByTestId("default-action-button"));
  // The keyboard dismissal the screen waits on.
  await act(async () => {});
};

describe("ImportRecoveryPhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHoldPendingRecoveryPhrase.mockReturnValue("pending-phrase-7");
  });

  it("asks for the phrase with Paste inside the field", () => {
    const { getByText, getByPlaceholderText, getByTestId } = renderScreen();

    expect(getByText("Import Recovery Phrase")).toBeTruthy();
    expect(
      getByText("Add a wallet with its 12 or 24-word recovery phrase"),
    ).toBeTruthy();
    expect(getByPlaceholderText("Enter your recovery phrase")).toBeTruthy();
    expect(getByTestId("clipboard-button")).toBeTruthy();
  });

  it("holds the phrase and passes only the hold's id to the password step", async () => {
    const screen = renderScreen();

    await typeAndSubmit(screen, `  ${VALID_PHRASE.toUpperCase()} `);

    expect(mockHoldPendingRecoveryPhrase).toHaveBeenCalledWith(VALID_PHRASE);
    expect(mockNavigate).toHaveBeenCalledWith(
      MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN,
      { kind: "importPhrase", pendingPhraseId: "pending-phrase-7" },
    );
  });

  it("shows an error under the field for an invalid phrase and holds nothing", async () => {
    const screen = renderScreen();

    await typeAndSubmit(screen, "abandon ".repeat(12).trim());

    expect(
      screen.getByText(
        "Invalid phrase - words must be in the correct order, lowercase, and separated by spaces",
      ),
    ).toBeTruthy();
    expect(mockHoldPendingRecoveryPhrase).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("clears the error once the phrase is edited", async () => {
    const screen = renderScreen();
    await typeAndSubmit(screen, "abandon");

    fireEvent.changeText(
      screen.getByTestId("import-recovery-phrase-input"),
      "abandon ability",
    );

    expect(
      screen.queryByText(
        "Invalid phrase - words must be in the correct order, lowercase, and separated by spaces",
      ),
    ).toBeNull();
  });

  it("drops its hold when the screen goes away", async () => {
    const screen = renderScreen();
    await typeAndSubmit(screen, VALID_PHRASE);

    screen.unmount();

    expect(mockClearPendingRecoveryPhrase).toHaveBeenCalledWith(
      "pending-phrase-7",
    );
  });

  it("drops nothing on leaving when no phrase was held", () => {
    renderScreen().unmount();

    expect(mockClearPendingRecoveryPhrase).not.toHaveBeenCalled();
  });
});

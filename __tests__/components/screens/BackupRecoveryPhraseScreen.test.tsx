import { fireEvent } from "@testing-library/react-native";
import BackupRecoveryPhraseScreen from "components/screens/BackupRecoveryPhraseScreen";
import { MANAGE_WALLETS_ROUTES } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const PHRASE =
  "gloom student label strategy tattoo promote brand mushroom problem divert carbon erode";
const WORDS = PHRASE.split(" ");

jest.mock("@react-native-community/blur", () => ({ BlurView: "BlurView" }));

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useSecureClipboard", () => ({
  useSecureClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}));

const PENDING_ID = "pending-phrase-7";

let mockPendingPhrase: string | null = PHRASE;
const mockGetPending = jest.fn();
const mockClearPending = jest.fn();
jest.mock("ducks/auth", () => ({
  getPendingRecoveryPhrase: (id: string) => {
    mockGetPending(id);
    return mockPendingPhrase;
  },
  clearPendingRecoveryPhrase: (id?: string) => mockClearPending(id),
  // CopyPhraseButton's module (the onboarding screen) reads the store.
  useAuthenticationStore: (
    selector: (state: { isLoading: boolean }) => unknown,
  ) => selector({ isLoading: false }),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const renderScreen = () =>
  renderWithProviders(
    <BackupRecoveryPhraseScreen
      navigation={navigation as never}
      route={
        {
          params: { pendingPhraseId: PENDING_ID, accountName: "Travel" },
        } as never
      }
    />,
  );

describe("BackupRecoveryPhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPendingPhrase = PHRASE;
  });

  it("keeps the held phrase off the screen until the user reveals it", () => {
    const { getByText, queryByText } = renderScreen();

    expect(mockGetPending).toHaveBeenCalledWith(PENDING_ID);
    expect(getByText("Back Up Your New Recovery Phrase")).toBeTruthy();
    WORDS.forEach((word) => expect(queryByText(word)).toBeNull());
  });

  it("reveals the phrase, copies it securely, and goes on to the password step", () => {
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId("backup-recovery-phrase-reveal"));
    WORDS.forEach((word) => expect(getByText(word)).toBeTruthy());

    fireEvent.press(getByTestId("copy-recovery-phrase-button"));
    expect(mockCopyToClipboard).toHaveBeenCalledWith(PHRASE, {
      hideNotification: true,
    });

    fireEvent.press(getByText("Create"));
    // The phrase stays in the store, out of the params.
    expect(navigation.navigate).toHaveBeenCalledWith(
      MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN,
      { kind: "newPhrase", pendingPhraseId: PENDING_ID, accountName: "Travel" },
    );
  });

  it("drops its own generation when the screen goes away", () => {
    const { unmount } = renderScreen();

    unmount();

    expect(mockClearPending).toHaveBeenCalledTimes(1);
    expect(mockClearPending).toHaveBeenCalledWith(PENDING_ID);
  });

  it("goes back when its generation is no longer held", () => {
    mockPendingPhrase = null;
    renderScreen();

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

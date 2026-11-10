import { fireEvent, waitFor } from "@testing-library/react-native";
import VerifyPasswordScreen from "components/screens/VerifyPasswordScreen";
import { CreateWalletTarget, ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const mockCreateAccount = jest.fn();
const mockAddRecoveryPhraseSource = jest.fn();
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    createAccount: mockCreateAccount,
    addRecoveryPhraseSource: mockAddRecoveryPhraseSource,
    isCreatingAccount: false,
    error: null,
    clearError: jest.fn(),
  }),
  getActiveAccountPublicKey: jest.fn().mockResolvedValue("GA"),
}));

// The template's own behavior (biometrics, the field) is covered elsewhere;
// here it only hands the password to the screen.
jest.mock("components/templates/InputPasswordTemplate", () => {
  const { TouchableOpacity } = jest.requireActual("react-native");
  return ({
    handleContinue,
  }: {
    handleContinue: (password: string) => void;
  }) => (
    <TouchableOpacity
      testID="continue"
      onPress={() => handleContinue("hunter2")}
    />
  );
});

const navigation = { reset: jest.fn() };

const renderScreen = (params: CreateWalletTarget) =>
  renderWithProviders(
    <VerifyPasswordScreen
      navigation={navigation as never}
      route={{ params } as never}
    />,
  );

describe("VerifyPasswordScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAccount.mockResolvedValue(undefined);
    mockAddRecoveryPhraseSource.mockResolvedValue(undefined);
  });

  it("adds a named account under the chosen phrase", async () => {
    const { getByTestId } = renderScreen({
      kind: "existingPhrase",
      sourceId: "phrase-2",
      accountName: "Savings",
    });

    fireEvent.press(getByTestId("continue"));

    expect(mockCreateAccount).toHaveBeenCalledWith(
      "hunter2",
      "phrase-2",
      "Savings",
    );
    expect(mockAddRecoveryPhraseSource).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK }],
      }),
    );
  });

  it("stores the new phrase with its named first account", async () => {
    const { getByTestId } = renderScreen({
      kind: "newPhrase",
      pendingPhraseId: "pending-phrase-1",
      accountName: "Travel",
    });

    fireEvent.press(getByTestId("continue"));

    expect(mockAddRecoveryPhraseSource).toHaveBeenCalledWith(
      "hunter2",
      "pending-phrase-1",
      "Travel",
    );
    expect(mockCreateAccount).not.toHaveBeenCalled();
    await waitFor(() => expect(navigation.reset).toHaveBeenCalled());
  });

  it("stays on the screen when the create fails", async () => {
    mockAddRecoveryPhraseSource.mockRejectedValue(new Error("nope"));
    const { getByTestId } = renderScreen({
      kind: "newPhrase",
      pendingPhraseId: "pending-phrase-1",
      accountName: "Travel",
    });

    fireEvent.press(getByTestId("continue"));

    await waitFor(() => expect(mockAddRecoveryPhraseSource).toHaveBeenCalled());
    expect(navigation.reset).not.toHaveBeenCalled();
  });
});

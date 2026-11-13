import { act, fireEvent } from "@testing-library/react-native";
import { FOCUS_RING_WIDTH } from "components/FocusRing";
import ShowRecoveryPhraseScreen from "components/screens/SettingsScreen/SecurityScreen/ShowRecoveryPhraseScreen/ShowRecoveryPhraseScreen";
import { SecretSourceType } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { StyleSheet } from "react-native";
import { getSecretSources } from "services/auth/secretSources";

jest.mock("services/auth/secretSources", () => ({
  getSecretSources: jest.fn(() => Promise.resolve({})),
}));

jest.mock("components/sds/BiometricToggleButton", () => ({
  BiometricToggleButton: () => null,
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    getKeyFromKeyManager: jest.fn(),
    signInMethod: "password",
  }),
}));

const mockGoBack = jest.fn();
const renderScreen = () =>
  renderWithProviders(
    <ShowRecoveryPhraseScreen
      navigation={{ navigate: jest.fn(), goBack: mockGoBack } as never}
      route={{} as never}
    />,
  );

describe("ShowRecoveryPhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("asks for the password in the shared field, with its label and eye", () => {
    const { getByText, getByTestId, getByLabelText } = renderScreen();

    expect(getByText("Password")).toBeTruthy();
    expect(getByTestId("password-input").props.secureTextEntry).toBe(true);

    fireEvent.press(getByLabelText("Show password"));

    expect(getByTestId("password-input").props.secureTextEntry).toBe(false);
  });

  // The scroll view clips what it holds, and the page's padding is outside
  // it, so it makes room for the ring itself without moving the content.
  it("leaves the password field room for its focus ring at the sides", () => {
    const { getByTestId } = renderScreen();
    const scroll = getByTestId("show-recovery-phrase-scroll");

    expect(StyleSheet.flatten(scroll.props.style).marginHorizontal).toBe(
      -FOCUS_RING_WIDTH,
    );
    expect(
      StyleSheet.flatten(scroll.props.contentContainerStyle).paddingHorizontal,
    ).toBe(FOCUS_RING_WIDTH);
  });

  // Security hides the way here for a wallet onboarded from a secret key.
  it("goes back for a wallet holding only secret keys", async () => {
    (getSecretSources as jest.Mock).mockResolvedValueOnce({
      key: {
        id: "key",
        type: SecretSourceType.SECRET_KEY,
        label: "Secret Key 1",
        createdAt: 1,
      },
    });
    renderScreen();
    await act(async () => {});

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("stays for a wallet with a phrase", async () => {
    (getSecretSources as jest.Mock).mockResolvedValueOnce({
      phrase: {
        id: "phrase",
        type: SecretSourceType.PHRASE,
        label: "Seed Phrase 1",
        createdAt: 1,
      },
    });
    renderScreen();
    await act(async () => {});

    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

import { fireEvent } from "@testing-library/react-native";
import { FOCUS_RING_WIDTH } from "components/FocusRing";
import ShowRecoveryPhraseScreen from "components/screens/SettingsScreen/SecurityScreen/ShowRecoveryPhraseScreen/ShowRecoveryPhraseScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { StyleSheet } from "react-native";

jest.mock("components/sds/BiometricToggleButton", () => ({
  BiometricToggleButton: () => null,
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    getKeyFromKeyManager: jest.fn(),
    signInMethod: "password",
  }),
}));

const renderScreen = () =>
  renderWithProviders(
    <ShowRecoveryPhraseScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );

describe("ShowRecoveryPhraseScreen", () => {
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
});

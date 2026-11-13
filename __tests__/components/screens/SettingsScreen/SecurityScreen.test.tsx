import { act, fireEvent } from "@testing-library/react-native";
import SecurityScreen from "components/screens/SettingsScreen/SecurityScreen/SecurityScreen";
import { SETTINGS_ROUTES } from "config/routes";
import { SecretSourceMap, SecretSourceType } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { getSecretSources } from "services/auth/secretSources";

jest.mock("@react-navigation/native", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    ...jest.requireActual("@react-navigation/native"),
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

jest.mock("hooks/useBiometrics", () => ({
  useBiometrics: () => ({ biometryType: null }),
}));

jest.mock("services/auth/secretSources", () => ({
  getSecretSources: jest.fn(),
}));

const sources = (...types: SecretSourceType[]): SecretSourceMap =>
  Object.fromEntries(
    types.map((type, index) => [
      `source-${index}`,
      { id: `source-${index}`, type, label: `Source ${index}`, createdAt: 1 },
    ]),
  );

const mockNavigate = jest.fn();
const renderScreen = async () => {
  const screen = renderWithProviders(
    <SecurityScreen
      navigation={{ navigate: mockNavigate } as never}
      route={{} as never}
    />,
  );
  // Lets the sources read settle.
  await act(async () => {});
  return screen;
};

describe("SecurityScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("offers Show recovery phrase for a wallet with a phrase", async () => {
    (getSecretSources as jest.Mock).mockResolvedValue(
      sources(SecretSourceType.PHRASE, SecretSourceType.SECRET_KEY),
    );
    const { getByTestId } = await renderScreen();

    fireEvent.press(getByTestId("show-recovery-phrase-button"));

    expect(mockNavigate).toHaveBeenCalledWith(
      SETTINGS_ROUTES.SHOW_RECOVERY_PHRASE_SCREEN,
    );
  });

  it("hides Show recovery phrase for a wallet holding only secret keys", async () => {
    (getSecretSources as jest.Mock).mockResolvedValue(
      sources(SecretSourceType.SECRET_KEY),
    );
    const { queryByTestId, getByTestId } = await renderScreen();

    expect(queryByTestId("show-recovery-phrase-button")).toBeNull();
    expect(getByTestId("auto-lock-button")).toBeTruthy();
  });

  it("keeps Show recovery phrase when the sources can't be read", async () => {
    (getSecretSources as jest.Mock).mockRejectedValue(new Error("boom"));
    const { getByTestId } = await renderScreen();

    expect(getByTestId("show-recovery-phrase-button")).toBeTruthy();
  });
});

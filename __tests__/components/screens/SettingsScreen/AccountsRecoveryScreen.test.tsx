import { fireEvent, waitFor, within } from "@testing-library/react-native";
import AccountsRecoveryScreen from "components/screens/SettingsScreen/AccountsRecoveryScreen";
import { SETTINGS_ROUTES } from "config/routes";
import { Account } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("@react-navigation/native", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    ...jest.requireActual("@react-navigation/native"),
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

jest.mock("services/auth/secretSources", () => ({
  getSecretSources: jest.fn().mockResolvedValue({
    "key-1": {
      id: "key-1",
      type: "secret_key",
      label: "Secret Key 1",
      createdAt: 2,
    },
    "phrase-1": {
      id: "phrase-1",
      type: "phrase",
      label: "Seed Phrase 1",
      createdAt: 1,
    },
  }),
}));

const accounts: Account[] = [
  { id: "a", sourceId: "phrase-1", name: "Account 1", publicKey: "GA" },
  { id: "b", sourceId: "key-1", name: "Imported", publicKey: "GB" },
  { id: "c", sourceId: "phrase-1", name: "Account 2", publicKey: "GC" },
];

const mockGetAllAccounts = jest.fn();
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    allAccounts: accounts,
    getAllAccounts: mockGetAllAccounts,
    network: "PUBLIC",
  }),
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: { id: "c", publicKey: "GC" } }),
}));

const mockFetchTotals = jest.fn();
jest.mock("ducks/accountsFiatTotals", () => ({
  useAccountsFiatTotalsStore: (
    selector: (state: Record<string, unknown>) => unknown,
  ) =>
    selector({
      fiatTotals: { GA: { label: "$10.00", hasError: false } },
      isLoading: false,
      fetchAccountsFiatTotals: mockFetchTotals,
    }),
}));

const navigation = { navigate: jest.fn() };

const renderScreen = () =>
  renderWithProviders(
    <AccountsRecoveryScreen
      navigation={navigation as never}
      route={{} as never}
    />,
  );

describe("AccountsRecoveryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("groups accounts under their phrase, then their key", async () => {
    const screen = renderScreen();

    await waitFor(() =>
      expect(screen.getAllByTestId("accounts-recovery-group")).toHaveLength(2),
    );
    const [phraseGroup, keyGroup] = screen.getAllByTestId(
      "accounts-recovery-group",
    );

    expect(within(phraseGroup).getByText("Recovery phrase 1")).toBeTruthy();
    expect(within(phraseGroup).getByText("Account 1")).toBeTruthy();
    expect(within(phraseGroup).getByText("Account 2")).toBeTruthy();
    expect(within(keyGroup).getByText("Secret key 1")).toBeTruthy();
    expect(within(keyGroup).getByText("Imported")).toBeTruthy();
  });

  it("shows totals and marks the active account", async () => {
    const screen = renderScreen();

    await waitFor(() => expect(screen.getByText("$10.00")).toBeTruthy());
    expect(
      screen.getAllByTestId("accounts-recovery-selected-badge"),
    ).toHaveLength(1);
    expect(mockFetchTotals).toHaveBeenCalledWith({
      publicKeys: ["GA", "GB", "GC"],
      network: "PUBLIC",
      excludePublicKey: "GC",
    });
  });

  it("opens Edit account for a row", async () => {
    const screen = renderScreen();

    await waitFor(() =>
      expect(screen.getAllByTestId("accounts-recovery-group")).toHaveLength(2),
    );
    fireEvent.press(screen.getByLabelText("Edit Imported"));

    expect(navigation.navigate).toHaveBeenCalledWith(
      SETTINGS_ROUTES.EDIT_ACCOUNT_SCREEN,
      { accountId: "b" },
    );
  });
});

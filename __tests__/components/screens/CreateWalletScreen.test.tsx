import { fireEvent, waitFor, within } from "@testing-library/react-native";
import CreateWalletScreen from "components/screens/CreateWalletScreen";
import { MANAGE_WALLETS_ROUTES } from "config/routes";
import { Account } from "config/types";
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

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
jest.mock("components/BottomSheet", () => {
  const { useImperativeHandle } = jest.requireActual("react");
  return ({
    modalRef,
    customContent,
  }: {
    modalRef: React.Ref<unknown>;
    customContent: React.ReactNode;
  }) => {
    useImperativeHandle(modalRef, () => ({
      present: mockPresent,
      dismiss: mockDismiss,
    }));
    return customContent;
  };
});

// The real field needs a live bottom sheet when isBottomSheetInput is set.
jest.mock("components/sds/Input", () => {
  const { TextInput } = jest.requireActual("react-native");
  return {
    Input: ({
      value,
      onChangeText,
      testID,
    }: {
      value: string;
      onChangeText: (text: string) => void;
      testID?: string;
    }) => (
      <TextInput value={value} onChangeText={onChangeText} testID={testID} />
    ),
  };
});

jest.mock("services/auth/secretSources", () => ({
  getSecretSources: jest.fn(),
}));

const phraseSources = {
  "phrase-1": {
    id: "phrase-1",
    type: "phrase",
    label: "Seed Phrase 1",
    createdAt: 1,
  },
  "phrase-2": {
    id: "phrase-2",
    type: "phrase",
    label: "Seed Phrase 2",
    createdAt: 3,
  },
  "key-1": {
    id: "key-1",
    type: "secret_key",
    label: "Secret Key 1",
    createdAt: 2,
  },
};

const accounts: Account[] = [
  { id: "a", sourceId: "phrase-1", name: "Account 1", publicKey: "GA" },
  { id: "b", sourceId: "key-1", name: "Imported", publicKey: "GB" },
  { id: "c", sourceId: "phrase-2", name: "Account 2", publicKey: "GC" },
];

const mockGeneratePhrase = jest.fn();
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    allAccounts: accounts,
    getAllAccounts: jest.fn(),
    network: "PUBLIC",
  }),
  generatePendingRecoveryPhrase: () => mockGeneratePhrase(),
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: { id: "a", publicKey: "GA" } }),
}));

jest.mock("ducks/accountsFiatTotals", () => ({
  useAccountsFiatTotalsStore: (
    selector: (state: Record<string, unknown>) => unknown,
  ) =>
    selector({
      fiatTotals: {},
      isLoading: false,
      fetchAccountsFiatTotals: jest.fn(),
    }),
}));

const navigation = { navigate: jest.fn() };

const renderScreen = () =>
  renderWithProviders(
    <CreateWalletScreen navigation={navigation as never} route={{} as never} />,
  );

describe("CreateWalletScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSecretSources as jest.Mock).mockResolvedValue(phraseSources);
  });

  it("lists each phrase with its accounts, and leaves out imported keys", async () => {
    const { findAllByTestId, queryByText } = renderScreen();

    const groups = await findAllByTestId("create-wallet-group");
    expect(groups).toHaveLength(2);
    expect(within(groups[0]).getByText("Recovery phrase 1")).toBeTruthy();
    expect(within(groups[0]).getByText("Account 1")).toBeTruthy();
    expect(within(groups[1]).getByText("Recovery phrase 2")).toBeTruthy();
    expect(within(groups[1]).getByText("Account 2")).toBeTruthy();
    expect(queryByText("Imported")).toBeNull();
  });

  it("offers only a new phrase in a wallet with none", async () => {
    (getSecretSources as jest.Mock).mockResolvedValue({
      "key-1": phraseSources["key-1"],
    });
    const { findByTestId, queryAllByTestId } = renderScreen();

    expect(await findByTestId("create-wallet-generate")).toBeTruthy();
    expect(queryAllByTestId("create-wallet-group")).toHaveLength(0);
  });

  it("holds the list back until the sources are read", () => {
    (getSecretSources as jest.Mock).mockReturnValue(new Promise(() => {}));
    const { queryByTestId } = renderScreen();

    expect(queryByTestId("create-wallet")).toBeNull();
  });

  it("names the account, then asks for the password to add it to that phrase", async () => {
    const { findAllByTestId, getByTestId } = renderScreen();

    const [, addToSecond] = await findAllByTestId("create-wallet-add-account");
    fireEvent.press(addToSecond);
    expect(mockPresent).toHaveBeenCalledTimes(1);

    // Prefilled with the next free default name; the i18n mock in tests
    // resolves "authStore.account" to "Account {{number}}".
    expect(getByTestId("set-account-name-input").props.value).toBe("Account 4");
    fireEvent.changeText(getByTestId("set-account-name-input"), " Savings ");
    fireEvent.press(getByTestId("set-account-name-submit"));

    expect(mockDismiss).toHaveBeenCalled();
    expect(mockGeneratePhrase).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith(
      MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN,
      { kind: "existingPhrase", sourceId: "phrase-2", accountName: "Savings" },
    );
  });

  it("generates a phrase and goes to its backup for a new phrase", async () => {
    mockGeneratePhrase.mockReturnValue("pending-phrase-3");
    const { findByTestId, getByTestId, getByText } = renderScreen();

    fireEvent.press(await findByTestId("create-wallet-generate"));
    expect(getByText("Next")).toBeTruthy();
    fireEvent.press(getByTestId("set-account-name-submit"));

    await waitFor(() => expect(mockGeneratePhrase).toHaveBeenCalledTimes(1));
    expect(navigation.navigate).toHaveBeenCalledWith(
      MANAGE_WALLETS_ROUTES.BACKUP_RECOVERY_PHRASE_SCREEN,
      { pendingPhraseId: "pending-phrase-3", accountName: "Account 4" },
    );
  });
});

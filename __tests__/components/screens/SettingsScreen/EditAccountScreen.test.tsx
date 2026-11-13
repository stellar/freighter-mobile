import { fireEvent, waitFor } from "@testing-library/react-native";
import EditAccountScreen from "components/screens/SettingsScreen/EditAccountScreen";
import { NETWORKS } from "config/constants";
import { SETTINGS_ROUTES } from "config/routes";
import { Account } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("services/analytics", () => ({
  analytics: { track: jest.fn(), trackViewPublicKeyAccountRenamed: jest.fn() },
}));

const mockOpenInAppBrowser = jest.fn().mockResolvedValue(undefined);
jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({ open: mockOpenInAppBrowser }),
}));

const mockPresent = jest.fn();
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
      dismiss: jest.fn(),
    }));
    return customContent;
  };
});

jest.mock("components/screens/HomeScreen/RenameAccountForm", () => {
  const { Text } = jest.requireActual("react-native");
  return ({ isBottomSheetInput }: { isBottomSheetInput?: boolean }) => (
    <Text testID="rename-form">{String(isBottomSheetInput)}</Text>
  );
});

jest.mock("services/auth/secretSources", () => ({
  getSecretSources: jest.fn().mockResolvedValue({
    "phrase-1": {
      id: "phrase-1",
      type: "phrase",
      label: "Seed Phrase 1",
      createdAt: 1,
    },
    "key-1": {
      id: "key-1",
      type: "secret_key",
      label: "Secret Key 1",
      createdAt: 2,
    },
  }),
}));

const mockDerived: Account = {
  id: "derived-id",
  sourceId: "phrase-1",
  name: "Account 1",
  publicKey: "GDERIVED",
};
const mockImported: Account = {
  id: "imported-id",
  sourceId: "key-1",
  name: "Imported",
  publicKey: "GIMPORTED",
  importedFromSecretKey: true,
};

let mockNetwork = NETWORKS.PUBLIC;
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    allAccounts: [mockDerived, mockImported],
    network: mockNetwork,
    renameAccount: jest.fn(),
    isRenamingAccount: false,
  }),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const renderScreen = (accountId: string) =>
  renderWithProviders(
    <EditAccountScreen
      navigation={navigation as never}
      route={{ params: { accountId } } as never}
    />,
  );

describe("EditAccountScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetwork = NETWORKS.PUBLIC;
  });

  it("offers a phrase-derived account its phrase and its own key", async () => {
    const screen = renderScreen(mockDerived.id);

    await waitFor(() =>
      expect(screen.getByTestId("edit-account-recovery-phrase")).toBeTruthy(),
    );
    expect(screen.getByText("Recovery phrase 1")).toBeTruthy();

    fireEvent.press(screen.getByTestId("edit-account-recovery-phrase"));
    expect(navigation.navigate).toHaveBeenLastCalledWith(
      SETTINGS_ROUTES.REVEAL_SECRET_SCREEN,
      { kind: "recoveryPhrase", sourceId: "phrase-1" },
    );

    fireEvent.press(screen.getByTestId("edit-account-secret-key"));
    expect(navigation.navigate).toHaveBeenLastCalledWith(
      SETTINGS_ROUTES.REVEAL_SECRET_SCREEN,
      { kind: "secretKey", accountId: mockDerived.id },
    );
  });

  it("offers an imported account only its key", async () => {
    const screen = renderScreen(mockImported.id);

    await waitFor(() =>
      expect(screen.getByTestId("edit-account-secret-key")).toBeTruthy(),
    );
    expect(screen.queryByTestId("edit-account-recovery-phrase")).toBeNull();
  });

  it("opens the rename sheet from the account name", () => {
    const screen = renderScreen(mockDerived.id);

    expect(screen.getByText("Account 1")).toBeTruthy();
    fireEvent.press(screen.getByTestId("edit-account-name"));

    expect(mockPresent).toHaveBeenCalledTimes(1);
    // The form sits in a bottom sheet, so its field uses the sheet's input.
    expect(screen.getByTestId("rename-form").props.children).toBe("true");
  });

  it("links the account on stellar.expert for the current network", () => {
    mockNetwork = NETWORKS.TESTNET;
    const screen = renderScreen(mockDerived.id);

    fireEvent.press(screen.getByTestId("edit-account-explorer"));

    expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
      expect.stringMatching(/\/testnet\/account\/GDERIVED$/),
    );
  });

  it("hides the explorer link on futurenet", () => {
    mockNetwork = NETWORKS.FUTURENET;
    const screen = renderScreen(mockDerived.id);

    expect(screen.queryByTestId("edit-account-explorer")).toBeNull();
  });

  it("goes back when the account is gone", () => {
    renderScreen("missing-id");

    expect(navigation.goBack).toHaveBeenCalled();
  });
});

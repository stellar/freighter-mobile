import { NavigationContainer, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { SendSearchContacts } from "components/screens/SendScreen";
import {
  RootStackParamList,
  SEND_PAYMENT_ROUTES,
  SendPaymentStackParamList,
} from "config/routes";
import { Account } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import * as sendDuck from "ducks/sendRecipient";
import * as transactionSettingsDuck from "ducks/transactionSettings";
import { isFederationAddress } from "helpers/stellar";
import { renderWithProviders } from "helpers/testUtils";
import React, { ReactNode } from "react";
import { View } from "react-native";

const mockView = View;

jest.mock("react-native-gesture-handler", () => ({
  PanGestureHandler: mockView,
  GestureHandlerRootView: mockView,
  State: {},
  createNativeWrapper: jest.fn((component) => component),
}));

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModalProvider: ({ children }: { children: ReactNode }) => children,
  BottomSheetModal: mockView,
  BottomSheetTextInput: "input",
}));

// Mock stellar helpers
jest.mock("helpers/stellar", () => ({
  isValidStellarAddress: jest.fn().mockReturnValue(true),
  isFederationAddress: jest.fn().mockReturnValue(false),
  truncateAddress: jest.fn(
    (address) => `${address.slice(0, 4)}...${address.slice(-4)}`,
  ),
}));

const mockGetClipboardText = jest.fn().mockResolvedValue("test-address");
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({
    getClipboardText: mockGetClipboardText,
  }),
}));

// Mock useSendStore data
const mockLoadRecentAddresses = jest.fn();
const mockSearchAddress = jest.fn();
const mockAddRecentAddress = jest.fn();
const mockSetDestinationAddress = jest.fn();
const mockPrepareForSearch = jest.fn();
const mockReset = jest.fn();

// Create mock data
const mockRecentAddresses = [
  {
    id: "recent-1",
    address: "GACJYENHYW2LGHBNNGNZ4NCBGZYVTGTZM4CJLQIOQQ5IUZU3SYWOW5EK",
    name: "Recent Contact",
  },
];

// Create mock search results
const mockSearchResults = [
  {
    id: "search-1",
    address: "GBLS3IXAFSUWBSW3RXJMNXEGCHXEUL6VMBLFGVFPW47X2OL7BG7QQMUQ",
    name: "Search Result",
  },
];

// Create a function to get the useSendStore implementation
const getSendStoreMock = (overrides = {}) => {
  const state = {
    recentAddresses: [],
    searchResults: [],
    searchError: null,
    isSearching: false,
    isValidDestination: false,
    isDestinationFunded: null,
    destinationAddress: "",
    federationAddress: "",
    federationMemo: "",
    federationMemoType: "",
    loadRecentAddresses: mockLoadRecentAddresses,
    searchAddress: mockSearchAddress,
    addRecentAddress: mockAddRecentAddress,
    setDestinationAddress: mockSetDestinationAddress,
    prepareForSearch: mockPrepareForSearch,
    resetSendRecipient: mockReset,
    ...overrides,
  };
  const fn = jest.fn().mockReturnValue(state) as jest.Mock & {
    getState: jest.Mock;
  };
  fn.getState = jest.fn().mockReturnValue(state);
  return fn;
};

jest.mock("ducks/sendRecipient", () => ({
  useSendRecipientStore: getSendStoreMock(),
}));

const getTransactionSettingsStoreMock = (overrides = {}) => ({
  saveRecipientAddress: jest.fn(),
  saveFederationAddress: jest.fn(),
  saveRecipientName: jest.fn(),
  saveMemo: jest.fn(),
  saveMemoType: jest.fn(),
  saveSelectedCollectibleDetails: jest.fn(),
  selectedCollectibleDetails: { collectionAddress: "", tokenId: "" },
  selectedTokenId: "",
  ...overrides,
});

jest.mock("ducks/transactionSettings", () => ({
  useTransactionSettingsStore: jest.fn().mockReturnValue({
    saveRecipientAddress: jest.fn(),
    saveFederationAddress: jest.fn(),
    saveRecipientName: jest.fn(),
    saveMemo: jest.fn(),
    saveMemoType: jest.fn(),
    saveSelectedCollectibleDetails: jest.fn(),
    selectedCollectibleDetails: { collectionAddress: "", tokenId: "" },
    selectedTokenId: "",
  }),
}));

jest.mock("ducks/qrData", () => ({
  useQRDataStore: () => ({ clearQRData: jest.fn() }),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(),
}));

jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({ open: jest.fn() }),
}));

// Mock the useRightHeader hook to avoid navigation.setOptions issues
jest.mock("hooks/useRightHeader", () => ({
  useRightHeaderButton: jest.fn(),
}));

type SendSearchContactsNavigationProp = NativeStackNavigationProp<
  RootStackParamList & SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN
>;

type SendSearchContactsRouteProp = RouteProp<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN
>;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  setOptions: mockSetOptions,
  canGoBack: jest.fn(),
  dispatch: jest.fn(),
  getId: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  isFocused: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  push: jest.fn(),
  pop: jest.fn(),
  reset: jest.fn(),
  replace: jest.fn(),
  popToTop: jest.fn(),
  popTo: jest.fn(),
  setParams: jest.fn(),
} as unknown as SendSearchContactsNavigationProp;

const mockRoute = {
  name: SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN,
  key: "test-key",
  params: {},
} as unknown as SendSearchContactsRouteProp;

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "sendPaymentScreen.inputPlaceholder": "Enter address",
      "sendPaymentScreen.recents": "Recent",
      "sendPaymentScreen.suggestions": "Suggestions",
      "common.paste": "Paste",
      "sendSearchContacts.myWallets": "My Wallets",
      "sendSearchContacts.unfunded.title":
        "The destination account doesn't exist",
      "sendSearchContacts.unfunded.action":
        "Send at least 1 XLM to create the account.",
      "sendSearchContacts.unfunded.learnMore": "Learn more",
    };
    return translations[key] || key;
  },
}));

const mockUseAuthenticationStore =
  useAuthenticationStore as jest.MockedFunction<typeof useAuthenticationStore>;

const mockAccounts: Account[] = [
  {
    id: "wallet-1",
    name: "My Second Wallet",
    publicKey: "GBLS3IXAFSUWBSW3RXJMNXEGCHXEUL6VMBLFGVFPW47X2OL7BG7QQMUQ",
  },
  {
    id: "wallet-2",
    name: "Savings",
    publicKey: "GACJYENHYW2LGHBNNGNZ4NCBGZYVTGTZM4CJLQIOQQ5IUZU3SYWOW5EK",
  },
];

const activePublicKey =
  "GDAS7BS4XKW27H2K5C25V6ZU46FCFGBTFQGFDZURAKVPA6QYQG4GTWBC";

describe("SendSearchContacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the default mock implementation for useSendStore
    jest.spyOn(sendDuck, "useSendRecipientStore").mockImplementation(
      getSendStoreMock({
        recentAddresses: mockRecentAddresses,
        loadRecentAddresses: mockLoadRecentAddresses,
      }),
    );
    mockUseAuthenticationStore.mockReturnValue({
      allAccounts: mockAccounts,
      account: { publicKey: activePublicKey } as any,
    } as any);
  });

  it("renders correctly with the search input", async () => {
    renderWithProviders(
      <NavigationContainer>
        <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
      </NavigationContainer>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter address")).toBeTruthy();
    });
  });

  it.skip("navigates to transaction token screen when a contact is pressed", async () => {
    renderWithProviders(
      <SendSearchContacts navigation={mockNavigation} route={mockRoute} />,
    );

    const recentItems = await screen.findAllByTestId(/recent-contact-/);
    const recentItem = recentItems[0];

    await userEvent.press(recentItem);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        SEND_PAYMENT_ROUTES.TRANSACTION_TOKEN_SCREEN,
        { address: expect.any(String) },
      );
    });
  });

  it("pastes clipboard content when paste button is pressed", async () => {
    renderWithProviders(
      <NavigationContainer>
        <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
      </NavigationContainer>,
    );

    const pasteButton = await screen.findByTestId(
      "send-recipient-input-end-button",
    );
    await userEvent.press(pasteButton);

    await waitFor(() => {
      expect(mockGetClipboardText).toHaveBeenCalled();
    });
  });

  it("shows search suggestions when text is entered", async () => {
    jest.useFakeTimers();

    // Setup the mock to return search results for this specific test
    jest.spyOn(sendDuck, "useSendRecipientStore").mockImplementation(
      getSendStoreMock({
        searchResults: mockSearchResults,
        recentAddresses: mockRecentAddresses,
        loadRecentAddresses: mockLoadRecentAddresses,
      }),
    );

    renderWithProviders(
      <NavigationContainer>
        <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
      </NavigationContainer>,
    );

    const input = await screen.findByPlaceholderText("Enter address");
    fireEvent.changeText(input, "test");

    expect(mockPrepareForSearch).toHaveBeenCalled();
    expect(mockSearchAddress).not.toHaveBeenCalled();

    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(mockSearchAddress).toHaveBeenCalledWith("test");
    });

    jest.useRealTimers();
  });

  it("keeps recents and wallets visible while typing an invalid address", async () => {
    jest.spyOn(sendDuck, "useSendRecipientStore").mockImplementation(
      getSendStoreMock({
        searchResults: mockSearchResults,
        recentAddresses: mockRecentAddresses,
        loadRecentAddresses: mockLoadRecentAddresses,
        isValidDestination: false,
      }),
    );

    renderWithProviders(
      <NavigationContainer>
        <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
      </NavigationContainer>,
    );

    const input = await screen.findByPlaceholderText("Enter address");
    await userEvent.type(input, "GABC");

    await waitFor(() => {
      expect(screen.getByText("Recent Contact")).toBeTruthy();
      expect(screen.getByText("My Second Wallet")).toBeTruthy();
    });
  });

  describe("unfunded destination notification", () => {
    const unfundedStoreOverrides = {
      recentAddresses: mockRecentAddresses,
      loadRecentAddresses: mockLoadRecentAddresses,
      isValidDestination: true,
      isDestinationFunded: false,
    };

    const unfundedTitle = "The destination account doesn't exist";

    it("shows the unfunded notice for a classic asset send", async () => {
      jest
        .spyOn(sendDuck, "useSendRecipientStore")
        .mockImplementation(getSendStoreMock(unfundedStoreOverrides));
      jest
        .spyOn(transactionSettingsDuck, "useTransactionSettingsStore")
        .mockReturnValue(
          getTransactionSettingsStoreMock({ selectedTokenId: "XLM" }),
        );

      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByText(unfundedTitle)).toBeTruthy();
      });
    });

    it("hides the unfunded notice when the destination is a contract (C...) address", async () => {
      // Classic-asset sends to a C address go via Soroban `transfer`; the
      // balance lives in the token contract's storage, so there's no
      // classic account to be unfunded.
      jest.spyOn(sendDuck, "useSendRecipientStore").mockImplementation(
        getSendStoreMock({
          ...unfundedStoreOverrides,
          destinationAddress:
            "CAZXRTOKNUQ2JQQF3NCRU7GYMDJNZ2NMQN6IGN4FCT5DWPODMPVEXSND",
        }),
      );
      jest
        .spyOn(transactionSettingsDuck, "useTransactionSettingsStore")
        .mockReturnValue(
          getTransactionSettingsStoreMock({ selectedTokenId: "XLM" }),
        );

      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Enter address")).toBeTruthy();
      });
      expect(screen.queryByText(unfundedTitle)).toBeNull();
    });

    it("shows the unfunded notice for a SAC-wrapped classic asset (classic G-issuer)", async () => {
      // SACs are normalized at import to a classic G-issuer identifier,
      // so getTokenType classifies them as CREDIT_ALPHANUM — not CUSTOM_TOKEN.
      jest
        .spyOn(sendDuck, "useSendRecipientStore")
        .mockImplementation(getSendStoreMock(unfundedStoreOverrides));
      jest
        .spyOn(transactionSettingsDuck, "useTransactionSettingsStore")
        .mockReturnValue(
          getTransactionSettingsStoreMock({
            selectedTokenId:
              "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          }),
        );

      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByText(unfundedTitle)).toBeTruthy();
      });
    });

    it("hides the unfunded notice for a pure Soroban custom token (contract C-issuer)", async () => {
      jest
        .spyOn(sendDuck, "useSendRecipientStore")
        .mockImplementation(getSendStoreMock(unfundedStoreOverrides));
      jest
        .spyOn(transactionSettingsDuck, "useTransactionSettingsStore")
        .mockReturnValue(
          getTransactionSettingsStoreMock({
            selectedTokenId:
              "PBT:CAZXRTOKNUQ2JQQF3NCRU7GYMDJNZ2NMQN6IGN4FCT5DWPODMPVEXSND",
          }),
        );

      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Enter address")).toBeTruthy();
      });
      expect(screen.queryByText(unfundedTitle)).toBeNull();
    });

    it("hides the unfunded notice when the user is in the collectible send flow", async () => {
      jest
        .spyOn(sendDuck, "useSendRecipientStore")
        .mockImplementation(getSendStoreMock(unfundedStoreOverrides));
      jest
        .spyOn(transactionSettingsDuck, "useTransactionSettingsStore")
        .mockReturnValue(
          getTransactionSettingsStoreMock({
            selectedCollectibleDetails: {
              collectionAddress:
                "CAZXRTOKNUQ2JQQF3NCRU7GYMDJNZ2NMQN6IGN4FCT5DWPODMPVEXSND",
              tokenId: "42",
            },
          }),
        );

      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Enter address")).toBeTruthy();
      });
      expect(screen.queryByText(unfundedTitle)).toBeNull();
    });
  });

  describe("My Wallets section", () => {
    beforeEach(() => {
      jest.spyOn(sendDuck, "useSendRecipientStore").mockImplementation(
        getSendStoreMock({
          recentAddresses: [],
          loadRecentAddresses: mockLoadRecentAddresses,
        }),
      );
      mockUseAuthenticationStore.mockReturnValue({
        allAccounts: mockAccounts,
        account: { publicKey: activePublicKey } as any,
      } as any);
    });

    it("renders rows for wallets other than active account", async () => {
      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByText("My Second Wallet")).toBeTruthy();
        expect(screen.getByText("Savings")).toBeTruthy();
      });
    });

    it("does not render active account row", async () => {
      mockUseAuthenticationStore.mockReturnValue({
        allAccounts: [
          ...mockAccounts,
          { id: "active", name: "Active Wallet", publicKey: activePublicKey },
        ],
        account: { publicKey: activePublicKey } as any,
      } as any);

      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByText("My Second Wallet")).toBeTruthy();
      });
      expect(screen.queryByText("Active Wallet")).toBeNull();
    });

    it("sets destination address when wallet row is tapped", async () => {
      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByText("My Second Wallet")).toBeTruthy();
      });

      await userEvent.press(screen.getByTestId("my-wallet-row-wallet-1"));

      await waitFor(() => {
        expect(mockSetDestinationAddress).toHaveBeenCalledWith(
          "GBLS3IXAFSUWBSW3RXJMNXEGCHXEUL6VMBLFGVFPW47X2OL7BG7QQMUQ",
        );
      });
    });

    it("saves the wallet nickname as recipientName when wallet row is tapped", async () => {
      const mockSaveRecipientName = jest.fn();
      const mockSaveFederationAddress = jest.fn();

      jest
        .spyOn(transactionSettingsDuck, "useTransactionSettingsStore")
        .mockReturnValue(
          getTransactionSettingsStoreMock({
            saveRecipientName: mockSaveRecipientName,
            saveFederationAddress: mockSaveFederationAddress,
          }),
        );

      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByText("My Second Wallet")).toBeTruthy();
      });

      await userEvent.press(screen.getByTestId("my-wallet-row-wallet-1"));

      await waitFor(() => {
        // Wallet nicknames go into recipientName, not federationAddress
        expect(mockSaveRecipientName).toHaveBeenCalledWith("My Second Wallet");
        expect(mockSaveFederationAddress).toHaveBeenCalledWith("");
      });
    });

    it("does not save recipientName when contact name is federation address", async () => {
      const mockSaveRecipientAddress = jest.fn();
      const mockSaveRecipientName = jest.fn();

      (isFederationAddress as jest.Mock).mockImplementation((value: string) =>
        value.includes("*"),
      );

      jest
        .spyOn(transactionSettingsDuck, "useTransactionSettingsStore")
        .mockReturnValue(
          getTransactionSettingsStoreMock({
            saveRecipientAddress: mockSaveRecipientAddress,
            saveRecipientName: mockSaveRecipientName,
          }),
        );

      const sendStoreMock = getSendStoreMock({
        recentAddresses: [
          {
            id: "recent-fed",
            address: "GDAS7BS4XKW27H2K5C25V6ZU46FCFGBTFQGFDZURAKVPA6QYQG4GTWBC",
            name: "alice*example.com",
          },
        ],
        // Re-resolution returns the same address; handleContactPress reads
        // searchResults via useSendRecipientStore.getState() to pick the
        // (possibly remapped) resolved key.
        searchResults: [
          {
            id: "search-fed",
            address: "GDAS7BS4XKW27H2K5C25V6ZU46FCFGBTFQGFDZURAKVPA6QYQG4GTWBC",
            name: "alice*example.com",
          },
        ],
        loadRecentAddresses: mockLoadRecentAddresses,
      });
      jest
        .spyOn(sendDuck, "useSendRecipientStore")
        .mockImplementation(sendStoreMock);
      // jest.spyOn replaces the hook function but not the static .getState
      // helper attached to it; re-bind it so the source's getState() call
      // returns the same overridden state.
      (
        sendDuck.useSendRecipientStore as unknown as { getState: jest.Mock }
      ).getState = sendStoreMock.getState;

      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByText("alice*example.com")).toBeTruthy();
      });

      await userEvent.press(screen.getByText("alice*example.com"));

      await waitFor(() => {
        expect(mockSaveRecipientAddress).toHaveBeenCalledWith(
          "GDAS7BS4XKW27H2K5C25V6ZU46FCFGBTFQGFDZURAKVPA6QYQG4GTWBC",
        );
        expect(mockSaveRecipientName).toHaveBeenCalledWith("");
      });
    });

    it("shows My Wallets header when other accounts exist", async () => {
      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByText("My Wallets")).toBeTruthy();
      });
    });

    it("hides My Wallets section when there are no other accounts", async () => {
      mockUseAuthenticationStore.mockReturnValue({
        allAccounts: [
          { id: "active", name: "Active Wallet", publicKey: activePublicKey },
        ],
        account: { publicKey: activePublicKey } as any,
      } as any);

      renderWithProviders(
        <NavigationContainer>
          <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
        </NavigationContainer>,
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Enter address")).toBeTruthy();
      });
      expect(screen.queryByText("My Wallets")).toBeNull();
    });
  });
});

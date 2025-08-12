import { NavigationContainer, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { SendSearchContacts } from "components/screens/SendScreen";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import * as sendDuck from "ducks/sendRecipient";
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
const getSendStoreMock = (overrides = {}) =>
  jest.fn().mockReturnValue({
    recentAddresses: [],
    searchResults: [],
    searchError: null,
    loadRecentAddresses: mockLoadRecentAddresses,
    searchAddress: mockSearchAddress,
    addRecentAddress: mockAddRecentAddress,
    setDestinationAddress: mockSetDestinationAddress,
    resetSendRecipient: mockReset,
    ...overrides,
  });

jest.mock("ducks/sendRecipient", () => ({
  useSendRecipientStore: getSendStoreMock(),
}));

type SendSearchContactsNavigationProp = NativeStackNavigationProp<
  SendPaymentStackParamList,
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
    };
    return translations[key] || key;
  },
}));

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
  }, 10000);

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
  }, 15000);

  it("pastes clipboard content when paste button is pressed", async () => {
    renderWithProviders(
      <NavigationContainer>
        <SendSearchContacts navigation={mockNavigation} route={mockRoute} />
      </NavigationContainer>,
    );

    const pasteButton = await screen.findByTestId("search-input-end-button");
    await userEvent.press(pasteButton);

    await waitFor(() => {
      expect(mockGetClipboardText).toHaveBeenCalled();
    });
  }, 15000);

  it("shows search suggestions when text is entered", async () => {
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
    await userEvent.type(input, "test");

    await waitFor(() => {
      expect(mockSearchAddress).toHaveBeenCalledWith("test");
    });
  }, 10000);
});

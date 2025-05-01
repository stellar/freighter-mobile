import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { SendSearchContacts } from "components/screens/SendScreen";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React, { ReactElement, ReactNode } from "react";
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
}));

const mockGetClipboardText = jest.fn().mockResolvedValue("test-address");
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({
    getClipboardText: mockGetClipboardText,
  }),
}));

type SendSearchContactsNavigationProp = NativeStackNavigationProp<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.SEND_PAYMENT_SCREEN
>;

type SendSearchContactsRouteProp = RouteProp<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.SEND_PAYMENT_SCREEN
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
  name: SEND_PAYMENT_ROUTES.SEND_PAYMENT_SCREEN,
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
  });

  it("renders correctly with the search input and recent transactions", async () => {
    renderWithProviders(
      <SendSearchContacts navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter address")).toBeTruthy();
      expect(screen.getByText("Recent")).toBeTruthy();
    });
  }, 10000);

  it("navigates to transaction details screen when a contact is pressed", async () => {
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
      <SendSearchContacts navigation={mockNavigation} route={mockRoute} />,
    );

    const pasteButton = await screen.findByTestId("search-input-end-button");
    await userEvent.press(pasteButton);

    await waitFor(() => {
      expect(mockGetClipboardText).toHaveBeenCalled();
    });
  }, 10000);

  it("shows search suggestions when text is entered", async () => {
    renderWithProviders(
      <SendSearchContacts navigation={mockNavigation} route={mockRoute} />,
    );

    const input = await screen.findByPlaceholderText("Enter address");
    await userEvent.type(input, "test");

    await waitFor(() => {
      expect(screen.getByText("Suggestions")).toBeTruthy();
    });
  }, 10000);

  it("sets up the header with back button on mount", async () => {
    renderWithProviders(
      <SendSearchContacts navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(mockSetOptions).toHaveBeenCalledWith({
        headerLeft: expect.any(Function),
      });
    });
  }, 10000);

  it("goes back when header back button is pressed", async () => {
    renderWithProviders(
      <SendSearchContacts navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      const headerLeftFn = mockSetOptions.mock.calls[0][0].headerLeft;
      const BackButton = headerLeftFn() as ReactElement;

      const onPressHandler = BackButton.props as { onPress?: () => void };
      if (typeof onPressHandler.onPress === "function") {
        onPressHandler.onPress();
      }

      expect(mockGoBack).toHaveBeenCalled();
    });
  }, 10000);
});

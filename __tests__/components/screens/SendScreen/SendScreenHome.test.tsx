import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { userEvent } from "@testing-library/react-native";
import { SendHome } from "components/screens/SendScreen";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React, { ReactElement, ReactNode, act } from "react";
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

type SendHomeNavigationProp = NativeStackNavigationProp<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.SEND_PAYMENT_SCREEN
>;

type SendHomeRouteProp = RouteProp<
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
} as unknown as SendHomeNavigationProp;

const mockRoute = {
  name: SEND_PAYMENT_ROUTES.SEND_PAYMENT_SCREEN,
  key: "test-key",
  params: {},
} as unknown as SendHomeRouteProp;

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "sendPaymentScreen.inputPlaceholder": "Enter address",
      "sendPaymentScreen.recents": "Recent",
      "sendPaymentScreen.suggestions": "Suggestions",
    };
    return translations[key] || key;
  },
}));

describe("SendScreenHome", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with the search input and recent transactions", () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <SendHome navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByPlaceholderText("Enter address")).toBeTruthy();
    expect(getByText("Recent")).toBeTruthy();
  });

  it("navigates to transaction detail screen when a contact is pressed", async () => {
    const { getAllByTestId } = renderWithProviders(
      <SendHome navigation={mockNavigation} route={mockRoute} />,
    );

    const recentItem = getAllByTestId(/recent-transaction-/)[0];

    await act(async () => {
      await userEvent.press(recentItem);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      SEND_PAYMENT_ROUTES.TRANSACTION_DETAIL_SCREEN,
      { address: expect.any(String) },
    );
  }, 10000);

  it("pastes clipboard content when paste button is pressed", async () => {
    const { getByText } = renderWithProviders(
      <SendHome navigation={mockNavigation} route={mockRoute} />,
    );

    const pasteButton = getByText("Paste");

    await act(async () => {
      await userEvent.press(pasteButton);
    });

    expect(mockGetClipboardText).toHaveBeenCalled();
  });

  it("shows search suggestions when text is entered", async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <SendHome navigation={mockNavigation} route={mockRoute} />,
    );

    const input = getByPlaceholderText("Enter address");

    await act(async () => {
      await userEvent.type(input, "test");
    });

    expect(getByText("Suggestions")).toBeTruthy();
  });

  it("sets up the header with back button on mount", () => {
    renderWithProviders(
      <SendHome navigation={mockNavigation} route={mockRoute} />,
    );

    expect(mockSetOptions).toHaveBeenCalledWith({
      headerLeft: expect.any(Function),
    });
  });

  it("goes back when header back button is pressed", () => {
    renderWithProviders(
      <SendHome navigation={mockNavigation} route={mockRoute} />,
    );

    const headerLeftFn = mockSetOptions.mock.calls[0][0].headerLeft;
    const BackButton = headerLeftFn() as ReactElement;

    const onPressHandler = BackButton.props as { onPress?: () => void };
    if (typeof onPressHandler.onPress === "function") {
      onPressHandler.onPress();
    }

    expect(mockGoBack).toHaveBeenCalled();
  });
});

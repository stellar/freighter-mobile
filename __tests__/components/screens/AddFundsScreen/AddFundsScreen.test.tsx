import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import AddFundsScreen from "components/screens/AddFundsScreen";
import {
  ADD_FUNDS_ROUTES,
  AddFundsStackParamList,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { View } from "react-native";

const mockView = View;

jest.mock("react-native-gesture-handler", () => ({
  PanGestureHandler: mockView,
  GestureHandlerRootView: mockView,
  State: {},
  createNativeWrapper: jest.fn((component) => component),
}));

jest.mock("hooks/useRightHeader", () => ({
  useRightHeaderButton: jest.fn(),
  useRightHeaderMenu: jest.fn(),
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "addFundsScreen.title": "Add funds",
      "addFundsScreen.transferFromAnotherAccount.title":
        "Transfer from another account",
      "addFundsScreen.transferFromAnotherAccount.description":
        "Receive funds from another wallet",
      "addFundsScreen.buyWithCoinbase.title": "Buy with Coinbase",
      "addFundsScreen.buyWithCoinbase.description":
        "Transfer from Coinbase & other options",
      "addFundsScreen.bottomSheet.description": "Bottom Sheet Description",
    };
    return translations[key] || key;
  },
}));

type AddFundsScreenProps = NativeStackScreenProps<
  AddFundsStackParamList,
  typeof ADD_FUNDS_ROUTES.ADD_FUNDS_SCREEN
>;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  setOptions: mockSetOptions,
} as unknown as AddFundsScreenProps["navigation"];

const mockRoute = {
  params: { isUnfunded: false },
  key: "add-funds",
  name: ADD_FUNDS_ROUTES.ADD_FUNDS_SCREEN,
} as unknown as AddFundsScreenProps["route"];

describe("AddFundsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the transfer from another account action button with correct text", () => {
    const { getByText } = renderWithProviders(
      <AddFundsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText("Transfer from another account")).toBeTruthy();
    expect(getByText("Receive funds from another wallet")).toBeTruthy();
  });

  it("navigates to QR code screen when transfer button is pressed", () => {
    const { getByText } = renderWithProviders(
      <AddFundsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const transferButton = getByText("Transfer from another account");
    const transferContainer = transferButton.parent;
    if (transferContainer) {
      fireEvent.press(transferContainer);

      expect(mockNavigate).toHaveBeenCalledWith(
        ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN,
        {},
      );
    }
  });
});

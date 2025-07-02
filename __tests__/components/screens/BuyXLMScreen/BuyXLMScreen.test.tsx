import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import BuyXLMScreen from "components/screens/BuyXLMScreen";
import {
  BUY_XLM_ROUTES,
  BuyXLMStackParamList,
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
      "buyXLMScreen.title": "Buy XLM",
      "buyXLMScreen.actions.title": "Show QR Code",
      "buyXLMScreen.actions.description": "Show your wallet address QR code",
      "buyXLMScreen.bottomSheet.description": "Bottom Sheet Description",
    };
    return translations[key] || key;
  },
}));

type BuyXLMScreenProps = NativeStackScreenProps<
  BuyXLMStackParamList,
  typeof BUY_XLM_ROUTES.BUY_XLM_SCREEN
>;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  setOptions: mockSetOptions,
} as unknown as BuyXLMScreenProps["navigation"];

const mockRoute = {
  params: { isUnfunded: false },
  key: "buy-xlm",
  name: BUY_XLM_ROUTES.BUY_XLM_SCREEN,
} as unknown as BuyXLMScreenProps["route"];

describe("BuyXLMScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the QR code action button with correct text", () => {
    const { getByText } = renderWithProviders(
      <BuyXLMScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText("Show QR Code")).toBeTruthy();
    expect(getByText("Show your wallet address QR code")).toBeTruthy();
  });

  it("navigates to QR code screen when action button is pressed", () => {
    const { getByText } = renderWithProviders(
      <BuyXLMScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const qrCodeButton = getByText("Show QR Code");
    const qrCodeContainer = qrCodeButton.parent;
    if (qrCodeContainer) {
      fireEvent.press(qrCodeContainer);

      expect(mockNavigate).toHaveBeenCalledWith(
        ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN,
        {},
      );
    }
  });
});

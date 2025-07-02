import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent } from "@testing-library/react-native";
import AccountQRCodeScreen from "components/screens/AccountQRCodeScreen";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
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

jest.mock("react-native-qrcode-svg", () => {
  const QRCode = () => mockView;
  QRCode.displayName = "QRCode";

  return QRCode;
});

const mockAccount = {
  publicKey: "GACJYENHYW2LGHBNNGNZ4NCBGZYVTGTZM4CJLQIOQQ5IUZU3SYWOW5EK",
  accountName: "Test Account",
};

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({
    account: mockAccount,
  }),
}));

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
  }),
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "accountQRCodeScreen.copyButton": "Copy Address",
      "accountQRCodeScreen.helperText": "Helper Text",
      "accountQRCodeScreen.bottomSheet.title": "Bottom Sheet Title",
      "accountQRCodeScreen.bottomSheet.description": "Bottom Sheet Description",
    };
    return translations[key] || key;
  },
}));

type AccountQRCodeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN
>;

const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();

const mockNavigation = {
  goBack: mockGoBack,
  setOptions: mockSetOptions,
} as unknown as AccountQRCodeScreenProps["navigation"];

const mockRoute = {
  params: { showNavigationAsCloseButton: false },
  key: "account-qr",
  name: ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN,
} as unknown as AccountQRCodeScreenProps["route"];

describe("AccountQRCodeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders account information correctly", () => {
    const { getByText } = renderWithProviders(
      <AccountQRCodeScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText("Test Account")).toBeTruthy();
    expect(getByText("GACJ...W5EK")).toBeTruthy();
  });

  it("copies address to clipboard when copy button is pressed", () => {
    const { getByText } = renderWithProviders(
      <AccountQRCodeScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const copyButton = getByText("Copy Address");
    fireEvent.press(copyButton);

    expect(mockCopyToClipboard).toHaveBeenCalledWith(mockAccount.publicKey);
  });

  it("shows close button when showNavigationAsCloseButton is true", () => {
    const routeWithCloseButton = {
      ...mockRoute,
      params: { showNavigationAsCloseButton: true },
    } as unknown as AccountQRCodeScreenProps["route"];

    renderWithProviders(
      <AccountQRCodeScreen
        navigation={mockNavigation}
        route={routeWithCloseButton}
      />,
    );

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        headerLeft: expect.any(Function),
      }),
    );
  });
});

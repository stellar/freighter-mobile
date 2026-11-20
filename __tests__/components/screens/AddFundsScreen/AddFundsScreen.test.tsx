import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fireEvent, waitFor } from "@testing-library/react-native";
import AddFundsScreen from "components/screens/AddFundsScreen";
import {
  ADD_FUNDS_ROUTES,
  AddFundsStackParamList,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import { useRemoteConfigStore } from "ducks/remoteConfig";
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
      "addFundsScreen.buyWithCoinbase.error":
        "Unable to communicate with Coinbase",
    };
    return translations[key] || key;
  },
}));

const mockShowToast = jest.fn();
jest.mock("providers/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
  useToast: () => ({ showToast: mockShowToast, dismissToast: jest.fn() }),
}));

const mockOpenCoinbaseUrl = jest.fn();
const mockUseCoinbaseOnramp = jest.fn<
  { openCoinbaseUrl: jest.Mock; isLoading: boolean },
  [{ token?: string }]
>(() => ({
  openCoinbaseUrl: mockOpenCoinbaseUrl,
  isLoading: false,
}));
jest.mock("hooks/useCoinbaseOnramp", () => ({
  useCoinbaseOnramp: (params: { token?: string }) =>
    mockUseCoinbaseOnramp(params),
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

  it("navigates to the Scan/Receive screen (Receive tab) when transfer button is pressed", () => {
    const { getByText } = renderWithProviders(
      <AddFundsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const transferButton = getByText("Transfer from another account");
    const transferContainer = transferButton.parent;
    if (transferContainer) {
      fireEvent.press(transferContainer);

      expect(mockNavigate).toHaveBeenCalledWith(
        ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN,
        { initialTab: "receive" },
      );
    }
  });

  // A flow that knows the token the user needs (Earn's Buy) opens Coinbase
  // on it; an unfunded account opens on XLM; otherwise Coinbase chooses.
  describe("the token Coinbase opens on", () => {
    const routeWith = (params: { isUnfunded: boolean; token?: string }) =>
      ({ ...mockRoute, params }) as unknown as AddFundsScreenProps["route"];

    it("is the one the caller passes", () => {
      renderWithProviders(
        <AddFundsScreen
          navigation={mockNavigation}
          route={routeWith({ isUnfunded: false, token: "USDC" })}
        />,
      );

      expect(mockUseCoinbaseOnramp).toHaveBeenCalledWith({ token: "USDC" });
    });

    it("is XLM for an unfunded account", () => {
      renderWithProviders(
        <AddFundsScreen
          navigation={mockNavigation}
          route={routeWith({ isUnfunded: true })}
        />,
      );

      expect(mockUseCoinbaseOnramp).toHaveBeenCalledWith({ token: "XLM" });
    });

    it("is left to Coinbase otherwise", () => {
      renderWithProviders(
        <AddFundsScreen
          navigation={mockNavigation}
          route={routeWith({ isUnfunded: false })}
        />,
      );

      expect(mockUseCoinbaseOnramp).toHaveBeenCalledWith({});
    });
  });

  describe("Buy with Coinbase", () => {
    beforeEach(() => {
      useRemoteConfigStore.setState({ onramp_enabled: true });
    });

    it("shows an error toast when Coinbase can't be reached", async () => {
      mockOpenCoinbaseUrl.mockRejectedValueOnce(
        new Error("Failed to fetch onramp token"),
      );
      const { getByText } = renderWithProviders(
        <AddFundsScreen navigation={mockNavigation} route={mockRoute} />,
      );

      fireEvent.press(getByText("Buy with Coinbase"));

      await waitFor(() =>
        expect(mockShowToast).toHaveBeenCalledWith({
          variant: "error",
          title: "Unable to communicate with Coinbase",
        }),
      );
    });

    it("shows no toast when Coinbase opens", async () => {
      mockOpenCoinbaseUrl.mockResolvedValueOnce(undefined);
      const { getByText } = renderWithProviders(
        <AddFundsScreen navigation={mockNavigation} route={mockRoute} />,
      );

      fireEvent.press(getByText("Buy with Coinbase"));

      await waitFor(() => expect(mockOpenCoinbaseUrl).toHaveBeenCalled());
      expect(mockShowToast).not.toHaveBeenCalled();
    });
  });
});

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BigNumber from "bignumber.js";
import SwapAmountScreen from "components/screens/SwapScreen/screens/SwapAmountScreen";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { View } from "react-native";

const mockBalanceItems = [
  {
    id: "XLM",
    token: {
      code: "XLM",
      type: "native",
    },
    total: "100.5",
    available: "100.5",
    minimumBalance: "1",
    buyingLiabilities: "0",
    sellingLiabilities: "0",
    tokenCode: "XLM",
    displayName: "XLM",
    imageUrl: "",
    currentPrice: new BigNumber("0.5"),
    percentagePriceChange24h: new BigNumber("0.02"),
    fiatCode: "USD",
    fiatTotal: "50.25",
  },
  {
    id: "USDC:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
    token: {
      code: "USDC",
      type: "",
    },
    total: "10",
    available: "10",
    minimumBalance: "1",
    buyingLiabilities: "0",
    sellingLiabilities: "0",
    tokenCode: "USDC",
    displayName: "USDC",
    imageUrl: "",
    currentPrice: new BigNumber("0.5"),
    percentagePriceChange24h: new BigNumber("0.02"),
    fiatCode: "USD",
    fiatTotal: "50.25",
  },
];

const MockView = View;
const mockSetSourceToken = jest.fn();
const mockSetDestinationToken = jest.fn();
const mockSetSourceAmount = jest.fn();
const mockResetSwap = jest.fn();
const mockResetTransaction = jest.fn();
const mockResetToDefaults = jest.fn();
const mockExecuteSwap = jest.fn().mockResolvedValue(undefined);
const mockSetupSwapTransaction = jest.fn().mockResolvedValue(undefined);

jest.mock("react-native-gesture-handler", () => ({
  PanGestureHandler: MockView,
  GestureHandlerRootView: MockView,
  State: {},
  createNativeWrapper: jest.fn((component) => component),
  TapGestureHandler: ({ children }: any) => <MockView>{children}</MockView>,
}));

jest.mock("ducks/swap", () => ({
  useSwapStore: jest.fn(() => ({
    sourceTokenId: "SRC",
    destinationTokenId: "",
    sourceTokenSymbol: "XLM",
    sourceAmount: "0",
    destinationAmount: "0",
    setSourceToken: mockSetSourceToken,
    setDestinationToken: mockSetDestinationToken,
    setSourceAmount: mockSetSourceAmount,
    resetSwap: mockResetSwap,
  })),
}));
jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: jest.fn(() => ({
    isBuilding: false,
    resetTransaction: mockResetTransaction,
  })),
}));
jest.mock("ducks/swapSettings", () => ({
  useSwapSettingsStore: jest.fn(() => ({
    swapFee: "100",
    swapTimeout: "30",
    swapSlippage: "0.5",
    resetToDefaults: mockResetToDefaults,
  })),
}));
jest.mock("components/screens/SwapScreen/hooks/useSwapTransaction", () => ({
  useSwapTransaction: jest.fn(() => ({
    isProcessing: false,
    executeSwap: mockExecuteSwap,
    setupSwapTransaction: mockSetupSwapTransaction,
    handleProcessingScreenClose: jest.fn(),
    sourceToken: "XLM",
    destinationToken: "USDC",
    transactionScanResult: {},
    sourceAmount: "10",
  })),
}));
jest.mock("hooks/useColors", () => () => ({
  themeColors: {
    text: { secondary: "gray" },
    gray: { 9: "gray" },
    background: {
      tertiary: "white",
    },
    foreground: {
      primary: "white",
    },
    border: {
      primary: "white",
    },
    base: {
      1: "white",
    },
  },
}));
jest.mock("hooks/useGetActiveAccount", () => () => ({
  account: { publicKey: "abc", subentryCount: 0 },
}));
jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(() => ({
    balanceItems: mockBalanceItems,
    scanResults: {},
    isLoading: false,
    error: null,
    noBalances: false,
    isRefreshing: false,
    isFunded: true,
    handleRefresh: jest.fn(),
  })),
}));
jest.mock("hooks/useRightHeader", () => ({ useRightHeaderMenu: jest.fn() }));
const mockShowToast = jest.fn();
jest.mock("providers/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <MockView>{children}</MockView>
  ),
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

type Props = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_AMOUNT_SCREEN
>;

const makeNavigation = () =>
  ({ navigate: jest.fn() }) as unknown as Props["navigation"];

const makeRoute = () =>
  ({
    key: "swap-amount",
    name: SWAP_ROUTES.SWAP_AMOUNT_SCREEN,
    params: { tokenId: "SRC", tokenSymbol: "XLM" },
  }) as unknown as Props["route"];

describe("SwapAmountScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("initializes source token from route params", () => {
    renderWithProviders(
      <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
    );
    expect(mockSetSourceToken).toHaveBeenCalledWith("SRC", "XLM");
    expect(mockSetDestinationToken).toHaveBeenCalledWith("", "");
    expect(mockSetSourceAmount).toHaveBeenCalledWith("0");
  });

  it.skip("opens review bottom sheet when destination balance exists", () => {
    // const { result } = renderHook(() => useAppTranslation());
    // ...
  });

  it("resets state on unmount", () => {
    const { unmount } = renderWithProviders(
      <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
    );
    unmount();
    expect(mockResetSwap).toHaveBeenCalled();
    expect(mockResetTransaction).toHaveBeenCalled();
    expect(mockResetToDefaults).toHaveBeenCalled();
  });
});

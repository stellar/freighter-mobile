/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @fnando/consistent-import/consistent-import */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import SwapAmountScreen from "components/screens/SwapScreen/screens/SwapAmountScreen";
import Icon from "components/sds/Icon";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { renderWithProviders } from "helpers/testUtils";
import { useBalancesList } from "hooks/useBalancesList";
import React, { act } from "react";
import { View } from "react-native";

import { mockBalances } from "../../../../__mocks__/balances";
import { mockGestureHandler } from "../../../../__mocks__/gesture-handler";
import { mockUseColors } from "../../../../__mocks__/use-colors";

const MockView = View;
const mockSetSourceToken = jest.fn();
const mockSetDestinationToken = jest.fn();
const mockSetSourceAmount = jest.fn();
const mockResetSwap = jest.fn();
const mockResetTransaction = jest.fn();
const mockResetToDefaults = jest.fn();
const mockExecuteSwap = jest.fn().mockResolvedValue(undefined);
const mockSetupSwapTransaction = jest.fn().mockResolvedValue(undefined);

mockGestureHandler();
mockUseColors();
jest.mock("ducks/swap", () => ({
  useSwapStore: jest.fn(() => ({
    sourceTokenId:
      "USDC:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
    destinationTokenId:
      "FTT:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
    sourceTokenSymbol: "USDC",
    destinationTokenSymbol: "FTT",
    sourceAmount: "1",
    destinationAmount: "2",
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
jest.mock("hooks/useBalancesList");
jest.mock("hooks/useGetActiveAccount", () => () => ({
  account: { publicKey: "abc", subentryCount: 0 },
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
    (useBalancesList as jest.Mock).mockImplementation(() => ({
      balanceItems: mockBalances,
      scanResults: {
        "USDC-GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH": {
          result_type: "Malicious",
        },
      },
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    }));
    renderWithProviders(
      <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
    );
    expect(mockSetSourceToken).toHaveBeenCalledWith("SRC", "XLM");
    expect(mockSetDestinationToken).toHaveBeenCalledWith("", "");
    expect(mockSetSourceAmount).toHaveBeenCalledWith("0");
  });

  it("renders security warnings for malicious states", () => {
    (useBalancesList as jest.Mock).mockImplementation(() => ({
      balanceItems: mockBalances,
      scanResults: {
        "USDC-GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH": {
          result_type: "Malicious",
        },
      },
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    }));
    const { UNSAFE_getByType } = renderWithProviders(
      <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
    );
    const icon = UNSAFE_getByType(Icon.AlertCircle);
    expect(icon).toBeTruthy();
    expect(icon.props.themeColor).toBe("red");
  });

  it("renders security warnings for suspicious states", () => {
    (useBalancesList as jest.Mock).mockImplementation(() => ({
      balanceItems: mockBalances,
      scanResults: {
        "USDC-GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH": {
          result_type: "Warning",
        },
      },
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    }));
    const { UNSAFE_getByType } = renderWithProviders(
      <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
    );
    const icon = UNSAFE_getByType(Icon.AlertCircle);
    expect(icon).toBeTruthy();
    expect(icon.props.themeColor).toBe("amber");
  });

  it("resets state on unmount", () => {
    const { unmount } = renderWithProviders(
      <SwapAmountScreen navigation={makeNavigation()} route={makeRoute()} />,
    );
    act(() => {
      unmount();
    });
    expect(mockResetSwap).toHaveBeenCalled();
    expect(mockResetTransaction).toHaveBeenCalled();
    expect(mockResetToDefaults).toHaveBeenCalled();
  });
});

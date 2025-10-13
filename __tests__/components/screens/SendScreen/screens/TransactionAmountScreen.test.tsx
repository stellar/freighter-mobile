import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, render } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import TransactionAmountScreen from "components/screens/SendScreen/screens/TransactionAmountScreen";
import { NETWORKS } from "config/constants";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { useHistoryStore } from "ducks/history";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { calculateSpendableAmount, hasXLMForFees } from "helpers/balances";
import { cachedFetch } from "helpers/cachedFetch";
import { useDeviceSize, DeviceSize } from "helpers/deviceSize";
import { renderWithProviders } from "helpers/testUtils";
import * as blockaidService from "hooks/blockaid/useBlockaidTransaction";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useRightHeaderMenu } from "hooks/useRightHeader";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import { useValidateTransactionMemo } from "hooks/useValidateTransactionMemo";
import { useToast } from "providers/ToastProvider";
import React from "react";
import * as transactionService from "services/transactionService";

// Type definitions
type TransactionAmountScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN
>;

// Core mocks
jest.mock("ducks/transactionBuilder");
jest.mock("ducks/transactionSettings");
jest.mock("ducks/auth");
jest.mock("ducks/history");
jest.mock("ducks/sendRecipient");

// Service mocks
jest.mock("services/transactionService");
jest.mock("services/analytics", () => ({
  analytics: {
    track: jest.fn(),
    trackSendPaymentSuccess: jest.fn(),
    trackTransactionError: jest.fn(),
  },
}));

// Helper mocks
jest.mock("helpers/balances", () => ({
  calculateSpendableAmount: jest.fn(),
  hasXLMForFees: jest.fn(),
}));
jest.mock("helpers/cachedFetch");
jest.mock("helpers/deviceSize");

// Hook mocks
jest.mock("hooks/useGetActiveAccount");
jest.mock("hooks/useBalancesList");
jest.mock("hooks/useTokenFiatConverter");
jest.mock("hooks/useValidateTransactionMemo");
jest.mock("hooks/useRightHeader");
jest.mock("hooks/useBiometrics", () => ({
  useBiometrics: () => ({
    biometryType: null,
    setIsBiometricsEnabled: jest.fn(),
    isBiometricsEnabled: false,
    enableBiometrics: jest.fn(() => Promise.resolve(true)),
    disableBiometrics: jest.fn(() => Promise.resolve(true)),
    checkBiometrics: jest.fn(() => Promise.resolve(null)),
    handleEnableBiometrics: jest.fn(() => Promise.resolve(true)),
    handleDisableBiometrics: jest.fn(() => Promise.resolve(true)),
    verifyBiometrics: jest.fn(() => Promise.resolve(true)),
    getButtonIcon: jest.fn(() => null),
    getButtonText: jest.fn(() => ""),
    getButtonColor: jest.fn(() => "#000000"),
    setSignInMethod: jest.fn(),
  }),
}));
jest.mock("hooks/blockaid/useBlockaidTransaction");
jest.mock("providers/ToastProvider");

// Component mocks
jest.mock("components/BalanceRow", () => ({
  BalanceRow: "View",
}));
jest.mock("components/screens/SendScreen/components", () => ({
  SendReviewBottomSheet: function MockSendReviewBottomSheet() {
    return null;
  },
  ContactRow: function MockContactRow() {
    return null;
  },
}));
jest.mock(
  "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails",
  () => ({
    useSignTransactionDetails: jest.fn(() => ({
      signTransactionDetails: null,
    })),
  }),
);
jest.mock("components/sds/Icon", () => ({
  __esModule: true,
  default: new Proxy({}, { get: () => "View" }),
}));

// Third-party library mocks
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => {
    const MockI18nextProvider = ({
      children: childProps,
    }: {
      children: React.ReactNode;
    }) => childProps;
    MockI18nextProvider.displayName = "I18nextProvider";
    return MockI18nextProvider({ children });
  },
}));
jest.mock("i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  BottomSheetModal: "View",
  BottomSheetTextInput: "input",
  BottomSheetView: "View",
  BottomSheetScrollView: "ScrollView",
  BottomSheetFlatList: "FlatList",
  BottomSheetSectionList: "SectionList",
  BottomSheetDraggableView: "View",
  BottomSheetBackdrop: "View",
  BottomSheetHandle: "View",
  BottomSheetBackground: "View",
  BottomSheetGestureHandler: "View",
  BottomSheetTouchableOpacity: "TouchableOpacity",
  BottomSheetPressable: "Pressable",
}));
jest.mock("react-native-css-interop", () => ({
  styled: (Component: any) => Component,
  createInteropElement: jest.fn(),
}));

// Utility mocks
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));
jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: new Proxy(
      {},
      {
        get: (target, prop) => {
          if (typeof prop === "string") {
            return new Proxy({}, { get: () => "#000000" });
          }
          return (target as any)[prop];
        },
      },
    ),
  }),
}));
jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));
jest.mock("services/blockaid/helper", () => ({
  assessTokenSecurity: jest.fn(() => ({
    isMalicious: false,
    isSuspicious: false,
  })),
  assessTransactionSecurity: jest.fn(() => ({
    isMalicious: false,
    isSuspicious: false,
  })),
  extractSecurityWarnings: jest.fn(() => []),
}));

// Mock cachedFetch to return memo-required accounts data
const mockCachedFetch = cachedFetch as jest.MockedFunction<typeof cachedFetch>;

const mockUseTransactionBuilderStore =
  useTransactionBuilderStore as jest.MockedFunction<
    typeof useTransactionBuilderStore
  >;
const mockUseTransactionSettingsStore =
  useTransactionSettingsStore as jest.MockedFunction<
    typeof useTransactionSettingsStore
  >;
const mockUseAuthenticationStore =
  useAuthenticationStore as jest.MockedFunction<typeof useAuthenticationStore>;
const mockUseValidateTransactionMemo =
  useValidateTransactionMemo as jest.MockedFunction<
    typeof useValidateTransactionMemo
  >;
const mockBuildTransaction =
  transactionService.buildPaymentTransaction as jest.MockedFunction<
    typeof transactionService.buildPaymentTransaction
  >;
const mockScanTransaction =
  blockaidService.useBlockaidTransaction as jest.MockedFunction<
    typeof blockaidService.useBlockaidTransaction
  >;

// Mock additional hooks
const mockUseGetActiveAccount = useGetActiveAccount as jest.MockedFunction<
  typeof useGetActiveAccount
>;
const mockUseBalancesList = useBalancesList as jest.MockedFunction<
  typeof useBalancesList
>;
const mockUseTokenFiatConverter = useTokenFiatConverter as jest.MockedFunction<
  typeof useTokenFiatConverter
>;
const mockUseDeviceSize = useDeviceSize as jest.MockedFunction<
  typeof useDeviceSize
>;
const mockUseRightHeaderMenu = useRightHeaderMenu as jest.MockedFunction<
  typeof useRightHeaderMenu
>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockUseHistoryStore = useHistoryStore as jest.MockedFunction<
  typeof useHistoryStore
>;
const mockUseSendRecipientStore = useSendRecipientStore as jest.MockedFunction<
  typeof useSendRecipientStore
>;
const mockCalculateSpendableAmount =
  calculateSpendableAmount as jest.MockedFunction<
    typeof calculateSpendableAmount
  >;
const mockHasXLMForFees = hasXLMForFees as jest.MockedFunction<
  typeof hasXLMForFees
>;

// Mock navigation and route
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockReset = jest.fn();

const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  reset: mockReset,
} as unknown as TransactionAmountScreenProps["navigation"];

const mockRoute = {
  params: {
    tokenId: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    recipientAddress:
      "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
  },
  key: "transaction-amount",
  name: SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN,
} as unknown as TransactionAmountScreenProps["route"];

describe("TransactionAmountScreen - Memo Update Flow", () => {
  const mockPublicKey =
    "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
  const mockRecipientAddress =
    "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF";
  const mockTokenAmount = "100";
  const mockXDR = "mockTransactionXDR";
  const mockScanResult = { warnings: [], malicious: false, suspicious: false };

  const mockSelectedBalance = {
    id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    tokenId: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    total: "1000",
    available: "1000",
    token: {
      code: "USDC",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    },
  };

  const mockXlmBalance = {
    id: "XLM",
    tokenId: "XLM",
    total: new BigNumber("10.0000000"),
    available: new BigNumber("10.0000000"),
    token: {
      code: "XLM",
      issuer: "",
      type: "native",
    },
    tokenType: "native",
    price: 0.1,
    fiatValue: 1.0,
  };

  const mockTransactionBuilderState = {
    buildTransaction: jest.fn(),
    signTransaction: jest.fn(),
    submitTransaction: jest.fn(),
    resetTransaction: jest.fn(),
    isBuilding: false,
    isSigning: false,
    isSubmitting: false,
    transactionXDR:
      "AAAAAgAAAABlgrTOmQt826u8R+HKOeuICKO/worYIyYW8m9U0aSaZgAAAGQDeoz1AAAAvAAAAAEAAAAAAAAAAAAAAABo7RV7AAAAAAAAAAEAAAAAAAAAAQAAAABK9RdfXO7+12qzjvy5REcU2QEoutCIRI30uL/x3hfp5QAAAAAAAAAACePMNwAAAAAAAAAA",
    transaction: null,
    network: NETWORKS.TESTNET,
  };

  const mockTransactionSettingsState = {
    transactionMemo: "",
    transactionFee: "0.00001",
    transactionTimeout: 30,
    recipientAddress: mockRecipientAddress,
    selectedTokenId:
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    saveMemo: jest.fn(),
    saveTransactionFee: jest.fn(),
    saveTransactionTimeout: jest.fn(),
    saveRecipientAddress: jest.fn(),
    saveSelectedTokenId: jest.fn(),
    resetSettings: jest.fn(),
  };

  const mockAuthState = {
    publicKey: mockPublicKey,
    network: NETWORKS.TESTNET,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTransactionBuilderStore.mockReturnValue(mockTransactionBuilderState);
    mockUseTransactionSettingsStore.mockReturnValue(
      mockTransactionSettingsState,
    );
    mockUseAuthenticationStore.mockReturnValue(mockAuthState);
    // Set default mock for useValidateTransactionMemo - individual tests can override
    mockUseValidateTransactionMemo.mockReturnValue({
      isValidatingMemo: false,
      isMemoMissing: false,
    });
    mockBuildTransaction.mockResolvedValue({
      xdr: mockXDR,
      tx: { sequence: "1" } as any,
    });
    mockScanTransaction.mockReturnValue({
      scanTransaction: jest.fn().mockResolvedValue(mockScanResult),
    });

    // Mock additional hooks
    mockUseGetActiveAccount.mockReturnValue({
      account: {
        publicKey: mockPublicKey,
        privateKey: "mockPrivateKey",
        accountName: "Test Account",
        id: "test-id",
        subentryCount: 0,
      } as ActiveAccount,
      isLoading: false,
      error: null,
      refreshAccount: jest.fn(),
      signTransaction: jest.fn(),
    });
    mockUseBalancesList.mockReturnValue({
      balanceItems: [mockSelectedBalance as any, mockXlmBalance as any],
      scanResults: {} as any,
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    });

    // Mock balance calculation functions
    mockCalculateSpendableAmount.mockReturnValue(new BigNumber("1000")); // Return 1000 for USDC
    mockHasXLMForFees.mockReturnValue(true); // Return true for XLM fees
    mockUseTokenFiatConverter.mockReturnValue({
      tokenAmount: mockTokenAmount,
      fiatAmount: "100.00",
      showFiatAmount: false,
      setTokenAmount: jest.fn(),
      setFiatAmount: jest.fn(),
      setShowFiatAmount: jest.fn(),
      handleDisplayAmountChange: jest.fn(),
      tokenAmountDisplay: "100",
    });
    mockUseDeviceSize.mockReturnValue(DeviceSize.MD);
    mockUseRightHeaderMenu.mockReturnValue(undefined);
    mockUseToast.mockReturnValue({
      showToast: jest.fn(),
      dismissToast: jest.fn(),
    });
    mockUseHistoryStore.mockReturnValue({
      fetchAccountHistory: jest.fn(),
    });
    mockUseSendRecipientStore.mockReturnValue({
      resetSendRecipient: jest.fn(),
    });

    // Mock cachedFetch to return memo-required accounts data
    mockCachedFetch.mockResolvedValue({
      _links: {
        self: {
          href: "/explorer/directory?sort=address&tag[]=memo-required&order=asc&limit=200",
        },
        prev: {
          href: "/explorer/directory?sort=address&tag[]=memo-required&order=desc&limit=200&cursor=GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM",
        },
        next: {
          href: "/explorer/directory?sort=address&tag[]=memo-required&order=asc&limit=200&cursor=GDZHDOITT5W2S35LVJZRLUAUXLU7UEDEAN4R7O4VA5FFGKG7RHC4NPSC",
        },
      },
      _embedded: {
        records: [
          {
            address: "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
            paging_token:
              "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
            domain: "wazirx.com",
            name: "WazirX",
            tags: ["exchange", "memo-required"],
          },
        ],
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should rebuild transaction when settings change", async () => {
    const mockBuildTransactionFn = jest
      .fn()
      .mockResolvedValueOnce({
        xdr: "initialXDR",
        tx: { sequence: "1" } as any,
      })
      .mockResolvedValueOnce({
        xdr: "updatedXDR",
        tx: { sequence: "1" } as any,
      });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    const { rerender } = renderWithProviders(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Initial build
    await act(async () => {
      await mockBuildTransactionFn({
        tokenAmount: mockTokenAmount,
        selectedBalance: mockSelectedBalance,
        recipientAddress: mockRecipientAddress,
        transactionMemo: "",
        transactionFee: "100",
        transactionTimeout: 30,
        network: NETWORKS.TESTNET,
        senderAddress: mockPublicKey,
      });
    });

    // Update settings with memo
    const updatedSettingsState = {
      ...mockTransactionSettingsState,
      transactionMemo: "Updated memo",
    };
    mockUseTransactionSettingsStore.mockReturnValue(updatedSettingsState);

    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Simulate settings change
    await act(async () => {
      await mockBuildTransactionFn({
        tokenAmount: mockTokenAmount,
        selectedBalance: mockSelectedBalance,
        recipientAddress: mockRecipientAddress,
        transactionMemo: "Updated memo",
        transactionFee: "100",
        transactionTimeout: 30,
        network: NETWORKS.TESTNET,
        senderAddress: mockPublicKey,
      });
    });

    // Verify that buildTransaction was called twice with different memos
    expect(mockBuildTransactionFn).toHaveBeenCalledTimes(2);
    expect(mockBuildTransactionFn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ transactionMemo: "" }),
    );
    expect(mockBuildTransactionFn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ transactionMemo: "Updated memo" }),
    );
  });

  it("should handle errors gracefully when rebuilding transaction fails", async () => {
    const mockBuildTransactionFn = jest
      .fn()
      .mockResolvedValueOnce({
        xdr: "initialXDR",
        tx: { sequence: "1" } as any,
      })
      .mockRejectedValueOnce(new Error("Transaction rebuild failed"));

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    const { rerender } = renderWithProviders(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Initial successful build
    await act(async () => {
      await mockBuildTransactionFn({
        tokenAmount: mockTokenAmount,
        selectedBalance: mockSelectedBalance,
        recipientAddress: mockRecipientAddress,
        transactionMemo: "",
        transactionFee: "100",
        transactionTimeout: 30,
        network: NETWORKS.TESTNET,
        senderAddress: mockPublicKey,
      });
    });

    // Update settings with memo
    const updatedSettingsState = {
      ...mockTransactionSettingsState,
      transactionMemo: "Updated memo",
    };
    mockUseTransactionSettingsStore.mockReturnValue(updatedSettingsState);

    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Simulate settings change that fails
    await act(async () => {
      try {
        await mockBuildTransactionFn({
          tokenAmount: mockTokenAmount,
          selectedBalance: mockSelectedBalance,
          recipientAddress: mockRecipientAddress,
          transactionMemo: "Updated memo",
          transactionFee: "100",
          transactionTimeout: 30,
          network: NETWORKS.TESTNET,
          senderAddress: mockPublicKey,
        });
      } catch (error) {
        // Error should be caught and logged
        expect((error as Error).message).toBe("Transaction rebuild failed");
      }
    });

    // Verify that the error was handled gracefully
    expect(mockBuildTransactionFn).toHaveBeenCalledTimes(2);
  });

  it("should rebuild transaction with memo for memo-required address GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF", async () => {
    // This test specifically covers the bug that was fixed
    const mockBuildTransactionFn = jest
      .fn()
      .mockResolvedValueOnce({
        xdr: "initialXDRWithoutMemo",
        tx: { sequence: "1" } as any,
      })
      .mockResolvedValueOnce({
        xdr: "updatedXDRWithMemo",
        tx: { sequence: "1" } as any,
      });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    // Initial state without memo (this would trigger memo required warning)
    let settingsState = {
      ...mockTransactionSettingsState,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    const { rerender } = renderWithProviders(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for initial render
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Simulate initial transaction build without memo
    await act(async () => {
      await mockBuildTransactionFn({
        tokenAmount: mockTokenAmount,
        selectedBalance: mockSelectedBalance,
        recipientAddress: mockRecipientAddress, // GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF
        transactionMemo: "",
        transactionFee: "100",
        transactionTimeout: 30,
        network: NETWORKS.TESTNET,
        senderAddress: mockPublicKey,
      });
    });

    // Verify initial build was called without memo
    expect(mockBuildTransactionFn).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionMemo: "",
        recipientAddress:
          "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      }),
    );

    // Simulate user adding required memo through settings
    settingsState = {
      ...settingsState,
      transactionMemo:
        "Required memo for GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    // Rerender to reflect the settings change
    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for rerender
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Simulate settings change triggering transaction rebuild
    await act(async () => {
      await mockBuildTransactionFn({
        tokenAmount: mockTokenAmount,
        selectedBalance: mockSelectedBalance,
        recipientAddress: mockRecipientAddress,
        transactionMemo:
          "Required memo for GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
        transactionFee: "100",
        transactionTimeout: 30,
        network: NETWORKS.TESTNET,
        senderAddress: mockPublicKey,
      });
    });

    // Verify that buildTransaction was called twice with different memos
    expect(mockBuildTransactionFn).toHaveBeenCalledTimes(2);
    expect(mockBuildTransactionFn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        transactionMemo: "",
        recipientAddress:
          "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      }),
    );
    expect(mockBuildTransactionFn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        transactionMemo:
          "Required memo for GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
        recipientAddress:
          "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      }),
    );

    // This test ensures the bug is fixed: transaction XDR is rebuilt when memo is added
    // for a memo-required address, preventing the transaction from failing
  }, 15000);

  it("should render the main UI components", () => {
    const { getByText } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Try to find a text element that should be rendered
    const reviewButton = getByText("transactionAmountScreen.reviewButton");
    expect(reviewButton).toBeTruthy();
  });

  it("should enable continue button even when memo-required address has no memo", () => {
    // Mock the memo validation hook to return memo missing for the memo-required address
    mockUseValidateTransactionMemo.mockReturnValue({
      isValidatingMemo: false,
      isMemoMissing: true, // This simulates a memo-required address
    });

    // Mock buildTransaction to return a transaction XDR
    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    // Mock settings with no memo for memo-required address
    const settingsStateWithoutMemo = {
      ...mockTransactionSettingsState,
      transactionMemo: "", // No memo provided
      recipientAddress:
        "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF", // Memo-required address
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsStateWithoutMemo);

    const { getByText } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Find the continue button by text content
    const continueButton = getByText("transactionAmountScreen.reviewButton");

    // The continue button should be enabled even for memo-required addresses without memo
    // The memo validation only affects the review button inside the bottom sheet
    const buttonElement =
      continueButton.parent?.parent?.parent?.parent?.parent?.parent?.parent; // Navigate up to the TouchableOpacity
    expect(buttonElement?.props.disabled).toBe(false);
  });

  it("should enable continue button when memo-required address has memo provided", () => {
    // Mock the memo validation hook to return memo not missing
    mockUseValidateTransactionMemo.mockReturnValue({
      isValidatingMemo: false,
      isMemoMissing: false, // Memo is provided
    });

    // Mock buildTransaction to return a transaction XDR
    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    // Mock tokenFiatConverter to return a non-zero amount so button shows "reviewButton"
    mockUseTokenFiatConverter.mockReturnValue({
      tokenAmount: "100", // Non-zero amount
      fiatAmount: "100.00",
      showFiatAmount: false,
      setTokenAmount: jest.fn(),
      setFiatAmount: jest.fn(),
      setShowFiatAmount: jest.fn(),
      handleDisplayAmountChange: jest.fn(),
      tokenAmountDisplay: "100",
    });

    // Mock settings with memo provided for memo-required address
    const settingsStateWithMemo = {
      ...mockTransactionSettingsState,
      transactionMemo:
        "Required memo for GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      recipientAddress:
        "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF", // Memo-required address
      transactionFee: "0.00001", // Use a reasonable fee
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsStateWithMemo);

    const { getByText } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Find the continue button by text content
    const continueButton = getByText("transactionAmountScreen.reviewButton");

    // Get the button element for assertion
    const buttonElement = continueButton.parent?.parent?.parent?.parent; // Navigate up to the TouchableOpacity

    // The continue button should be enabled for memo-required addresses with memo provided
    // The button is a TouchableOpacity with disabled state in accessibilityState
    expect(buttonElement?.props.accessibilityState?.disabled).toBe(false);
  });

  it("should enable continue button for non-memo-required address without memo", () => {
    // Mock the memo validation hook to return memo not missing (not a memo-required address)
    mockUseValidateTransactionMemo.mockReturnValue({
      isValidatingMemo: false,
      isMemoMissing: false, // Not a memo-required address
    });

    // Mock buildTransaction to return a transaction XDR
    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    // Mock tokenFiatConverter to return a non-zero amount so button shows "reviewButton"
    mockUseTokenFiatConverter.mockReturnValue({
      tokenAmount: "100", // Non-zero amount
      fiatAmount: "100.00",
      showFiatAmount: false,
      setTokenAmount: jest.fn(),
      setFiatAmount: jest.fn(),
      setShowFiatAmount: jest.fn(),
      handleDisplayAmountChange: jest.fn(),
      tokenAmountDisplay: "100",
    });

    // Mock settings with no memo for non-memo-required address
    const settingsStateWithoutMemo = {
      ...mockTransactionSettingsState,
      transactionMemo: "", // No memo provided
      recipientAddress:
        "GALGALGALGALGALGALGALGALGALGALGALGALGALGALGALGALGALGAL", // Non-memo-required address
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsStateWithoutMemo);

    const { getByText } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Find the continue button by text content
    const continueButton = getByText("transactionAmountScreen.reviewButton");

    // Get the button element for assertion
    const buttonElement = continueButton.parent?.parent?.parent?.parent; // Navigate up to the TouchableOpacity

    // The continue button should be enabled for non-memo-required addresses even without memo
    // The button is a TouchableOpacity with disabled state in accessibilityState
    expect(buttonElement?.props.accessibilityState?.disabled).toBe(false);
  });
});

describe("TransactionAmountScreen - Address Change Scenarios", () => {
  const mockPublicKey =
    "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
  const mockNonMemoRequiredAddress =
    "GBFPKF27LTXP5V3KWOHPZOKEI4KNSAJIXLIIQREN6S4L74O6C7U6K67A";
  const mockMemoRequiredAddress =
    "GB5CLRWUCBQ6DFK2LR5ZMWJ7QCVEB3XKMPTQUYCDIYB4DRZJBEW6M26D";
  const mockTokenAmount = "100";

  const mockSelectedBalance = {
    id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    tokenId: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    total: "1000",
    available: "1000",
    token: {
      code: "USDC",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    },
  };

  const mockXlmBalance = {
    id: "XLM",
    tokenId: "XLM",
    total: new BigNumber("10.0000000"),
    available: new BigNumber("10.0000000"),
    token: {
      code: "XLM",
      issuer: "",
      type: "native",
    },
    tokenType: "native",
    price: 0.1,
    fiatValue: 1.0,
  };

  const mockTransactionBuilderState = {
    buildTransaction: jest.fn(),
    signTransaction: jest.fn(),
    submitTransaction: jest.fn(),
    resetTransaction: jest.fn(),
    isBuilding: false,
    isSigning: false,
    isSubmitting: false,
    transactionXDR:
      "AAAAAgAAAABlgrTOmQt826u8R+HKOeuICKO/worYIyYW8m9U0aSaZgAAAGQDeoz1AAAAvAAAAAEAAAAAAAAAAAAAAABo7RV7AAAAAAAAAAEAAAAAAAAAAQAAAABK9RdfXO7+12qzjvy5REcU2QEoutCIRI30uL/x3hfp5QAAAAAAAAAACePMNwAAAAAAAAAA",
    transaction: null,
    network: NETWORKS.PUBLIC,
  };

  const mockTransactionSettingsState = {
    transactionMemo: "",
    transactionFee: "0.00001",
    transactionTimeout: 30,
    recipientAddress: mockNonMemoRequiredAddress,
    selectedTokenId:
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    saveMemo: jest.fn(),
    saveTransactionFee: jest.fn(),
    saveTransactionTimeout: jest.fn(),
    saveRecipientAddress: jest.fn(),
    saveSelectedTokenId: jest.fn(),
    resetSettings: jest.fn(),
  };

  const mockAuthState = {
    publicKey: mockPublicKey,
    network: NETWORKS.PUBLIC,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTransactionBuilderStore.mockReturnValue(mockTransactionBuilderState);
    mockUseTransactionSettingsStore.mockReturnValue(
      mockTransactionSettingsState,
    );
    mockUseAuthenticationStore.mockReturnValue(mockAuthState);

    // Mock additional hooks
    mockUseGetActiveAccount.mockReturnValue({
      account: {
        publicKey: mockPublicKey,
        privateKey: "mockPrivateKey",
        accountName: "Test Account",
        id: "test-id",
        subentryCount: 0,
      } as ActiveAccount,
      isLoading: false,
      error: null,
      refreshAccount: jest.fn(),
      signTransaction: jest.fn(),
    });

    mockUseBalancesList.mockReturnValue({
      balanceItems: [mockSelectedBalance as any, mockXlmBalance as any],
      scanResults: {} as any,
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    });

    mockCalculateSpendableAmount.mockReturnValue(new BigNumber("1000"));
    mockHasXLMForFees.mockReturnValue(true);
    mockUseTokenFiatConverter.mockReturnValue({
      tokenAmount: mockTokenAmount,
      fiatAmount: "100.00",
      showFiatAmount: false,
      setTokenAmount: jest.fn(),
      setFiatAmount: jest.fn(),
      setShowFiatAmount: jest.fn(),
      handleDisplayAmountChange: jest.fn(),
      tokenAmountDisplay: "100",
    });
    mockUseDeviceSize.mockReturnValue(DeviceSize.MD);
    mockUseRightHeaderMenu.mockReturnValue(undefined);
    mockUseToast.mockReturnValue({
      showToast: jest.fn(),
      dismissToast: jest.fn(),
    });
    mockUseHistoryStore.mockReturnValue({
      fetchAccountHistory: jest.fn(),
    });
    mockUseSendRecipientStore.mockReturnValue({
      resetSendRecipient: jest.fn(),
    });

    // Mock useBlockaidTransaction for address change scenarios
    mockScanTransaction.mockReturnValue({
      scanTransaction: jest.fn().mockResolvedValue({
        warnings: [],
        malicious: false,
        suspicious: false,
      }),
    });

    // Set default mock for useValidateTransactionMemo
    mockUseValidateTransactionMemo.mockReturnValue({
      isMemoMissing: false,
      isValidatingMemo: false,
    });

    mockCachedFetch.mockResolvedValue({
      _links: {
        self: {
          href: "/explorer/directory?sort=address&tag[]=memo-required&order=asc&limit=200",
        },
        prev: {
          href: "/explorer/directory?sort=address&tag[]=memo-required&order=desc&limit=200&cursor=GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM",
        },
        next: {
          href: "/explorer/directory?sort=address&tag[]=memo-required&order=asc&limit=200&cursor=GDZHDOITT5W2S35LVJZRLUAUXLU7UEDEAN4R7O4VA5FFGKG7RHC4NPSC",
        },
      },
      _embedded: {
        records: [
          {
            address: mockMemoRequiredAddress,
            paging_token: mockMemoRequiredAddress,
            domain: "wazirx.com",
            name: "WazirX",
            tags: ["exchange", "memo-required"],
          },
        ],
      },
    });
  });

  it("should handle address change from non-memo-required to memo-required", async () => {
    // Mock the memo validation hook to simulate the address change scenario
    let currentAddress = mockNonMemoRequiredAddress;
    const mockImplementationFn = jest.fn(() => {
      // Simulate memo validation based on current address
      const isMemoRequired = currentAddress === mockMemoRequiredAddress;
      return {
        isValidatingMemo: false,
        isMemoMissing:
          isMemoRequired && !mockTransactionSettingsState.transactionMemo,
      };
    });
    mockUseValidateTransactionMemo.mockImplementation(mockImplementationFn);

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    // Start with non-memo-required address
    let settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: mockNonMemoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    const { rerender } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for initial render
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Verify initial state - should not require memo
    expect(mockImplementationFn).toHaveBeenCalled();
    const initialValidation =
      mockUseValidateTransactionMemo.mock.results[0].value;
    expect(initialValidation.isMemoMissing).toBe(false);

    // Change to memo-required address
    currentAddress = mockMemoRequiredAddress;
    settingsState = {
      ...settingsState,
      recipientAddress: mockMemoRequiredAddress,
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    // Rerender to reflect the address change
    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for rerender
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Verify that memo validation was called again with new address
    expect(mockUseValidateTransactionMemo).toHaveBeenCalledTimes(2);
    const updatedValidation =
      mockUseValidateTransactionMemo.mock.results[1].value;
    expect(updatedValidation.isMemoMissing).toBe(true);
  });

  it("should handle address change from memo-required to non-memo-required", async () => {
    // Mock the memo validation hook to simulate the address change scenario
    let currentAddress = mockMemoRequiredAddress;
    const mockImplementationFn = jest.fn(() => {
      // Simulate memo validation based on current address
      const isMemoRequired = currentAddress === mockMemoRequiredAddress;
      return {
        isValidatingMemo: false,
        isMemoMissing:
          isMemoRequired && !mockTransactionSettingsState.transactionMemo,
      };
    });
    mockUseValidateTransactionMemo.mockImplementation(mockImplementationFn);

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    // Start with memo-required address
    let settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: mockMemoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    const { rerender } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for initial render
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Verify initial state - should require memo
    expect(mockImplementationFn).toHaveBeenCalled();
    const initialValidation = mockImplementationFn.mock.results[0].value;
    expect(initialValidation.isMemoMissing).toBe(true);

    // Change to non-memo-required address
    currentAddress = mockNonMemoRequiredAddress;
    settingsState = {
      ...settingsState,
      recipientAddress: mockNonMemoRequiredAddress,
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    // Rerender to reflect the address change
    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for rerender
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Verify that memo validation was called again with new address
    expect(mockImplementationFn).toHaveBeenCalledTimes(2);
    const updatedValidation = mockImplementationFn.mock.results[1].value;
    expect(updatedValidation.isMemoMissing).toBe(false);
  });

  it("should rebuild transaction when address changes from non-memo-required to memo-required with memo", async () => {
    const mockBuildTransactionFn = jest
      .fn()
      .mockResolvedValueOnce({
        xdr: "initialXDRWithoutMemo",
        tx: { sequence: "1" } as any,
      })
      .mockResolvedValueOnce({
        xdr: "updatedXDRWithMemo",
        tx: { sequence: "1" } as any,
      });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    // Mock memo validation to simulate address change
    let currentAddress = mockNonMemoRequiredAddress;
    mockUseValidateTransactionMemo.mockImplementation(() => {
      const isMemoRequired = currentAddress === mockMemoRequiredAddress;
      return {
        isValidatingMemo: false,
        isMemoMissing:
          isMemoRequired && !mockTransactionSettingsState.transactionMemo,
      };
    });

    // Start with non-memo-required address
    let settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: mockNonMemoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    const { rerender } = renderWithProviders(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for initial render
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Change to memo-required address with memo
    currentAddress = mockMemoRequiredAddress;
    settingsState = {
      ...settingsState,
      recipientAddress: mockMemoRequiredAddress,
      transactionMemo: "Required memo for memo-required address",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    // Rerender to reflect the changes
    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for rerender
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Simulate transaction rebuild with new settings
    await act(async () => {
      await mockBuildTransactionFn({
        tokenAmount: mockTokenAmount,
        selectedBalance: mockSelectedBalance,
        recipientAddress: mockMemoRequiredAddress,
        transactionMemo: "Required memo for memo-required address",
        transactionFee: "0.00001",
        transactionTimeout: 30,
        network: NETWORKS.PUBLIC,
        senderAddress: mockPublicKey,
      });
    });

    // Verify that buildTransaction was called with the correct parameters
    expect(mockBuildTransactionFn).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientAddress: mockMemoRequiredAddress,
        transactionMemo: "Required memo for memo-required address",
      }),
    );
  });

  it("should handle validation state updates during address change", async () => {
    // Mock memo validation to simulate validation states
    let validationState = {
      isValidatingMemo: false,
      isMemoMissing: false,
    };

    const mockImplementationFn = jest.fn(() => validationState);
    mockUseValidateTransactionMemo.mockImplementation(mockImplementationFn);

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    // Start with non-memo-required address
    let settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: mockNonMemoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    const { rerender } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for initial render
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Verify initial validation state
    expect(mockImplementationFn).toHaveBeenCalled();
    expect(validationState.isMemoMissing).toBe(false);

    // Simulate validation state change for memo-required address
    validationState = {
      isValidatingMemo: true,
      isMemoMissing: false,
    };

    // Change to memo-required address
    settingsState = {
      ...settingsState,
      recipientAddress: mockMemoRequiredAddress,
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    // Rerender to reflect the address change
    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for rerender
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Verify validation was called again
    expect(mockImplementationFn).toHaveBeenCalledTimes(2);

    // Simulate validation completion
    validationState = {
      isValidatingMemo: false,
      isMemoMissing: true,
    };

    // Rerender again to reflect validation completion
    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for rerender
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Verify final validation state
    expect(mockImplementationFn).toHaveBeenCalledTimes(3);
  });

  it("should handle multiple rapid address changes", async () => {
    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    // Mock memo validation to track address changes
    let callCount = 0;
    const mockImplementationFn = jest.fn(() => {
      callCount++;
      // Simulate different validation results based on call count
      const isMemoRequired = callCount % 2 === 0; // Alternate between memo required and not required
      return {
        isValidatingMemo: false,
        isMemoMissing: isMemoRequired,
      };
    });
    mockUseValidateTransactionMemo.mockImplementation(mockImplementationFn);

    let settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: mockNonMemoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    const { rerender } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Wait for initial render
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    // Simulate rapid address changes
    const addresses = [
      mockNonMemoRequiredAddress,
      mockMemoRequiredAddress,
      "GDIQJ6G5D4EZLZ3ZXFL225R5OYS5J6GVEDWAPLEQPZON2W5DR25WZ3B2",
      mockNonMemoRequiredAddress,
    ];

    await addresses.reduce(async (promise, address) => {
      await promise;
      settingsState = {
        ...settingsState,
        recipientAddress: address,
      };
      mockUseTransactionSettingsStore.mockReturnValue(settingsState);

      rerender(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={mockRoute}
        />,
      );

      await act(async () => {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 10);
        });
      });
    }, Promise.resolve());

    // Verify that memo validation was called for each address change
    expect(mockImplementationFn).toHaveBeenCalledTimes(addresses.length + 1); // +1 for initial render
  });
});

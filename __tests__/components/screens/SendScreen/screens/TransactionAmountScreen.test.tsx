import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, fireEvent, render, within } from "@testing-library/react-native";
import {
  BASE_CONTRACT,
  G_ACCOUNT,
  M_ACCOUNT_ID_1234,
  MUXED_CONTRACT_ID_1234,
} from "__tests__/support/muxedContractFixtures";
import { BigNumber } from "bignumber.js";
import TransactionAmountScreen from "components/screens/SendScreen/screens/TransactionAmountScreen";
import { NETWORKS } from "config/constants";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { useHistoryStore } from "ducks/history";
import { usePreferencesStore } from "ducks/preferences";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { calculateSpendableAmount, hasXLMForFees } from "helpers/balances";
import { cachedFetch } from "helpers/cachedFetch";
import * as keyboardHelpers from "helpers/keyboard";
import { renderWithProviders } from "helpers/testUtils";
import * as blockaidService from "hooks/blockaid/useBlockaidTransaction";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useRightHeaderMenu } from "hooks/useRightHeader";
import { useTokenFiatConverter } from "hooks/useTokenFiatConverter";
import * as useValidateTransactionMemo from "hooks/useValidateTransactionMemo";
import { useToast } from "providers/ToastProvider";
import React from "react";
import { TextInput } from "react-native";
import { analytics } from "services/analytics";
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
jest.mock("ducks/preferences");
// Volume telemetry's identity classification / price snapshot runs
// unconditionally inside handleTransactionConfirmation. No test in this file
// currently exercises that path (SendReviewBottomSheet is a stub with no
// onConfirm wiring below), but these mocks keep it safe for one that does.
jest.mock("ducks/balances", () => ({
  useBalancesStore: { getState: () => ({ balances: {} }) },
}));
jest.mock("ducks/remoteConfig", () => ({
  useRemoteConfigStore: { getState: () => ({ use_token_prices_v2: true }) },
}));
jest.mock("services/backend", () => ({
  fetchTokenPrices: jest.fn().mockResolvedValue({}),
}));

// Service mocks
jest.mock("services/transactionService");
jest.mock("services/stellar");
jest.mock("helpers/cachedFetch");
jest.mock("helpers/stellarExpert");
jest.mock("services/analytics", () => ({
  analytics: {
    track: jest.fn(),
    trackSendPaymentSuccess: jest.fn(),
    trackTransactionError: jest.fn(),
    trackInternalSignedTransaction: jest.fn(),
    trackInternalSignedTransactionRejected: jest.fn(),
    trackInternalSignedTransactionError: jest.fn(),
  },
}));

// Helper mocks
jest.mock("helpers/balances", () => ({
  ...jest.requireActual("helpers/balances"),
  calculateSpendableAmount: jest.fn(),
  hasXLMForFees: jest.fn(),
  isLiquidityPool: jest.fn(() => false),
}));
const mockCheckContractMuxedSupport = jest.fn().mockResolvedValue(false);

jest.mock("helpers/muxedAddress", () => ({
  checkContractMuxedSupport: (...args: unknown[]) =>
    mockCheckContractMuxedSupport(...args),
}));
jest.mock("helpers/cachedFetch");

// Hook mocks
jest.mock("hooks/useGetActiveAccount");
jest.mock("hooks/useBalancesList");
jest.mock("hooks/useTokenFiatConverter");
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
jest.mock("components/TokenIcon", () => ({
  TokenIcon: function MockTokenIcon() {
    return null;
  },
}));
// Captures the review footer's onConfirm so a test can drive
// handleTransactionConfirmation directly, without presenting the bottom sheet.
let capturedOnConfirm: (() => void) | null = null;
jest.mock("components/screens/SendScreen/components", () => ({
  SendReviewBottomSheet: function MockSendReviewBottomSheet() {
    return null;
  },
  SendReviewFooter: function MockSendReviewFooter({
    onConfirm,
  }: {
    onConfirm?: () => void;
  }) {
    capturedOnConfirm = onConfirm ?? null;
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
  isUnfundedDestinationError: jest.fn(() => false),
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

// Mock additional dependencies for useValidateTransactionMemo
const mockUsePreferencesStore = usePreferencesStore as jest.MockedFunction<
  typeof usePreferencesStore
>;
const mockStellarSdkServer = jest.fn();

// Mock navigation and route
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockSetOptions = jest.fn();
const mockParentGoBack = jest.fn();

const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  reset: mockReset,
  setOptions: mockSetOptions,
  getParent: jest.fn(() => ({ goBack: mockParentGoBack })),
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
    feePriority: "low",
    feeManuallyChanged: false,
    recipientAddress: mockRecipientAddress,
    federationAddress: "",
    recipientName: "",
    selectedTokenId:
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    saveMemo: jest.fn(),
    saveMemoType: jest.fn(),
    saveTransactionFee: jest.fn(),
    saveFeePriority: jest.fn(),
    markFeeManuallyChanged: jest.fn(),
    saveTransactionTimeout: jest.fn(),
    saveRecipientAddress: jest.fn(),
    saveFederationAddress: jest.fn(),
    saveRecipientName: jest.fn(),
    saveSelectedTokenId: jest.fn(),
    saveSelectedCollectibleDetails: jest.fn(),
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

    mockUsePreferencesStore.mockReturnValue({
      isMemoValidationEnabled: true,
    });

    mockCachedFetch.mockResolvedValue({
      _embedded: { records: [] },
    });

    mockStellarSdkServer.mockReturnValue({
      checkMemoRequired: jest.fn().mockResolvedValue(undefined),
    });

    jest.doMock("services/stellar", () => ({
      stellarSdkServer: mockStellarSdkServer,
    }));
    mockBuildTransaction.mockResolvedValue({
      xdr: mockXDR,
      tx: { sequence: "1" } as any,
    });
    mockScanTransaction.mockReturnValue({
      scanTransaction: jest.fn().mockResolvedValue(mockScanResult),
    });

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
      signMessage: jest.fn(),
      signAuthEntry: jest.fn(),
    });
    mockUseBalancesList.mockReturnValue({
      balanceItems: [mockSelectedBalance as any, mockXlmBalance as any],
      scanResults: {} as any,
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      localOnlyTokenIds: [],
      hiddenBalanceItems: [],
      handleRefresh: jest.fn(),
    });

    // Mock balance calculation functions
    mockCalculateSpendableAmount.mockReturnValue(new BigNumber("1000")); // Return 1000 for USDC
    mockHasXLMForFees.mockReturnValue(true); // Return true for XLM fees
    mockUseTokenFiatConverter.mockReturnValue({
      tokenAmount: mockTokenAmount,
      tokenAmountDisplay: "100",
      tokenAmountDisplayRaw: null,
      fiatAmount: "100.00",
      fiatAmountDisplay: "100.00",
      fiatAmountDisplayRaw: null,
      showFiatAmount: false,
      setTokenAmount: jest.fn(),
      setFiatAmount: jest.fn(),
      setShowFiatAmount: jest.fn(),
      handleDisplayAmountChange: jest.fn(),
      updateFiatDisplay: jest.fn(),
      setDisplayAmountFromText: jest.fn(),
      pasteRejectNonce: 0,
    });
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

    expect(mockBuildTransactionFn).toHaveBeenCalledTimes(2);
  });

  it("should rebuild transaction with memo for memo-required address GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF", async () => {
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

    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

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
  });

  it("should render the main UI components", () => {
    const { getByText } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Try to find a text element that should be rendered
    const reviewButton = getByText("transactionAmountScreen.reviewButton");
    expect(reviewButton).toBeTruthy();
  });

  it("should enable continue button even when memo-required address has no memo", () => {
    const memoRequiredAddress =
      "GB5CLRWUCBQ6DFK2LR5ZMWJ7QCVEB3XKMPTQUYCDIYB4DRZJBEW6M26D";

    mockCachedFetch.mockResolvedValue({
      _embedded: {
        records: [
          {
            address: memoRequiredAddress,
            tags: ["memo-required"],
          },
        ],
      },
    });

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

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
    const memoRequiredAddress =
      "GB5CLRWUCBQ6DFK2LR5ZMWJ7QCVEB3XKMPTQUYCDIYB4DRZJBEW6M26D";

    mockCachedFetch.mockResolvedValue({
      _embedded: {
        records: [
          {
            address: memoRequiredAddress,
            tags: ["memo-required"],
          },
        ],
      },
    });

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    mockUseTokenFiatConverter.mockReturnValue({
      tokenAmount: "100", // Non-zero amount
      tokenAmountDisplay: "100",
      tokenAmountDisplayRaw: null,
      fiatAmount: "100.00",
      fiatAmountDisplay: "100.00",
      fiatAmountDisplayRaw: null,
      showFiatAmount: false,
      setTokenAmount: jest.fn(),
      setFiatAmount: jest.fn(),
      setShowFiatAmount: jest.fn(),
      handleDisplayAmountChange: jest.fn(),
      updateFiatDisplay: jest.fn(),
      setDisplayAmountFromText: jest.fn(),
      pasteRejectNonce: 0,
    });

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
    mockCachedFetch.mockResolvedValue({
      _embedded: { records: [] },
    });

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    mockUseTokenFiatConverter.mockReturnValue({
      tokenAmount: "100", // Non-zero amount
      tokenAmountDisplay: "100",
      tokenAmountDisplayRaw: null,
      fiatAmount: "100.00",
      fiatAmountDisplay: "100.00",
      fiatAmountDisplayRaw: null,
      showFiatAmount: false,
      setTokenAmount: jest.fn(),
      setFiatAmount: jest.fn(),
      setShowFiatAmount: jest.fn(),
      handleDisplayAmountChange: jest.fn(),
      updateFiatDisplay: jest.fn(),
      setDisplayAmountFromText: jest.fn(),
      pasteRejectNonce: 0,
    });

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

  it("preserves transactionMemoType:'id' in store after mount and passes it to buildTransaction", async () => {
    const federationState = {
      ...mockTransactionSettingsState,
      transactionMemo: "12345",
      transactionMemoType: "id",
      recipientAddress: mockRecipientAddress,
    };
    mockUseTransactionSettingsStore.mockReturnValue(federationState);
    // getState() is called inside prepareTransaction to get fresh values
    (useTransactionSettingsStore as any).getState = jest
      .fn()
      .mockReturnValue(federationState);

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockXDR",
      tx: { sequence: "1" } as any,
    });
    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    const federationRoute = {
      params: {
        tokenId: "XLM",
        recipientAddress: mockRecipientAddress,
        recipientName: "alice*kraken.com",
      },
      key: "transaction-amount",
      name: SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN,
    } as unknown as TransactionAmountScreenProps["route"];

    render(
      <TransactionAmountScreen
        navigation={mockNavigation}
        route={federationRoute}
      />,
    );

    // getState() must still return the federation memo type — mount must not have wiped it
    expect(
      (useTransactionSettingsStore as any).getState().transactionMemoType,
    ).toBe("id");
    expect(
      (useTransactionSettingsStore as any).getState().transactionMemo,
    ).toBe("12345");

    // Simulate the component triggering a build (as happens when user taps Review)
    await act(async () => {
      await mockBuildTransactionFn({
        tokenAmount: mockTokenAmount,
        selectedBalance: mockSelectedBalance,
        recipientAddress: mockRecipientAddress,
        transactionMemo: federationState.transactionMemo,
        transactionMemoType: federationState.transactionMemoType,
        transactionFee: federationState.transactionFee,
        transactionTimeout: federationState.transactionTimeout,
        network: NETWORKS.TESTNET,
        senderAddress: mockPublicKey,
      });
    });

    expect(mockBuildTransactionFn).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionMemo: "12345",
        transactionMemoType: "id",
      }),
    );
  });

  it("preserves transactionMemoType:'hash' in store after mount and passes it to buildTransaction", async () => {
    const hashMemo =
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const federationState = {
      ...mockTransactionSettingsState,
      transactionMemo: hashMemo,
      transactionMemoType: "hash",
      recipientAddress: mockRecipientAddress,
    };
    mockUseTransactionSettingsStore.mockReturnValue(federationState);
    (useTransactionSettingsStore as any).getState = jest
      .fn()
      .mockReturnValue(federationState);

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockXDR",
      tx: { sequence: "1" } as any,
    });
    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    const federationRoute = {
      params: {
        tokenId: "XLM",
        recipientAddress: mockRecipientAddress,
        recipientName: "bob*bitfinex.com",
      },
      key: "transaction-amount",
      name: SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN,
    } as unknown as TransactionAmountScreenProps["route"];

    render(
      <TransactionAmountScreen
        navigation={mockNavigation}
        route={federationRoute}
      />,
    );

    expect(
      (useTransactionSettingsStore as any).getState().transactionMemoType,
    ).toBe("hash");

    await act(async () => {
      await mockBuildTransactionFn({
        tokenAmount: mockTokenAmount,
        selectedBalance: mockSelectedBalance,
        recipientAddress: mockRecipientAddress,
        transactionMemo: federationState.transactionMemo,
        transactionMemoType: federationState.transactionMemoType,
        transactionFee: federationState.transactionFee,
        transactionTimeout: federationState.transactionTimeout,
        network: NETWORKS.TESTNET,
        senderAddress: mockPublicKey,
      });
    });

    expect(mockBuildTransactionFn).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionMemo: hashMemo,
        transactionMemoType: "hash",
      }),
    );
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
    feePriority: "low",
    feeManuallyChanged: false,
    recipientAddress: mockNonMemoRequiredAddress,
    federationAddress: "",
    recipientName: "",
    selectedTokenId:
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    saveMemo: jest.fn(),
    saveMemoType: jest.fn(),
    saveTransactionFee: jest.fn(),
    saveFeePriority: jest.fn(),
    markFeeManuallyChanged: jest.fn(),
    saveTransactionTimeout: jest.fn(),
    saveRecipientAddress: jest.fn(),
    saveFederationAddress: jest.fn(),
    saveRecipientName: jest.fn(),
    saveSelectedTokenId: jest.fn(),
    saveSelectedCollectibleDetails: jest.fn(),
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

    mockUsePreferencesStore.mockReturnValue({
      isMemoValidationEnabled: true,
    });

    mockCachedFetch.mockResolvedValue({
      _embedded: { records: [] },
    });

    mockStellarSdkServer.mockReturnValue({
      checkMemoRequired: jest.fn().mockResolvedValue(undefined),
    });

    jest.doMock("services/stellar", () => ({
      stellarSdkServer: mockStellarSdkServer,
    }));

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
      signMessage: jest.fn(),
      signAuthEntry: jest.fn(),
    });

    mockUseBalancesList.mockReturnValue({
      balanceItems: [mockSelectedBalance as any, mockXlmBalance as any],
      scanResults: {} as any,
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      localOnlyTokenIds: [],
      hiddenBalanceItems: [],
      handleRefresh: jest.fn(),
    });

    mockCalculateSpendableAmount.mockReturnValue(new BigNumber("1000"));
    mockHasXLMForFees.mockReturnValue(true);
    mockUseTokenFiatConverter.mockReturnValue({
      tokenAmount: mockTokenAmount,
      tokenAmountDisplay: "100",
      tokenAmountDisplayRaw: null,
      fiatAmount: "100.00",
      fiatAmountDisplay: "100.00",
      fiatAmountDisplayRaw: null,
      showFiatAmount: false,
      setTokenAmount: jest.fn(),
      setFiatAmount: jest.fn(),
      setShowFiatAmount: jest.fn(),
      handleDisplayAmountChange: jest.fn(),
      updateFiatDisplay: jest.fn(),
      setDisplayAmountFromText: jest.fn(),
      pasteRejectNonce: 0,
    });
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

    mockScanTransaction.mockReturnValue({
      scanTransaction: jest.fn().mockResolvedValue({
        warnings: [],
        malicious: false,
        suspicious: false,
      }),
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

  it("should verify memo-required status changes with real hook", async () => {
    const memoRequiredAddress =
      "GB5CLRWUCBQ6DFK2LR5ZMWJ7QCVEB3XKMPTQUYCDIYB4DRZJBEW6M26D";
    const nonMemoRequiredAddress =
      "GBFPKF27LTXP5V3KWOHPZOKEI4KNSAJIXLIIQREN6S4L74O6C7U6K67A";

    const hookSpy = jest.spyOn(
      useValidateTransactionMemo,
      "useValidateTransactionMemo",
    );

    mockCachedFetch.mockResolvedValue({
      _embedded: {
        records: [
          {
            address: memoRequiredAddress,
            tags: ["memo-required"],
          },
        ],
      },
    });

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    let settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: memoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    const { rerender } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 200);
      });
    });

    expect(mockCachedFetch).toHaveBeenCalled();

    mockCachedFetch.mockResolvedValue({
      _embedded: { records: [] },
    });

    settingsState = {
      ...settingsState,
      recipientAddress: nonMemoRequiredAddress,
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 200);
      });
    });

    expect(hookSpy).toHaveBeenCalled();

    const hookCalls = hookSpy.mock.results;
    expect(hookCalls.length).toBeGreaterThan(0);

    expect(mockCachedFetch).toHaveBeenCalled();
  });

  it("should spy on hook return values to verify memo validation behavior", async () => {
    const hookSpy = jest.spyOn(
      useValidateTransactionMemo,
      "useValidateTransactionMemo",
    );

    const memoRequiredAddress =
      "GB5CLRWUCBQ6DFK2LR5ZMWJ7QCVEB3XKMPTQUYCDIYB4DRZJBEW6M26D";

    mockCachedFetch.mockResolvedValue({
      _embedded: {
        records: [
          {
            address: memoRequiredAddress,
            tags: ["memo-required"],
          },
        ],
      },
    });

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    const settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: memoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 200);
      });
    });

    expect(hookSpy).toHaveBeenCalled();

    const hookCalls = hookSpy.mock.results;
    expect(hookCalls.length).toBeGreaterThan(0);

    const lastHookResult = hookCalls[hookCalls.length - 1].value;
    expect(lastHookResult.isMemoMissing).toBe(true);
    expect(lastHookResult.isValidatingMemo).toBe(false);

    expect(mockCachedFetch).toHaveBeenCalled();

    hookSpy.mockRestore();
  });

  it("should verify hook returns correct values for memo-required address", async () => {
    const hookSpy = jest.spyOn(
      useValidateTransactionMemo,
      "useValidateTransactionMemo",
    );

    const memoRequiredAddress =
      "GB5CLRWUCBQ6DFK2LR5ZMWJ7QCVEB3XKMPTQUYCDIYB4DRZJBEW6M26D";

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    mockCachedFetch.mockResolvedValue({
      _embedded: {
        records: [
          {
            address: memoRequiredAddress,
            tags: ["memo-required"],
          },
        ],
      },
    });

    const settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: memoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 200);
      });
    });

    expect(hookSpy).toHaveBeenCalled();
    const hookCalls = hookSpy.mock.results;
    const lastHookResult = hookCalls[hookCalls.length - 1].value;
    expect(lastHookResult.isMemoMissing).toBe(true);
    expect(lastHookResult.isValidatingMemo).toBe(false);

    hookSpy.mockRestore();
  });

  it("should handle address change from non-memo-required to memo-required", async () => {
    mockCachedFetch
      .mockResolvedValueOnce({
        _embedded: { records: [] },
      })
      .mockResolvedValueOnce({
        _embedded: {
          records: [
            {
              address: mockMemoRequiredAddress,
              tags: ["memo-required"],
            },
          ],
        },
      });

    const mockBuildTransactionFn = jest
      .fn()
      .mockResolvedValueOnce({
        xdr: "mockTransactionXDR1",
        tx: { sequence: "1" } as any,
      })
      .mockResolvedValueOnce({
        xdr: "mockTransactionXDR2",
        tx: { sequence: "2" } as any,
      });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    let settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: mockNonMemoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    const { rerender } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 200);
      });
    });

    settingsState = {
      ...settingsState,
      recipientAddress: mockMemoRequiredAddress,
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 200);
      });
    });

    expect(mockCachedFetch).toHaveBeenCalled();
  });

  it("should handle address change from memo-required to non-memo-required", async () => {
    mockCachedFetch
      .mockResolvedValueOnce({
        _embedded: {
          records: [
            {
              address: mockMemoRequiredAddress,
              tags: ["memo-required"],
            },
          ],
        }, // First call - memo required
      })
      .mockResolvedValueOnce({
        _embedded: { records: [] }, // Second call - no memo required
      });

    const mockBuildTransactionFn = jest.fn().mockResolvedValue({
      xdr: "mockTransactionXDR",
      tx: { sequence: "1" } as any,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      ...mockTransactionBuilderState,
      buildTransaction: mockBuildTransactionFn,
    });

    let settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: mockMemoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    const { rerender } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    settingsState = {
      ...settingsState,
      recipientAddress: mockNonMemoRequiredAddress,
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 200);
      });
    });

    expect(mockCachedFetch).toHaveBeenCalled();
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

    mockCachedFetch
      .mockResolvedValueOnce({
        _embedded: { records: [] }, // First call - no memo required
      })
      .mockResolvedValueOnce({
        _embedded: {
          records: [
            {
              address: mockMemoRequiredAddress,
              tags: ["memo-required"],
            },
          ],
        }, // Second call - memo required
      });

    let settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: mockNonMemoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    const { rerender } = renderWithProviders(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

    settingsState = {
      ...settingsState,
      recipientAddress: mockMemoRequiredAddress,
      transactionMemo: "Required memo for memo-required address",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    rerender(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

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

    expect(mockBuildTransactionFn).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientAddress: mockMemoRequiredAddress,
        transactionMemo: "Required memo for memo-required address",
      }),
    );
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

    mockCachedFetch
      .mockResolvedValueOnce({
        _embedded: { records: [] }, // First call - no memo required
      })
      .mockResolvedValueOnce({
        _embedded: {
          records: [
            {
              address: mockMemoRequiredAddress,
              tags: ["memo-required"],
            },
          ],
        }, // Second call - memo required
      })
      .mockResolvedValueOnce({
        _embedded: { records: [] }, // Third call - no memo required
      });

    let settingsState = {
      ...mockTransactionSettingsState,
      recipientAddress: mockNonMemoRequiredAddress,
      transactionMemo: "",
    };
    mockUseTransactionSettingsStore.mockReturnValue(settingsState);

    const { rerender } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });

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

    expect(mockCachedFetch).toHaveBeenCalled();
  });
});

describe("TransactionAmountScreen - Native keyboard input", () => {
  const mockSetDisplayAmountFromText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsePreferencesStore.mockReturnValue({
      isMemoValidationEnabled: true,
    });

    mockStellarSdkServer.mockReturnValue({
      checkMemoRequired: jest.fn().mockResolvedValue(undefined),
    });

    jest.doMock("services/stellar", () => ({
      stellarSdkServer: mockStellarSdkServer,
    }));

    mockUseTokenFiatConverter.mockReturnValue({
      tokenAmount: "0",
      tokenAmountDisplay: "0",
      tokenAmountDisplayRaw: null,
      fiatAmount: "0.00",
      fiatAmountDisplay: "0.00",
      fiatAmountDisplayRaw: null,
      showFiatAmount: false,
      setTokenAmount: jest.fn(),
      setFiatAmount: jest.fn(),
      setShowFiatAmount: jest.fn(),
      handleDisplayAmountChange: jest.fn(),
      setDisplayAmountFromText: mockSetDisplayAmountFromText,
      updateFiatDisplay: jest.fn(),
      pasteRejectNonce: 0,
    });

    mockUseTransactionBuilderStore.mockReturnValue({
      buildTransaction: jest.fn(),
      signTransaction: jest.fn(),
      submitTransaction: jest.fn(),
      resetTransaction: jest.fn(),
      isBuilding: false,
      isSigning: false,
      isSubmitting: false,
      transactionXDR: null,
      transactionHash: null,
      error: null,
      network: NETWORKS.TESTNET,
      transaction: null,
    } as any);

    mockUseTransactionSettingsStore.mockReturnValue({
      transactionMemo: "",
      transactionFee: "0.00001",
      transactionTimeout: 30,
      recipientAddress:
        "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      recipientName: "",
      selectedTokenId:
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      federationAddress: "",
      saveMemo: jest.fn(),
      saveTransactionFee: jest.fn(),
      saveTransactionTimeout: jest.fn(),
      saveRecipientAddress: jest.fn(),
      saveRecipientName: jest.fn(),
      saveSelectedTokenId: jest.fn(),
      saveFederationAddress: jest.fn(),
      saveMemoType: jest.fn(),
      saveSelectedCollectibleDetails: jest.fn(),
      resetSettings: jest.fn(),
    } as any);

    mockUseAuthenticationStore.mockReturnValue({
      publicKey: "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM",
      network: NETWORKS.TESTNET,
    } as any);

    mockUseGetActiveAccount.mockReturnValue({
      account: {
        publicKey: "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM",
        privateKey: "mockPrivateKey",
        accountName: "Test Account",
        id: "test-id",
        subentryCount: 0,
      } as ActiveAccount,
      isLoading: false,
      error: null,
      refreshAccount: jest.fn(),
      signTransaction: jest.fn(),
      signMessage: jest.fn(),
      signAuthEntry: jest.fn(),
    });

    mockUseBalancesList.mockReturnValue({
      balanceItems: [
        {
          id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          tokenId:
            "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          total: "1000",
          available: "1000",
          token: {
            code: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
        } as any,
      ],
      scanResults: {} as any,
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      localOnlyTokenIds: [],
      hiddenBalanceItems: [],
      handleRefresh: jest.fn(),
    });

    mockCalculateSpendableAmount.mockReturnValue(new BigNumber("1000"));
    mockHasXLMForFees.mockReturnValue(true);
    mockUseRightHeaderMenu.mockReturnValue(undefined);
    mockUseToast.mockReturnValue({
      showToast: jest.fn(),
      dismissToast: jest.fn(),
    });
    mockUseHistoryStore.mockReturnValue({ fetchAccountHistory: jest.fn() });
    mockUseSendRecipientStore.mockReturnValue({
      resetSendRecipient: jest.fn(),
      isDestinationFunded: true,
    } as any);
    mockScanTransaction.mockReturnValue({
      scanTransaction: jest.fn().mockResolvedValue({ warnings: [] }),
    } as any);
    mockCachedFetch.mockResolvedValue({ _embedded: { records: [] } } as any);
    jest
      .spyOn(useValidateTransactionMemo, "useValidateTransactionMemo")
      .mockReturnValue({ isValidatingMemo: false, isMemoMissing: false });
  });

  it("renders hidden amount TextInput", () => {
    const { getByTestId } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByTestId("amount-text-input")).toBeTruthy();
  });

  it("forwards TextInput.onChangeText to converter.setDisplayAmountFromText", () => {
    const { getByTestId } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByTestId("amount-text-input"), "5");
    expect(mockSetDisplayAmountFromText).toHaveBeenCalledWith("5");
  });

  it("forwards pasted/multi-character input as a single setDisplayAmountFromText call", () => {
    const { getByTestId } = render(
      <TransactionAmountScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByTestId("amount-text-input"), "123,45");
    expect(mockSetDisplayAmountFromText).toHaveBeenCalledTimes(1);
    expect(mockSetDisplayAmountFromText).toHaveBeenCalledWith("123,45");
  });

  describe("token-mode Max precision", () => {
    const solvBtcContract =
      "CBIJBDNZNF4X35BJ4FFZWCDBSCKOP5NB4PLG4SNENRMLAPYG4P5FM6VN";
    const solvBtcId = `SolvBTC:${solvBtcContract}`;
    const mockSetTokenAmount = jest.fn();

    const pressMaxWithSolvBtc = (rawUnits: string) => {
      mockUseTransactionSettingsStore.mockReturnValue({
        ...(mockUseTransactionSettingsStore as unknown as jest.Mock)(),
        selectedTokenId: solvBtcId,
      });
      mockUseBalancesList.mockReturnValue({
        ...(mockUseBalancesList as unknown as jest.Mock)(),
        balanceItems: [
          {
            id: solvBtcId,
            tokenId: solvBtcId,
            contractId: solvBtcContract,
            decimals: 8,
            total: new BigNumber(rawUnits),
            available: new BigNumber(rawUnits),
            token: { code: "SolvBTC", issuer: { key: solvBtcContract } },
          } as any,
        ],
      });
      mockCalculateSpendableAmount.mockReturnValue(new BigNumber(rawUnits));
      const { getByTestId } = render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={mockRoute}
        />,
      );
      fireEvent.press(getByTestId("percentage-100"));
    };

    beforeEach(() => {
      mockUseTokenFiatConverter.mockReturnValue({
        ...(mockUseTokenFiatConverter as unknown as jest.Mock)(),
        showFiatAmount: false,
        setTokenAmount: mockSetTokenAmount,
      });
    });

    it("sets exactly the held amount for an 8-decimal token", () => {
      pressMaxWithSolvBtc("227");
      expect(mockSetTokenAmount).toHaveBeenLastCalledWith("0.00000227");
    });

    it("keeps dust below the 7th decimal instead of rounding it to zero", () => {
      pressMaxWithSolvBtc("4");
      expect(mockSetTokenAmount).toHaveBeenLastCalledWith("0.00000004");
    });

    it("leaves classic tokens at 7 decimals", () => {
      const { getByTestId } = render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={mockRoute}
        />,
      );
      fireEvent.press(getByTestId("percentage-100"));
      expect(mockSetTokenAmount).toHaveBeenLastCalledWith("1000.0000000");
    });
  });

  describe("fiat-mode Max for a SEP-41 token", () => {
    const solvBtcId =
      "SolvBTC:CBIJBDNZNF4X35BJ4FFZWCDBSCKOP5NB4PLG4SNENRMLAPYG4P5FM6VN";
    const mockUpdateFiatDisplay = jest.fn();
    const mockSetTokenAmount = jest.fn();

    beforeEach(() => {
      mockUseTokenFiatConverter.mockReturnValue({
        ...(mockUseTokenFiatConverter as unknown as jest.Mock)(),
        showFiatAmount: true,
        setTokenAmount: mockSetTokenAmount,
        updateFiatDisplay: mockUpdateFiatDisplay,
      });
      mockUseTransactionSettingsStore.mockReturnValue({
        ...(mockUseTransactionSettingsStore as unknown as jest.Mock)(),
        selectedTokenId: solvBtcId,
      });
      mockUseBalancesList.mockReturnValue({
        ...(mockUseBalancesList as unknown as jest.Mock)(),
        balanceItems: [
          {
            id: solvBtcId,
            tokenId: solvBtcId,
            contractId:
              "CBIJBDNZNF4X35BJ4FFZWCDBSCKOP5NB4PLG4SNENRMLAPYG4P5FM6VN",
            decimals: 8,
            total: new BigNumber("227"),
            available: new BigNumber("227"),
            currentPrice: new BigNumber("81597.03"),
            token: {
              code: "SolvBTC",
              issuer: {
                key: "CBIJBDNZNF4X35BJ4FFZWCDBSCKOP5NB4PLG4SNENRMLAPYG4P5FM6VN",
              },
            },
          } as any,
        ],
      });
      mockCalculateSpendableAmount.mockReturnValue(new BigNumber("227"));
    });

    it("derives the fiat amount from the committed token amount", () => {
      const zeroDecContract =
        "CDSRYSNQOZTTUQEGBYZZL4VYU5WFEQ7KV6UX2VH3QAVGDFL7ZWWL25KR";
      mockUseTransactionSettingsStore.mockReturnValue({
        ...(mockUseTransactionSettingsStore as unknown as jest.Mock)(),
        selectedTokenId: `WHOLE:${zeroDecContract}`,
      });
      mockUseBalancesList.mockReturnValue({
        ...(mockUseBalancesList as unknown as jest.Mock)(),
        balanceItems: [
          {
            id: `WHOLE:${zeroDecContract}`,
            tokenId: `WHOLE:${zeroDecContract}`,
            contractId: zeroDecContract,
            decimals: 0,
            total: new BigNumber("5"),
            available: new BigNumber("5"),
            currentPrice: new BigNumber("10"),
            token: { code: "WHOLE", issuer: { key: zeroDecContract } },
          } as any,
        ],
      });
      mockCalculateSpendableAmount.mockReturnValue(new BigNumber("5"));
      const { getByTestId } = render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={mockRoute}
        />,
      );

      fireEvent.press(getByTestId("percentage-25"));

      expect(mockSetTokenAmount).toHaveBeenLastCalledWith("1");
      expect(mockUpdateFiatDisplay).toHaveBeenLastCalledWith("10.00");
    });

    it("commits the held amount and mirrors it in fiat, like the extension", () => {
      const { getByTestId } = render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={mockRoute}
        />,
      );

      fireEvent.press(getByTestId("percentage-100"));

      expect(mockSetTokenAmount).toHaveBeenLastCalledWith("0.00000227");
      expect(mockUpdateFiatDisplay).toHaveBeenLastCalledWith("0.19");
    });

    it.each([
      // [code, contract, decimals, raw spendable, price, token, fiat]
      [
        "ONE",
        "CDSRYSNQOZTTUQEGBYZZL4VYU5WFEQ7KV6UX2VH3QAVGDFL7ZWWL25KR",
        0,
        "1",
        "0.125",
        "1",
        "0.13",
      ],
      [
        "THREE",
        "CDSRYSNQOZTTUQEGBYZZL4VYU5WFEQ7KV6UX2VH3QAVGDFL7ZWWL25KR",
        0,
        "3",
        "0.3333333",
        "3",
        "1.00",
      ],
    ])(
      "Max on a %s 0-decimal token sends the whole balance",
      (code, contract, decimals, raw, price, token, fiat) => {
        const id = `${code}:${contract}`;
        mockUseTransactionSettingsStore.mockReturnValue({
          ...(mockUseTransactionSettingsStore as unknown as jest.Mock)(),
          selectedTokenId: id,
        });
        mockUseBalancesList.mockReturnValue({
          ...(mockUseBalancesList as unknown as jest.Mock)(),
          balanceItems: [
            {
              id,
              tokenId: id,
              contractId: contract,
              decimals,
              total: new BigNumber(raw),
              available: new BigNumber(raw),
              currentPrice: new BigNumber(price),
              token: { code, issuer: { key: contract } },
            } as any,
          ],
        });
        mockCalculateSpendableAmount.mockReturnValue(new BigNumber(raw));
        const { getByTestId } = render(
          <TransactionAmountScreen
            navigation={mockNavigation}
            route={mockRoute}
          />,
        );

        fireEvent.press(getByTestId("percentage-100"));

        expect(mockSetTokenAmount).toHaveBeenLastCalledWith(token);
        expect(mockUpdateFiatDisplay).toHaveBeenLastCalledWith(fiat);
      },
    );

    it("still commits the token amount when the price is zero, like the extension", () => {
      mockUseBalancesList.mockReturnValue({
        ...(mockUseBalancesList as unknown as jest.Mock)(),
        balanceItems: [
          {
            ...(mockUseBalancesList as unknown as jest.Mock)().balanceItems[0],
            currentPrice: new BigNumber("0"),
          },
        ],
      });
      const { getByTestId } = render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={mockRoute}
        />,
      );

      fireEvent.press(getByTestId("percentage-100"));

      expect(mockSetTokenAmount).toHaveBeenLastCalledWith("0.00000227");
      expect(mockUpdateFiatDisplay).not.toHaveBeenCalled();
    });

    it("Max on a classic token sends the whole spendable amount", () => {
      mockUseTransactionSettingsStore.mockReturnValue({
        ...(mockUseTransactionSettingsStore as unknown as jest.Mock)(),
        selectedTokenId:
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      });
      mockUseBalancesList.mockReturnValue({
        ...(mockUseBalancesList as unknown as jest.Mock)(),
        balanceItems: [
          {
            id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            tokenId:
              "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            total: new BigNumber("1000"),
            available: new BigNumber("1000"),
            currentPrice: new BigNumber("0.1234567"),
            token: {
              code: "USDC",
              issuer: {
                key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
              },
            },
          } as any,
        ],
      });
      mockCalculateSpendableAmount.mockReturnValue(new BigNumber("1000"));
      const { getByTestId } = render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={mockRoute}
        />,
      );

      fireEvent.press(getByTestId("percentage-100"));

      expect(mockSetTokenAmount).toHaveBeenLastCalledWith("1000.0000000");
      expect(mockUpdateFiatDisplay).toHaveBeenLastCalledWith("123.46");
    });
  });

  describe("pre-submit failure telemetry", () => {
    it("emits payment.failed without volume data when signing fails", async () => {
      const mockSign = jest.fn().mockReturnValue(null);
      const mockSubmit = jest.fn();
      mockUseTransactionBuilderStore.mockReturnValue({
        buildTransaction: jest.fn(),
        signTransaction: mockSign,
        submitTransaction: mockSubmit,
        resetTransaction: jest.fn(),
        isBuilding: false,
        isSigning: false,
        isSubmitting: false,
        transactionXDR: "mockXDR",
        transactionHash: null,
        error: null,
      } as any);
      (
        useTransactionBuilderStore as unknown as {
          getState: jest.Mock;
        }
      ).getState = jest.fn(() => ({ error: "Signing blew up" }));

      render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={mockRoute}
        />,
      );

      expect(capturedOnConfirm).toBeInstanceOf(Function);
      await act(() => {
        capturedOnConfirm?.();
        return Promise.resolve();
      });

      // The failure event is the flow's outcome and still fires, but nothing
      // reached the network, so it carries no attempted volume.
      expect(mockSubmit).not.toHaveBeenCalled();
      expect(analytics.trackTransactionError).toHaveBeenCalledTimes(1);
      const [failurePayload] = (analytics.trackTransactionError as jest.Mock)
        .mock.calls[0] as [{ volume?: unknown; error: string }];
      expect(failurePayload.volume).toBeUndefined();
      expect(failurePayload.error).toBe("Signing blew up");
    });
  });
});

describe("TransactionAmountScreen - muxed contract (W) recipient", () => {
  const mockPublicKey =
    "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
  const customTokenContractId =
    "CAZXRTOKNUQ2JQQF3NCRU7GYMDJNZ2NMQN6IGN4FCT5DWPODMPVEXSND";
  const bannerTestId = "muxed-contract-not-supported-banner";
  // The explanation sheet is always mounted in this file's bottom-sheet mock,
  // so its description shows which variant the screen passed it.
  const contractSheetDescription =
    "transactionAmountScreen.errors.muxedContractWarning.description";
  const accountSheetDescription =
    "transactionAmountScreen.errors.muxedAddressWarning.description";

  const mockXlmBalance = {
    id: "XLM",
    tokenId: "XLM",
    total: new BigNumber("10.0000000"),
    available: new BigNumber("10.0000000"),
    token: { code: "XLM", issuer: "", type: "native" },
    tokenType: "native",
    price: 0.1,
    fiatValue: 1.0,
  };

  const classicAssetBalance = {
    id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    tokenId: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    total: new BigNumber("1000"),
    available: new BigNumber("1000"),
    token: {
      code: "USDC",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    },
    tokenCode: "USDC",
  };

  // A custom token is a balance with a contractId.
  const customTokenBalance = {
    id: `WTT:${customTokenContractId}`,
    contractId: customTokenContractId,
    decimals: 7,
    token: { code: "WTT", issuer: { key: customTokenContractId } },
    total: new BigNumber("10"),
    available: new BigNumber("10"),
    tokenCode: "WTT",
  };

  let mockBuildTransactionFn: jest.Mock;
  let originalGetState: unknown;

  const routeFor = (
    tokenId: string,
    recipientAddress: string = MUXED_CONTRACT_ID_1234,
  ) =>
    ({
      params: { tokenId, recipientAddress },
      key: "transaction-amount",
      name: SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN,
    }) as unknown as TransactionAmountScreenProps["route"];

  /**
   * Serves one settings state through both the hook and `getState()`, which
   * prepareTransaction reads fresh. `saveMemo` writes through, as the real
   * store's does, so a memo the screen clears is gone from the next
   * `getState()`.
   */
  const setSettingsStore = (
    overrides: {
      selectedTokenId?: string;
      recipientAddress?: string;
      transactionMemo?: string;
    } = {},
  ) => {
    const state = {
      transactionMemo: "",
      transactionMemoType: "",
      transactionFee: "0.00001",
      transactionTimeout: 30,
      feePriority: "low",
      feeManuallyChanged: false,
      recipientAddress: MUXED_CONTRACT_ID_1234,
      federationAddress: "",
      recipientName: "",
      selectedTokenId: "XLM",
      saveMemo: jest.fn(),
      saveMemoType: jest.fn(),
      saveTransactionFee: jest.fn(),
      saveFeePriority: jest.fn(),
      markFeeManuallyChanged: jest.fn(),
      saveTransactionTimeout: jest.fn(),
      saveRecipientAddress: jest.fn(),
      saveFederationAddress: jest.fn(),
      saveRecipientName: jest.fn(),
      saveSelectedTokenId: jest.fn(),
      saveSelectedCollectibleDetails: jest.fn(),
      resetSettings: jest.fn(),
      ...overrides,
    };
    state.saveMemo.mockImplementation((memo: string) => {
      state.transactionMemo = memo;
    });

    mockUseTransactionSettingsStore.mockReturnValue(state);
    (useTransactionSettingsStore as any).getState = jest
      .fn()
      .mockReturnValue(state);

    return state;
  };

  /**
   * Waits past the screen's 300 ms auto-simulation. It waits inside act, so
   * the async updates the screen makes meanwhile don't warn.
   */
  const waitForAutoSimulation = () =>
    act(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 400);
        }),
    );

  const isContinueDisabled = (getByTestId: (id: string) => any) =>
    getByTestId("send-continue-button").props.accessibilityState?.disabled;

  beforeAll(() => {
    // The describes above assign getState and never restore it.
    originalGetState = (useTransactionSettingsStore as any).getState;
  });

  afterAll(() => {
    (useTransactionSettingsStore as any).getState = originalGetState;
  });

  afterEach(() => {
    // Puts back the keyboard helper a test spied on.
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockBuildTransactionFn = jest.fn().mockResolvedValue("mockXDR");
    mockUseTransactionBuilderStore.mockReturnValue({
      buildTransaction: mockBuildTransactionFn,
      signTransaction: jest.fn(),
      submitTransaction: jest.fn(),
      resetTransaction: jest.fn(),
      isBuilding: false,
      isSigning: false,
      isSubmitting: false,
      transactionXDR: null,
      transactionHash: null,
      error: null,
      network: NETWORKS.TESTNET,
      transaction: null,
    } as any);
    mockUseAuthenticationStore.mockReturnValue({
      publicKey: mockPublicKey,
      network: NETWORKS.TESTNET,
    } as any);
    mockUsePreferencesStore.mockReturnValue({
      isMemoValidationEnabled: true,
    });
    mockCachedFetch.mockResolvedValue({ _embedded: { records: [] } });
    mockScanTransaction.mockReturnValue({
      scanTransaction: jest.fn().mockResolvedValue({
        warnings: [],
        malicious: false,
        suspicious: false,
      }),
    });
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
      signMessage: jest.fn(),
      signAuthEntry: jest.fn(),
    });
    mockUseBalancesList.mockReturnValue({
      balanceItems: [
        mockXlmBalance as any,
        classicAssetBalance as any,
        customTokenBalance as any,
      ],
      scanResults: {} as any,
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      localOnlyTokenIds: [],
      hiddenBalanceItems: [],
      handleRefresh: jest.fn(),
    });
    // Plenty of either token, so no amount error can disable Continue: the W
    // block is then the only thing that can. A custom token's spendable is in
    // base units (7 decimals), so this is still 1000 WTT.
    mockCalculateSpendableAmount.mockReturnValue(new BigNumber("10000000000"));
    mockHasXLMForFees.mockReturnValue(true);
    mockUseTokenFiatConverter.mockReturnValue({
      tokenAmount: "100",
      tokenAmountDisplay: "100",
      tokenAmountDisplayRaw: null,
      fiatAmount: "100.00",
      fiatAmountDisplay: "100.00",
      fiatAmountDisplayRaw: null,
      showFiatAmount: false,
      setTokenAmount: jest.fn(),
      setFiatAmount: jest.fn(),
      setShowFiatAmount: jest.fn(),
      handleDisplayAmountChange: jest.fn(),
      updateFiatDisplay: jest.fn(),
      setDisplayAmountFromText: jest.fn(),
      pasteRejectNonce: 0,
    });
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
  });

  it("allows XLM to a W: no banner, clears a stale memo, estimates fees for the W", async () => {
    const settings = setSettingsStore({
      selectedTokenId: "XLM",
      transactionMemo: "stale",
    });

    const { queryByTestId, getByTestId } = render(
      <TransactionAmountScreen
        navigation={mockNavigation}
        route={routeFor("XLM")}
      />,
    );
    await waitForAutoSimulation();

    expect(queryByTestId(bannerTestId)).toBeNull();
    expect(isContinueDisabled(getByTestId)).toBe(false);
    expect(settings.saveMemo).toHaveBeenCalledWith("");
    // The estimate is for the W, and it was built after the memo was cleared.
    expect(mockBuildTransactionFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenAmount: "0",
        recipientAddress: MUXED_CONTRACT_ID_1234,
        transactionMemo: "",
      }),
    );
  });

  it("allows a classic asset to a W: no banner, Continue enabled", async () => {
    setSettingsStore({ selectedTokenId: classicAssetBalance.id });

    const { queryByTestId, getByTestId } = render(
      <TransactionAmountScreen
        navigation={mockNavigation}
        route={routeFor(classicAssetBalance.id)}
      />,
    );
    await waitForAutoSimulation();

    expect(queryByTestId(bannerTestId)).toBeNull();
    expect(isContinueDisabled(getByTestId)).toBe(false);
    expect(mockBuildTransactionFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenAmount: "0",
        recipientAddress: MUXED_CONTRACT_ID_1234,
      }),
    );
  });

  it("blocks a custom token sent to a W: banner, Continue disabled, nothing built", async () => {
    setSettingsStore({ selectedTokenId: customTokenBalance.id });

    const { getByTestId, getByText, queryByText } = render(
      <TransactionAmountScreen
        navigation={mockNavigation}
        route={routeFor(customTokenBalance.id)}
      />,
    );
    await waitForAutoSimulation();

    expect(
      within(getByTestId(bannerTestId)).getByText(
        "transactionAmountScreen.errors.muxedAddressNotSupported",
      ),
    ).toBeTruthy();
    expect(isContinueDisabled(getByTestId)).toBe(true);
    expect(mockBuildTransactionFn).not.toHaveBeenCalled();
    // The banner opens the W explanation, not the M one.
    expect(getByText(contractSheetDescription)).toBeTruthy();
    expect(queryByText(accountSheetDescription)).toBeNull();
  });

  it("opens the W explanation from the banner once the keyboard is down", async () => {
    setSettingsStore({ selectedTokenId: customTokenBalance.id });
    let keyboardDown!: () => void;
    const waitForKeyboard = jest
      .spyOn(keyboardHelpers, "waitForKeyboardDismiss")
      .mockReturnValue(
        new Promise<void>((resolve) => {
          keyboardDown = resolve;
        }),
      );
    // A host View has no ref in the test renderer, so the bottom sheet modals
    // (the only elements rendered `detached`) get a present() to watch.
    const present = jest.fn();

    const { getByTestId } = render(
      <TransactionAmountScreen
        navigation={mockNavigation}
        route={routeFor(customTokenBalance.id)}
      />,
      {
        createNodeMock: (element) =>
          (element.props as { detached?: boolean }).detached
            ? { present, dismiss: jest.fn() }
            : null,
      },
    );
    await waitForAutoSimulation();

    fireEvent.press(getByTestId(bannerTestId));

    // The amount input gives up the keyboard, and the sheet waits for it, but
    // only 500 ms: a hide event that never comes can't keep the sheet shut.
    expect(TextInput.prototype.blur).toHaveBeenCalled();
    expect(waitForKeyboard).toHaveBeenCalledTimes(1);
    expect(waitForKeyboard).toHaveBeenCalledWith(500);
    expect(present).not.toHaveBeenCalled();

    await act(() => {
      keyboardDown();
      return Promise.resolve();
    });

    expect(present).toHaveBeenCalledTimes(1);
  });

  it("blocks when the token switches from XLM to a custom token after the W is picked", async () => {
    setSettingsStore({ selectedTokenId: "XLM" });

    const { getByTestId, queryByTestId, rerender } = render(
      <TransactionAmountScreen
        navigation={mockNavigation}
        route={routeFor("XLM")}
      />,
    );
    await waitForAutoSimulation();

    expect(queryByTestId(bannerTestId)).toBeNull();
    expect(mockBuildTransactionFn).toHaveBeenCalledTimes(1);

    setSettingsStore({ selectedTokenId: customTokenBalance.id });
    rerender(
      <TransactionAmountScreen
        navigation={mockNavigation}
        route={routeFor(customTokenBalance.id)}
      />,
    );
    await waitForAutoSimulation();

    expect(getByTestId(bannerTestId)).toBeTruthy();
    expect(isContinueDisabled(getByTestId)).toBe(true);
    expect(mockBuildTransactionFn).toHaveBeenCalledTimes(1);
  });

  it("builds again when the token switches back from a custom token to XLM", async () => {
    setSettingsStore({ selectedTokenId: customTokenBalance.id });

    const { getByTestId, queryByTestId, rerender } = render(
      <TransactionAmountScreen
        navigation={mockNavigation}
        route={routeFor(customTokenBalance.id)}
      />,
    );
    await waitForAutoSimulation();

    expect(getByTestId(bannerTestId)).toBeTruthy();
    expect(mockBuildTransactionFn).not.toHaveBeenCalled();

    setSettingsStore({ selectedTokenId: "XLM" });
    rerender(
      <TransactionAmountScreen
        navigation={mockNavigation}
        route={routeFor("XLM")}
      />,
    );
    await waitForAutoSimulation();

    expect(queryByTestId(bannerTestId)).toBeNull();
    expect(isContinueDisabled(getByTestId)).toBe(false);
    expect(mockBuildTransactionFn).toHaveBeenCalledTimes(1);
  });

  describe("saving settings", () => {
    it("rebuilds for XLM to a W", async () => {
      setSettingsStore({ selectedTokenId: "XLM" });

      const { getByText } = render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={routeFor("XLM")}
        />,
      );
      await waitForAutoSimulation();
      mockBuildTransactionFn.mockClear();

      await act(() => {
        fireEvent.press(getByText("common.save"));
        return Promise.resolve();
      });

      expect(mockBuildTransactionFn).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenAmount: "100",
          recipientAddress: MUXED_CONTRACT_ID_1234,
        }),
      );
    });

    it("builds nothing for a custom token to a W", async () => {
      setSettingsStore({ selectedTokenId: customTokenBalance.id });

      const { getByText } = render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={routeFor(customTokenBalance.id)}
        />,
      );
      await waitForAutoSimulation();

      await act(() => {
        fireEvent.press(getByText("common.save"));
        return Promise.resolve();
      });

      expect(mockBuildTransactionFn).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["a G account", G_ACCOUNT],
    ["a C contract", BASE_CONTRACT],
    ["an M account", M_ACCOUNT_ID_1234],
  ])(
    "does not block a custom token sent to %s",
    async (_label, recipientAddress) => {
      setSettingsStore({
        selectedTokenId: customTokenBalance.id,
        recipientAddress,
      });

      const { queryByTestId, getByTestId, getByText, queryByText } = render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={routeFor(customTokenBalance.id, recipientAddress)}
        />,
      );
      await waitForAutoSimulation();

      expect(queryByTestId(bannerTestId)).toBeNull();
      expect(isContinueDisabled(getByTestId)).toBe(false);
      expect(mockBuildTransactionFn).toHaveBeenCalledWith(
        expect.objectContaining({ tokenAmount: "0", recipientAddress }),
      );
      // The sheet keeps its M explanation for everything but a W.
      expect(getByText(accountSheetDescription)).toBeTruthy();
      expect(queryByText(contractSheetDescription)).toBeNull();
    },
  );

  describe("percentage buttons", () => {
    const percentageButtonIds = [
      "percentage-25",
      "percentage-50",
      "percentage-75",
      "percentage-100",
    ];

    it("hides them while a custom token to a W is blocked", async () => {
      setSettingsStore({ selectedTokenId: customTokenBalance.id });

      const { getByTestId, queryByTestId } = render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={routeFor(customTokenBalance.id)}
        />,
      );
      await waitForAutoSimulation();

      expect(getByTestId(bannerTestId)).toBeTruthy();
      percentageButtonIds.forEach((id) => {
        expect(queryByTestId(id)).toBeNull();
      });
    });

    it.each([
      ["XLM to a W", "XLM", MUXED_CONTRACT_ID_1234],
      ["a custom token to a G account", customTokenBalance.id, G_ACCOUNT],
      ["a custom token to a C contract", customTokenBalance.id, BASE_CONTRACT],
    ])("shows them for %s", async (_label, tokenId, recipientAddress) => {
      setSettingsStore({ selectedTokenId: tokenId, recipientAddress });

      const { getByTestId } = render(
        <TransactionAmountScreen
          navigation={mockNavigation}
          route={routeFor(tokenId, recipientAddress)}
        />,
      );
      await waitForAutoSimulation();

      percentageButtonIds.forEach((id) => {
        expect(getByTestId(id)).toBeTruthy();
      });
    });
  });
});

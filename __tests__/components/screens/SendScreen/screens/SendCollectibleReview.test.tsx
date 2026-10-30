import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { act, fireEvent, render } from "@testing-library/react-native";
import {
  BASE_CONTRACT,
  G_ACCOUNT,
  M_ACCOUNT_ID_1234,
  MUXED_CONTRACT_ID_0,
} from "__tests__/support/muxedContractFixtures";
import MuxedAddressWarningBottomSheet from "components/MuxedAddressWarningBottomSheet";
import SendCollectibleReviewScreen from "components/screens/SendScreen/screens/SendCollectibleReview";
import { NETWORKS } from "config/constants";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { useCollectiblesStore } from "ducks/collectibles";
import { useHistoryStore } from "ducks/history";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { classNameOf, renderWithProviders } from "helpers/testUtils";
import * as blockaidService from "hooks/blockaid/useBlockaidTransaction";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useRightHeaderMenu } from "hooks/useRightHeader";
import * as useValidateTransactionMemo from "hooks/useValidateTransactionMemo";
import { ToastProvider } from "providers/ToastProvider";
import React from "react";
import { SecurityLevel } from "services/blockaid/constants";
import * as blockaidHelper from "services/blockaid/helper";

// Type definitions
type SendCollectibleReviewScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.SEND_COLLECTIBLE_REVIEW
>;

// Core mocks
jest.mock("ducks/transactionBuilder");
jest.mock("ducks/transactionSettings");
jest.mock("ducks/auth");
jest.mock("ducks/history");
jest.mock("ducks/sendRecipient");
jest.mock("ducks/collectibles");

// Service mocks
jest.mock("services/analytics", () => ({
  analytics: {
    track: jest.fn(),
    trackSendCollectibleSuccess: jest.fn(),
    trackTransactionError: jest.fn(),
  },
}));
const mockCheckContractMuxedSupport = jest.fn().mockResolvedValue(false);

jest.mock("helpers/muxedAddress", () => ({
  checkContractMuxedSupport: (...args: unknown[]) =>
    mockCheckContractMuxedSupport(...args),
}));

// Hook mocks
jest.mock("hooks/useGetActiveAccount");
jest.mock("hooks/useRightHeader");
jest.mock("hooks/blockaid/useBlockaidTransaction");

// `useNetworkFees` fetches feeStats over the network and calls `setFees` when
// it resolves. These tests render synchronously, so that update lands after the
// test body has returned — outside `act(...)` — and React reports it as an
// empty AggregateError against whichever test happens to be running when the
// request settles. Mock the hook so the fee snapshot is available on first
// render and nothing is left in flight.
jest.mock("hooks/useNetworkFees", () => ({
  useNetworkFees: () => ({
    recommendedFee: "0.00001",
    networkCongestion: "Low",
    feePresets: { low: "0.00001", medium: "0.00002", high: "0.00003" },
  }),
  clearNetworkFeesCache: jest.fn(),
}));

// Component mocks
jest.mock("components/CollectibleImage", () => ({
  CollectibleImage: "View",
}));

// Store props from mock component for testing
let mockSendReviewBottomSheetProps: Record<string, unknown> = {};
let mockSecurityDetailBottomSheetProps: Record<string, unknown> = {};

jest.mock("components/screens/SendScreen/components", () => ({
  SendReviewBottomSheet: function MockSendReviewBottomSheet(
    props: Record<string, unknown>,
  ) {
    mockSendReviewBottomSheetProps = props;
    return null;
  },
  ContactRow: function MockContactRow() {
    return null;
  },
  SendReviewFooter: function MockSendReviewFooter() {
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
jest.mock("components/blockaid/SecurityDetailBottomSheet", () => {
  const MockSecurityDetailBottomSheet = (props: Record<string, unknown>) => {
    mockSecurityDetailBottomSheetProps = props;
    return null;
  };
  return {
    __esModule: true,
    default: MockSecurityDetailBottomSheet,
    SecurityDetailBottomSheet: MockSecurityDetailBottomSheet,
  };
});
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
jest.mock("services/blockaid/helper");
jest.mock("hooks/useValidateTransactionMemo");

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
const mockUseGetActiveAccount = useGetActiveAccount as jest.MockedFunction<
  typeof useGetActiveAccount
>;
const mockUseCollectiblesStore = useCollectiblesStore as jest.MockedFunction<
  typeof useCollectiblesStore
>;
const mockUseRightHeaderMenu = useRightHeaderMenu as jest.MockedFunction<
  typeof useRightHeaderMenu
>;
const mockUseHistoryStore = useHistoryStore as jest.MockedFunction<
  typeof useHistoryStore
>;
const mockUseSendRecipientStore = useSendRecipientStore as jest.MockedFunction<
  typeof useSendRecipientStore
>;
const mockScanTransaction =
  blockaidService.useBlockaidTransaction as jest.MockedFunction<
    typeof blockaidService.useBlockaidTransaction
  >;
const mockAssessTransactionSecurity =
  blockaidHelper.assessTransactionSecurity as jest.MockedFunction<
    typeof blockaidHelper.assessTransactionSecurity
  >;
const mockExtractSecurityWarnings =
  blockaidHelper.extractSecurityWarnings as jest.MockedFunction<
    typeof blockaidHelper.extractSecurityWarnings
  >;
const mockUseValidateTransactionMemo =
  useValidateTransactionMemo.useValidateTransactionMemo as jest.MockedFunction<
    typeof useValidateTransactionMemo.useValidateTransactionMemo
  >;

// Helper function to set up default mocks
const setupDefaultMocks = () => {
  const mockPublicKey =
    "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
  const mockRecipientAddress =
    "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF";
  const mockXDR = "mockTransactionXDR";

  const mockCollectible = {
    tokenId: "1",
    collectionAddress: "0xABCDEF123456789",
    collectionName: "Test Collection",
    name: "Test NFT",
    image: "https://example.com/nft.png",
  };

  const mockTransactionBuilderState = {
    buildSendCollectibleTransaction: jest.fn().mockResolvedValue(mockXDR),
    signTransaction: jest.fn(),
    signMessage: jest.fn(),
    submitTransaction: jest.fn().mockResolvedValue(true),
    resetTransaction: jest.fn(),
    isBuilding: false,
    isSigning: false,
    isSubmitting: false,
    transactionXDR: mockXDR,
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
    selectedTokenId: "",
    selectedCollectibleDetails: {
      tokenId: "1",
      collectionAddress: "0xABCDEF123456789",
    },
    saveMemo: jest.fn(),
    saveTransactionFee: jest.fn(),
    saveFeePriority: jest.fn(),
    markFeeManuallyChanged: jest.fn(),
    saveTransactionTimeout: jest.fn(),
    saveRecipientAddress: jest.fn(),
    saveSelectedTokenId: jest.fn(),
    saveSelectedCollectibleDetails: jest.fn(),
    resetSettings: jest.fn(),
  };

  const mockAuthState = {
    publicKey: mockPublicKey,
    network: NETWORKS.TESTNET,
  };

  const mockCollectiblesState = {
    collections: [
      {
        collectionAddress: "0xABCDEF123456789",
        collectionName: "Test Collection",
        items: [mockCollectible],
      },
    ],
    getCollectible: jest.fn(() => mockCollectible),
  };

  mockUseTransactionBuilderStore.mockReturnValue(mockTransactionBuilderState);
  mockUseTransactionSettingsStore.mockReturnValue(mockTransactionSettingsState);
  mockUseAuthenticationStore.mockReturnValue(mockAuthState);
  mockUseCollectiblesStore.mockReturnValue(mockCollectiblesState);

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

  mockUseRightHeaderMenu.mockReturnValue(undefined);
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

  mockUseValidateTransactionMemo.mockReturnValue({
    isValidatingMemo: false,
    isMemoMissing: false,
  });
};

// Mock navigation and route
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockPopTo = jest.fn();

const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  reset: mockReset,
  popTo: mockPopTo,
} as unknown as SendCollectibleReviewScreenProps["navigation"];

const mockRoute = {
  params: {
    tokenId: "1",
    collectionAddress: "0xABCDEF123456789",
  },
  key: "send-collectible-review",
  name: SEND_PAYMENT_ROUTES.SEND_COLLECTIBLE_REVIEW,
} as unknown as SendCollectibleReviewScreenProps["route"];

describe("SendCollectibleReview - Banner Content", () => {
  const mockPublicKey =
    "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
  const mockRecipientAddress =
    "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF";
  const mockXDR = "mockTransactionXDR";

  const mockCollectible = {
    tokenId: "1",
    collectionAddress: "0xABCDEF123456789",
    collectionName: "Test Collection",
    name: "Test NFT",
    image: "https://example.com/nft.png",
  };

  const mockTransactionBuilderState = {
    buildSendCollectibleTransaction: jest.fn(),
    signTransaction: jest.fn(),
    signMessage: jest.fn(),
    submitTransaction: jest.fn(),
    resetTransaction: jest.fn(),
    isBuilding: false,
    isSigning: false,
    isSubmitting: false,
    transactionXDR: mockXDR,
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
    selectedTokenId: "",
    selectedCollectibleDetails: {
      tokenId: "1",
      collectionAddress: "0xABCDEF123456789",
    },
    saveMemo: jest.fn(),
    saveTransactionFee: jest.fn(),
    saveFeePriority: jest.fn(),
    markFeeManuallyChanged: jest.fn(),
    saveTransactionTimeout: jest.fn(),
    saveRecipientAddress: jest.fn(),
    saveSelectedTokenId: jest.fn(),
    saveSelectedCollectibleDetails: jest.fn(),
    resetSettings: jest.fn(),
  };

  const mockAuthState = {
    publicKey: mockPublicKey,
    network: NETWORKS.TESTNET,
  };

  const mockCollectiblesState = {
    collections: [
      {
        collectionAddress: "0xABCDEF123456789",
        collectionName: "Test Collection",
        items: [mockCollectible],
      },
    ],
    getCollectible: jest.fn(() => mockCollectible),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTransactionBuilderStore.mockReturnValue(mockTransactionBuilderState);
    mockUseTransactionSettingsStore.mockReturnValue(
      mockTransactionSettingsState,
    );
    mockUseAuthenticationStore.mockReturnValue(mockAuthState);
    mockUseCollectiblesStore.mockReturnValue(mockCollectiblesState);

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

    mockUseRightHeaderMenu.mockReturnValue(undefined);
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

    mockUseValidateTransactionMemo.mockReturnValue({
      isValidatingMemo: false,
      isMemoMissing: false,
    });

    // Default: no security issues
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.SAFE,
      isMalicious: false,
      isSuspicious: false,
      isUnableToScan: false,
    });

    mockExtractSecurityWarnings.mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should not pass banner props when transaction is not malicious or suspicious", () => {
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.SAFE,
      isMalicious: false,
      isSuspicious: false,
      isUnableToScan: false,
    });

    renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    // bannerContent should be undefined
    expect(mockSendReviewBottomSheetProps.bannerText).toBeUndefined();
    expect(mockSendReviewBottomSheetProps.bannerVariant).toBeUndefined();
    expect(mockSendReviewBottomSheetProps.onBannerPress).toBeUndefined();
  });

  it("should pass malicious banner props when transaction is malicious", () => {
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.MALICIOUS,
      isMalicious: true,
      isSuspicious: false,
      isUnableToScan: false,
    });

    mockExtractSecurityWarnings.mockReturnValue([
      {
        id: "malicious-warning",
        description: "Malicious transaction detected",
        severity: "malicious",
      },
    ]);

    renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    // Should have malicious banner content
    expect(mockSendReviewBottomSheetProps.bannerText).toBe(
      "transactionAmountScreen.errors.malicious",
    );
    expect(mockSendReviewBottomSheetProps.bannerVariant).toBe("error");
    expect(mockSendReviewBottomSheetProps.onBannerPress).toBeDefined();
    expect(typeof mockSendReviewBottomSheetProps.onBannerPress).toBe(
      "function",
    );
  });

  it("should pass suspicious banner props when transaction is suspicious", () => {
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.SUSPICIOUS,
      isMalicious: false,
      isSuspicious: true,
      isUnableToScan: false,
    });

    mockExtractSecurityWarnings.mockReturnValue([
      {
        id: "suspicious-warning",
        description: "Suspicious transaction detected",
        severity: "warning",
      },
    ]);

    renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    // Should have suspicious banner content
    expect(mockSendReviewBottomSheetProps.bannerText).toBe(
      "transactionAmountScreen.errors.suspicious",
    );
    expect(mockSendReviewBottomSheetProps.bannerVariant).toBe("warning");
    expect(mockSendReviewBottomSheetProps.onBannerPress).toBeDefined();
    expect(typeof mockSendReviewBottomSheetProps.onBannerPress).toBe(
      "function",
    );
  });

  it("should prioritize malicious over suspicious when both are true", () => {
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.MALICIOUS,
      isMalicious: true,
      isSuspicious: true,
      isUnableToScan: false,
    });

    mockExtractSecurityWarnings.mockReturnValue([
      {
        id: "malicious-warning",
        description: "Malicious transaction detected",
        severity: "malicious",
      },
    ]);

    renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    // Should show malicious (higher priority) rather than suspicious
    expect(mockSendReviewBottomSheetProps.bannerText).toBe(
      "transactionAmountScreen.errors.malicious",
    );
    expect(mockSendReviewBottomSheetProps.bannerVariant).toBe("error");
  });

  it("should correctly build bannerContent based on security assessment", () => {
    // Test that the component correctly constructs bannerContent for different scenarios

    // First render with no security issues - should have no banner content
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.SAFE,
      isMalicious: false,
      isSuspicious: false,
      isUnableToScan: false,
    });

    const { unmount: unmount1 } = renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    expect(mockSendReviewBottomSheetProps.bannerText).toBeUndefined();

    unmount1();

    // Second render with suspicious - should have warning banner
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.SUSPICIOUS,
      isMalicious: false,
      isSuspicious: true,
      isUnableToScan: false,
    });

    renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    expect(mockSendReviewBottomSheetProps.bannerText).toBe(
      "transactionAmountScreen.errors.suspicious",
    );
    expect(mockSendReviewBottomSheetProps.bannerVariant).toBe("warning");
  });

  it("should pass all required props to SendReviewBottomSheet including banner props", () => {
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.SUSPICIOUS,
      isMalicious: false,
      isSuspicious: true,
      isUnableToScan: false,
    });

    renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    // Check all props are passed correctly
    expect(mockSendReviewBottomSheetProps.type).toBe("collectible");
    expect(mockSendReviewBottomSheetProps.selectedCollectible).toEqual(
      mockCollectible,
    );
    expect(mockSendReviewBottomSheetProps.onBannerPress).toBeDefined();
    expect(mockSendReviewBottomSheetProps.isRequiredMemoMissing).toBe(false);
    expect(mockSendReviewBottomSheetProps.bannerText).toBe(
      "transactionAmountScreen.errors.suspicious",
    );
    expect(mockSendReviewBottomSheetProps.bannerVariant).toBe("warning");
    expect(mockSendReviewBottomSheetProps.signTransactionDetails).toBeDefined();
  });

  it("should render the main UI components", () => {
    const { getByText } = renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    // Try to find a text element that should be rendered
    const reviewButton = getByText("transactionAmountScreen.reviewButton");
    expect(reviewButton).toBeTruthy();
  });
});

describe("SendCollectibleReview - Unable to Scan States", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it("should show unable to scan banner content when transaction is unable to scan", () => {
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.UNABLE_TO_SCAN,
      isMalicious: false,
      isSuspicious: false,
      isUnableToScan: true,
    });

    mockExtractSecurityWarnings.mockReturnValue([
      {
        id: "unable-to-scan",
        description: "Unable to scan transaction",
        severity: "warning",
      },
    ]);

    renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    // Should have unable to scan banner content
    expect(mockSendReviewBottomSheetProps.bannerText).toBe(
      "securityWarning.proceedWithCaution",
    );
    expect(mockSendReviewBottomSheetProps.bannerVariant).toBe("warning");
    expect(mockSendReviewBottomSheetProps.onBannerPress).toBeDefined();
    expect(typeof mockSendReviewBottomSheetProps.onBannerPress).toBe(
      "function",
    );
  });

  it("should pass unable to scan props to SendReviewBottomSheet", () => {
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.UNABLE_TO_SCAN,
      isMalicious: false,
      isSuspicious: false,
      isUnableToScan: true,
    });

    renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    // Check unable to scan banner content is passed correctly
    expect(mockSendReviewBottomSheetProps.bannerText).toBe(
      "securityWarning.proceedWithCaution",
    );
    expect(mockSendReviewBottomSheetProps.bannerVariant).toBe("warning");
    expect(mockSendReviewBottomSheetProps.onBannerPress).toBeDefined();
  });

  it("should show 'Continue' button text for unable to scan in SecurityDetailBottomSheet", () => {
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.UNABLE_TO_SCAN,
      isMalicious: false,
      isSuspicious: false,
      isUnableToScan: true,
    });

    renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    // Check SecurityDetailBottomSheet props
    expect(mockSecurityDetailBottomSheetProps.proceedAnywayText).toBe(
      "common.continue",
    );
  });
});

describe("SendCollectibleReview - Unfunded Recipient Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it("should not show expected-to-fail warning for unfunded recipient when Blockaid reports safe", () => {
    // SAC/Soroban transfers don't require the recipient to be a funded account.
    // When Blockaid reports the transaction as safe, no warning should appear.
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.SAFE,
      isMalicious: false,
      isSuspicious: false,
      isExpectedToFail: false,
      isUnableToScan: false,
    });

    renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    expect(mockSendReviewBottomSheetProps.bannerText).toBeUndefined();
    expect(mockSendReviewBottomSheetProps.bannerVariant).toBeUndefined();
  });

  it("should show expected-to-fail warning when Blockaid simulation reports the transaction will fail", () => {
    // Blockaid's simulation result is the sole source of truth for collectible sends.
    // If Blockaid reports expected to fail, the warning must still render.
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.EXPECTED_TO_FAIL,
      isMalicious: false,
      isSuspicious: false,
      isExpectedToFail: true,
      isUnableToScan: false,
    });

    mockExtractSecurityWarnings.mockReturnValue([
      {
        id: "expected-to-fail",
        description: "Transaction is expected to fail",
        severity: "malicious",
      },
    ]);

    renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );

    expect(mockSendReviewBottomSheetProps.bannerText).toBe(
      "blockaid.security.transaction.expectedToFail",
    );
    expect(mockSendReviewBottomSheetProps.bannerVariant).toBe("warning");
    expect(mockSendReviewBottomSheetProps.onBannerPress).toBeDefined();
  });
});

describe("SendCollectibleReview - muxed contract (W) recipient", () => {
  const bannerTestId = "muxed-contract-not-supported-banner";
  const continueButtonTestId = "send-collectible-continue-button";
  let originalGetState: unknown;

  beforeAll(() => {
    originalGetState = (useTransactionSettingsStore as any).getState;
  });

  afterAll(() => {
    (useTransactionSettingsStore as any).getState = originalGetState;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
    mockAssessTransactionSecurity.mockReturnValue({
      level: SecurityLevel.SAFE,
      isMalicious: false,
      isSuspicious: false,
      isUnableToScan: false,
    });
    mockExtractSecurityWarnings.mockReturnValue([]);
  });

  /**
   * Keeps the default settings and swaps in the recipient. Returns the store's
   * build function, to see whether anything was built.
   *
   * prepareTransaction reads the settings fresh through `getState()`, which
   * the automock leaves returning undefined, so it is pointed at the same
   * state as the hook. Without that every build would throw before it called
   * the builder, and "nothing was built" would hold whatever the screen did.
   */
  const setRecipient = (recipientAddress: string) => {
    const settings = {
      ...mockUseTransactionSettingsStore(),
      recipientAddress,
    };
    mockUseTransactionSettingsStore.mockReturnValue(settings);
    (useTransactionSettingsStore as any).getState = jest
      .fn()
      .mockReturnValue(settings);

    return mockUseTransactionBuilderStore().buildSendCollectibleTransaction;
  };

  /**
   * Sets the recipient, then renders the screen and flushes what it starts on
   * mount, inside act.
   */
  const renderWithRecipient = async (recipientAddress: string) => {
    const buildSendCollectibleTransaction = setRecipient(recipientAddress);

    const view = renderWithProviders(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
    );
    await act(async () => {});

    return { ...view, buildSendCollectibleTransaction };
  };

  it("blocks a W: banner, Review disabled, nothing built", async () => {
    const {
      getByTestId,
      getByText,
      queryByText,
      buildSendCollectibleTransaction,
    } = await renderWithRecipient(MUXED_CONTRACT_ID_0);

    expect(getByTestId(bannerTestId)).toBeTruthy();
    expect(
      getByText("transactionAmountScreen.errors.muxedAddressNotSupported"),
    ).toBeTruthy();
    expect(
      getByTestId(continueButtonTestId).props.accessibilityState?.disabled,
    ).toBe(true);
    expect(buildSendCollectibleTransaction).not.toHaveBeenCalled();
    // The banner opens the W explanation, not the M one. The sheet is always
    // mounted in this file's bottom-sheet mock, so its description shows which
    // variant the screen passed it.
    expect(
      getByText(
        "transactionAmountScreen.errors.muxedContractWarning.description",
      ),
    ).toBeTruthy();
    expect(
      queryByText(
        "transactionAmountScreen.errors.muxedAddressWarning.description",
      ),
    ).toBeNull();
  });

  /**
   * Finds the first element of a component type in a React element tree. It
   * walks `props.children`, which is where BottomSheet puts its content.
   *
   * @param node The tree to search
   * @param type The component to look for
   * @returns The element, or undefined when the tree holds none
   */
  const findElementOfType = (
    node: React.ReactNode,
    type: React.ElementType,
  ): React.ReactElement | undefined => {
    if (Array.isArray(node)) {
      return node
        .map((child: React.ReactNode) => findElementOfType(child, type))
        .find(Boolean);
    }
    if (!React.isValidElement(node)) {
      return undefined;
    }
    if (node.type === type) {
      return node;
    }

    return findElementOfType(
      (node.props as { children?: React.ReactNode }).children,
      type,
    );
  };

  it("opens the W explanation from the banner", async () => {
    setRecipient(MUXED_CONTRACT_ID_0);
    // A host View has no ref in the test renderer, so each bottom sheet modal
    // (the only elements rendered `detached`) gets its own present() to
    // watch, kept with the content it holds.
    const sheets: { present: jest.Mock; content: React.ReactNode }[] = [];

    const { getByTestId } = render(
      <SendCollectibleReviewScreen
        navigation={mockNavigation}
        route={mockRoute}
      />,
      {
        // The settings sheet's inputs read the toast context.
        wrapper: ToastProvider,
        createNodeMock: (element) => {
          const props = element.props as {
            detached?: boolean;
            children?: React.ReactNode;
          };
          if (!props.detached) {
            return null;
          }
          const sheet = { present: jest.fn(), content: props.children };
          sheets.push(sheet);

          return { present: sheet.present, dismiss: jest.fn() };
        },
      },
    );
    await act(async () => {});

    fireEvent.press(getByTestId(bannerTestId));

    // Exactly one sheet opened, and it's the muxed address warning, in its W
    // variant.
    const opened = sheets.filter((sheet) => sheet.present.mock.calls.length);
    expect(opened).toHaveLength(1);
    expect(opened[0].present).toHaveBeenCalledTimes(1);
    expect(
      findElementOfType(opened[0].content, MuxedAddressWarningBottomSheet)
        ?.props,
    ).toMatchObject({ variant: "contract" });
  });

  it.each([
    ["a G account", G_ACCOUNT],
    ["a C contract", BASE_CONTRACT],
    ["an M account", M_ACCOUNT_ID_1234],
  ])(
    "does not block %s: no banner, Review enabled, simulation runs",
    async (_label, recipientAddress) => {
      const {
        getByTestId,
        getByText,
        queryByTestId,
        queryByText,
        buildSendCollectibleTransaction,
      } = await renderWithRecipient(recipientAddress);

      expect(queryByTestId(bannerTestId)).toBeNull();
      expect(
        getByTestId(continueButtonTestId).props.accessibilityState?.disabled,
      ).toBe(false);
      expect(buildSendCollectibleTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ destinationAccount: recipientAddress }),
      );
      // The sheet keeps its M explanation for everything but a W.
      expect(
        getByText(
          "transactionAmountScreen.errors.muxedAddressWarning.description",
        ),
      ).toBeTruthy();
      expect(
        queryByText(
          "transactionAmountScreen.errors.muxedContractWarning.description",
        ),
      ).toBeNull();
    },
  );

  describe("collectible image", () => {
    const imageTestId = "send-collectible-image";
    const imageSectionTestId = "send-collectible-image-section";

    it("hides the image on small screens for a W, so the banner and Review fit", async () => {
      const { getByTestId } = await renderWithRecipient(MUXED_CONTRACT_ID_0);

      expect(classNameOf(getByTestId(imageSectionTestId))).toContain(
        "max-xs:hidden",
      );
      // Wider screens keep the full-size image.
      const className = classNameOf(getByTestId(imageTestId));
      expect(className).toContain("w-[240px] h-[240px]");
      expect(className).not.toContain("max-xs:");
    });

    it.each([
      ["a G account", G_ACCOUNT],
      ["a C contract", BASE_CONTRACT],
      ["an M account", M_ACCOUNT_ID_1234],
    ])("keeps the full-size image for %s", async (_label, recipientAddress) => {
      const { getByTestId } = await renderWithRecipient(recipientAddress);

      expect(classNameOf(getByTestId(imageSectionTestId))).not.toContain(
        "max-xs:",
      );
      const className = classNameOf(getByTestId(imageTestId));
      expect(className).toContain("w-[240px] h-[240px]");
      expect(className).not.toContain("max-xs:");
    });
  });
});

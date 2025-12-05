import { NativeStackScreenProps } from "@react-navigation/native-stack";
import SendCollectibleReviewScreen from "components/screens/SendScreen/screens/SendCollectibleReview";
import { NETWORKS } from "config/constants";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { useCollectiblesStore } from "ducks/collectibles";
import { useHistoryStore } from "ducks/history";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { renderWithProviders } from "helpers/testUtils";
import * as blockaidService from "hooks/blockaid/useBlockaidTransaction";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useRightHeaderMenu } from "hooks/useRightHeader";
import * as useValidateTransactionMemo from "hooks/useValidateTransactionMemo";
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
jest.mock("components/blockaid/SecurityDetailBottomSheet", () => ({
  __esModule: true,
  default: function MockSecurityDetailBottomSheet(
    props: Record<string, unknown>,
  ) {
    mockSecurityDetailBottomSheetProps = props;
    return null;
  },
}));
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
    recipientAddress: mockRecipientAddress,
    selectedTokenId: "",
    selectedCollectibleDetails: {
      tokenId: "1",
      collectionAddress: "0xABCDEF123456789",
    },
    saveMemo: jest.fn(),
    saveTransactionFee: jest.fn(),
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
    recipientAddress: mockRecipientAddress,
    selectedTokenId: "",
    selectedCollectibleDetails: {
      tokenId: "1",
      collectionAddress: "0xABCDEF123456789",
    },
    saveMemo: jest.fn(),
    saveTransactionFee: jest.fn(),
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

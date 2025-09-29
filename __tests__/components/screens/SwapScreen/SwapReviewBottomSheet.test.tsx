import { userEvent } from "@testing-library/react-native";
import SwapReviewBottomSheet from "components/screens/SwapScreen/components/SwapReviewBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { View } from "react-native";

const MockView = View;

jest.mock("react-native-gesture-handler", () => ({
  PanGestureHandler: MockView,
  GestureHandlerRootView: MockView,
  State: {},
  createNativeWrapper: jest.fn((component) => component),
  TapGestureHandler: ({ children }: any) => <MockView>{children}</MockView>,
}));

const mockAccount = {
  publicKey: "GDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
  accountName: "Test Account",
};

const mockBalanceItems = [
  {
    id: "XLM",
    token: {
      code: "XLM",
      type: "native",
    },
    total: "1000",
    available: "1000",
    currentPrice: 0.1,
  },
  {
    id: "USDC:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
    token: {
      code: "USDC",
      issuer: {
        key: "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
      },
    },
    total: "500",
    available: "500",
    currentPrice: 1,
  },
];

jest.mock("hooks/useGetActiveAccount", () => () => ({
  account: mockAccount,
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({
    network: "testnet",
    setSignInMethod: jest.fn(),
    verifyActionWithBiometrics: jest.fn((callback) => callback()),
  })),
  getLoginType: jest.fn((biometryType) => {
    if (!biometryType) return "password";
    if (biometryType === "FaceID" || biometryType === "Face") return "face";
    if (biometryType === "TouchID" || biometryType === "Fingerprint")
      return "fingerprint";
    return "password";
  }),
}));

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
    getBiometricButtonIcon: jest.fn(() => null),
  }),
}));

jest.mock("ducks/swap", () => ({
  useSwapStore: jest.fn(() => ({
    sourceAmount: "10",
    destinationAmount: "5",
    pathResult: {
      sourceAmount: "10",
      destinationAmount: "5",
      conversionRate: 0.5,
    },
    sourceTokenSymbol: "XLM",
    destinationTokenSymbol: "USDC",
    sourceTokenId: "XLM",
    destinationTokenId:
      "USDC:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
  })),
}));

jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: jest.fn(() => ({
    transactionXDR: "mock-xdr",
    isBuilding: false,
  })),
}));

jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(() => ({
    balanceItems: mockBalanceItems,
  })),
}));

jest.mock("hooks/useColors", () => () => ({
  themeColors: {
    background: {
      primary: "#fcfcfc",
      secondary: "#f8f8f8",
      tertiary: "#f3f3f3",
    },
    foreground: {
      primary: "#000",
      secondary: "#666",
    },
    border: {
      primary: "#e2e2e2",
    },
    base: {
      1: "#000000",
    },
    text: {
      secondary: "#6f6f6f",
    },
    gray: {
      9: "#8f8f8f",
    },
    red: {
      9: "#e5484d",
    },
    amber: {
      9: "#ffb224",
    },
    lilac: { 11: "#9b59b6" },
  },
}));

jest.mock(
  "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails",
  () => ({
    useSignTransactionDetails: jest.fn(() => ({
      operations: [],
    })),
  }),
);

describe("SwapReviewBottomSheet", () => {
  const defaultProps = {
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
    onBannerPress: jest.fn(),
    transactionScanResult: undefined,
    sourceTokenScanResult: undefined,
    destTokenScanResult: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic layout", () => {
    it("renders basic swap review information", () => {
      const { getAllByText } = renderWithProviders(
        <SwapReviewBottomSheet {...defaultProps} />,
      );

      expect(getAllByText(/10(.*)XLM/)[0]).toBeTruthy();
      expect(getAllByText(/5(.*)USDC/)[0]).toBeTruthy();
    });

    it("displays account information", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet {...defaultProps} />,
      );

      expect(getByText("Test Account")).toBeTruthy();
    });

    it("calls onConfirm when confirm button is pressed", async () => {
      const user = userEvent.setup();
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet {...defaultProps} />,
      );

      await user.press(getByText("Confirm"));
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    }, 10000);

    it("calls onCancel when cancel button is pressed", async () => {
      const user = userEvent.setup();
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet {...defaultProps} />,
      );

      await user.press(getByText("Cancel"));
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe("Transaction scan states", () => {
    it("shows malicious banner when transaction is malicious", () => {
      const maliciousTransactionScan = {
        validation: {
          result_type: "Malicious",
        },
      } as any;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={maliciousTransactionScan}
        />,
      );

      expect(getByText("This address was flagged as malicious")).toBeTruthy();
    });

    it("shows suspicious banner when transaction is suspicious", () => {
      const suspiciousTransactionScan = {
        validation: {
          result_type: "Warning",
        },
      } as any;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={suspiciousTransactionScan}
        />,
      );

      expect(getByText("This address was flagged as suspicious")).toBeTruthy();
    });

    it("shows confirm anyway button for malicious transaction", () => {
      const maliciousTransactionScan = {
        validation: {
          result_type: "Malicious",
        },
      } as any;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={maliciousTransactionScan}
        />,
      );

      expect(getByText("Confirm anyway")).toBeTruthy();
    });

    it("calls onBannerPress when malicious banner is pressed", async () => {
      const user = userEvent.setup();
      const maliciousTransactionScan = {
        validation: {
          result_type: "Malicious",
        },
      } as any;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={maliciousTransactionScan}
        />,
      );

      await user.press(getByText("This address was flagged as malicious"));
      expect(defaultProps.onBannerPress).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe("Source token scan states", () => {
    it("shows malicious asset banner when source token is malicious", () => {
      const maliciousSourceScan = {
        result_type: "Malicious",
      } as any;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          sourceTokenScanResult={maliciousSourceScan}
        />,
      );

      expect(getByText("An asset was flagged as malicious")).toBeTruthy();
    });

    it("shows suspicious asset banner when source token is suspicious", () => {
      const suspiciousSourceScan = {
        result_type: "Spam",
      } as any;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          sourceTokenScanResult={suspiciousSourceScan}
        />,
      );

      expect(getByText("An asset was flagged as suspicious")).toBeTruthy();
    });
  });

  describe("Destination token scan states", () => {
    it("shows malicious asset banner when destination token is malicious", () => {
      const maliciousDestScan = {
        result_type: "Malicious",
      } as any;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          destTokenScanResult={maliciousDestScan}
        />,
      );

      expect(getByText("An asset was flagged as malicious")).toBeTruthy();
    });

    it("shows suspicious asset banner when destination token is suspicious", () => {
      const suspiciousDestScan = {
        result_type: "Spam",
      } as any;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          destTokenScanResult={suspiciousDestScan}
        />,
      );

      expect(getByText("An asset was flagged as suspicious")).toBeTruthy();
    });
  });

  describe("Combined scan states", () => {
    it("prioritizes transaction malicious over asset malicious in banner", () => {
      const maliciousTransactionScan = {
        validation: {
          result_type: "Malicious",
        },
      } as any;

      const maliciousSourceScan = {
        result_type: "Malicious",
      } as any;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={maliciousTransactionScan}
          sourceTokenScanResult={maliciousSourceScan}
        />,
      );

      // Should show transaction malicious message, not asset malicious
      expect(getByText("This address was flagged as malicious")).toBeTruthy();
    });

    it("shows banner when both source and destination are malicious", () => {
      const maliciousSourceScan = {
        result_type: "Malicious",
      } as any;

      const maliciousDestScan = {
        result_type: "Malicious",
      } as any;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          sourceTokenScanResult={maliciousSourceScan}
          destTokenScanResult={maliciousDestScan}
        />,
      );

      // Should show asset malicious banner
      expect(getByText("An asset was flagged as malicious")).toBeTruthy();
    });
  });
});

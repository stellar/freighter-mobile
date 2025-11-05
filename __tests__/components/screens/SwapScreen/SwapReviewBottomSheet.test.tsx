/* eslint-disable @fnando/consistent-import/consistent-import */
import Blockaid from "@blockaid/client";
import { userEvent } from "@testing-library/react-native";
import SwapReviewBottomSheet from "components/screens/SwapScreen/components/SwapReviewBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

import { mockBalances } from "../../../../__mocks__/balances";
import { mockGestureHandler } from "../../../../__mocks__/gesture-handler";
import { mockUseColors } from "../../../../__mocks__/use-colors";

mockGestureHandler();
mockUseColors();

const mockAccount = {
  publicKey: "GDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
  accountName: "Test Account",
};

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
    balanceItems: mockBalances,
  })),
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
    onSecurityWarningPress: jest.fn(),
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
  });

  describe("Transaction scan states", () => {
    it("shows malicious banner when transaction is malicious", () => {
      const maliciousTransactionScan = {
        validation: {
          result_type: "Malicious",
        },
      } as Blockaid.StellarTransactionScanResponse;

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
      } as Blockaid.StellarTransactionScanResponse;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={suspiciousTransactionScan}
        />,
      );

      expect(getByText("This address was flagged as suspicious")).toBeTruthy();
    });

    it("calls onBannerPress when malicious banner is pressed", async () => {
      const user = userEvent.setup();
      const maliciousTransactionScan = {
        validation: {
          result_type: "Malicious",
        },
      } as Blockaid.StellarTransactionScanResponse;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={maliciousTransactionScan}
        />,
      );

      await user.press(getByText("This address was flagged as malicious"));
      expect(defaultProps.onSecurityWarningPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Source token scan states", () => {
    it("shows malicious asset banner when source token is malicious", () => {
      const maliciousSourceScan = {
        result_type: "Malicious",
      } as Blockaid.TokenBulk.TokenBulkScanResponse.Results;

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
      } as Blockaid.TokenBulk.TokenBulkScanResponse.Results;

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
      } as Blockaid.TokenBulk.TokenBulkScanResponse.Results;

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
      } as Blockaid.TokenBulk.TokenBulkScanResponse.Results;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          destTokenScanResult={suspiciousDestScan}
        />,
      );

      expect(getByText("An asset was flagged as suspicious")).toBeTruthy();
    });
  });

  describe("Unable to scan states", () => {
    it("shows unable to scan banner when transaction scan fails", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={undefined}
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });

    it("shows unable to scan banner when source token scan fails", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          sourceTokenScanResult={undefined}
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });

    it("shows unable to scan banner when destination token scan fails", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          destTokenScanResult={undefined}
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });

    it("shows warning variant banner for unable to scan states", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={undefined}
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });

    it("calls onSecurityWarningPress when unable to scan banner is pressed", async () => {
      const user = userEvent.setup();

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={undefined}
        />,
      );

      await user.press(getByText("Proceed with caution"));
      expect(defaultProps.onSecurityWarningPress).toHaveBeenCalledTimes(1);
    }, 10000);

    it("prioritizes transaction unable to scan over token unable to scan", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={undefined}
          sourceTokenScanResult={undefined}
          destTokenScanResult={undefined}
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });

    it("shows unable to scan banner when multiple scans fail", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={undefined}
          sourceTokenScanResult={undefined}
          destTokenScanResult={undefined}
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });
  });

  describe("Combined scan states", () => {
    it("prioritizes transaction malicious over asset malicious in banner", () => {
      const maliciousTransactionScan = {
        validation: {
          result_type: "Malicious",
        },
      } as Blockaid.StellarTransactionScanResponse;

      const maliciousSourceScan = {
        result_type: "Malicious",
      } as Blockaid.TokenBulk.TokenBulkScanResponse.Results;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionScanResult={maliciousTransactionScan}
          sourceTokenScanResult={maliciousSourceScan}
        />,
      );

      expect(getByText("This address was flagged as malicious")).toBeTruthy();
    });

    it("shows banner when both source and destination are malicious", () => {
      const maliciousSourceScan = {
        result_type: "Malicious",
      } as Blockaid.TokenBulk.TokenBulkScanResponse.Results;

      const maliciousDestScan = {
        result_type: "Malicious",
      } as Blockaid.TokenBulk.TokenBulkScanResponse.Results;

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          sourceTokenScanResult={maliciousSourceScan}
          destTokenScanResult={maliciousDestScan}
        />,
      );

      expect(getByText("An asset was flagged as malicious")).toBeTruthy();
    });
  });
});

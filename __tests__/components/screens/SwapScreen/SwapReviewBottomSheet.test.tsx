/* eslint-disable @fnando/consistent-import/consistent-import */
import Blockaid from "@blockaid/client";
import { userEvent } from "@testing-library/react-native";
import SwapReviewBottomSheet from "components/screens/SwapScreen/components/SwapReviewBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import React, { act } from "react";

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
    }, 50000);

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

    it("shows confirm anyway button for malicious transaction", () => {
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

      expect(getByText("Confirm anyway")).toBeTruthy();
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
      expect(defaultProps.onBannerPress).toHaveBeenCalledTimes(1);
    }, 10000);
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

      // Should show transaction malicious message, not asset malicious
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

      // Should show asset malicious banner
      expect(getByText("An asset was flagged as malicious")).toBeTruthy();
    });
  });
});

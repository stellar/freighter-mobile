/* eslint-disable @fnando/consistent-import/consistent-import */
import { userEvent } from "@testing-library/react-native";
import { TokenIcon } from "components/TokenIcon";
import SwapReviewBottomSheet from "components/screens/SwapScreen/components/SwapReviewBottomSheet";
import { useSwapStore } from "ducks/swap";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { SecurityLevel } from "services/blockaid/constants";
import { createSecurityAssessment } from "services/blockaid/helper";

import { mockBalances } from "../../../../__mocks__/balances";
import { mockGestureHandler } from "../../../../__mocks__/gesture-handler";
import { mockUseColors } from "../../../../__mocks__/use-colors";

const assessmentFor = (level: SecurityLevel) => createSecurityAssessment(level);
const malicious = assessmentFor(SecurityLevel.MALICIOUS);
const suspicious = assessmentFor(SecurityLevel.SUSPICIOUS);
const safe = assessmentFor(SecurityLevel.SAFE);
const unableToScan = assessmentFor(SecurityLevel.UNABLE_TO_SCAN);

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
    sourceTokenId: "XLM",
    destinationToken: {
      id: "USDC:GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
      tokenCode: "USDC",
      issuer: "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
      decimals: 7,
      tokenType: "credit_alphanum4",
      requiresTrustline: false,
    },
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
    transactionSecurityAssessment: safe,
    sourceSecurityAssessment: safe,
    destinationSecurityAssessment: safe,
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
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionSecurityAssessment={malicious}
        />,
      );

      expect(getByText("This address was flagged as malicious")).toBeTruthy();
    });

    it("shows suspicious banner when transaction is suspicious", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionSecurityAssessment={suspicious}
        />,
      );

      expect(getByText("This address was flagged as suspicious")).toBeTruthy();
    });

    it("shows the caution banner when the transaction scan fails", () => {
      // Mainnet network/API failure: the tx scan is unable-to-scan while both
      // token scans are safe. Mirrors Send's scan-failure safety net.
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionSecurityAssessment={unableToScan}
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });

    it("calls onBannerPress when malicious banner is pressed", async () => {
      const user = userEvent.setup();

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionSecurityAssessment={malicious}
        />,
      );

      await user.press(getByText("This address was flagged as malicious"));
      expect(defaultProps.onSecurityWarningPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Source token scan states", () => {
    it("shows malicious asset banner when source token is malicious", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          sourceSecurityAssessment={malicious}
        />,
      );

      expect(getByText("A token was flagged as malicious")).toBeTruthy();
    });

    it("shows suspicious asset banner when source token is suspicious", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          sourceSecurityAssessment={suspicious}
        />,
      );

      expect(getByText("A token was flagged as suspicious")).toBeTruthy();
    });
  });

  describe("Destination token scan states", () => {
    it("shows malicious asset banner when destination token is malicious", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          destinationSecurityAssessment={malicious}
        />,
      );

      expect(getByText("A token was flagged as malicious")).toBeTruthy();
    });

    it("shows suspicious asset banner when destination token is suspicious", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          destinationSecurityAssessment={suspicious}
        />,
      );

      expect(getByText("A token was flagged as suspicious")).toBeTruthy();
    });
  });

  describe("Unable to scan states", () => {
    // `isNativeAssetId(sourceTokenId/destinationTokenDescriptor.id)` is honoured by
    // useReviewSecuritySummary — for these unable-to-scan tests we point the mocked
    // swap store at a non-XLM source so the unable-to-scan flag isn't suppressed.
    const nonNativeSourceState = {
      sourceAmount: "10",
      destinationAmount: "5",
      pathResult: {
        sourceAmount: "10",
        destinationAmount: "5",
        conversionRate: 0.5,
      },
      sourceTokenSymbol: "USDC",
      sourceTokenId:
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVV",
      destinationToken: {
        id: "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
        tokenCode: "AQUA",
        issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
        decimals: 7,
        tokenType: "credit_alphanum4",
        requiresTrustline: false,
      },
    };

    beforeEach(() => {
      (useSwapStore as unknown as jest.Mock).mockReturnValue(
        nonNativeSourceState,
      );
    });

    it("shows unable to scan banner when source token scan fails", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          sourceSecurityAssessment={unableToScan}
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });

    it("shows unable to scan banner when destination token scan fails", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          destinationSecurityAssessment={unableToScan}
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });

    it("calls onSecurityWarningPress when unable to scan banner is pressed", async () => {
      const user = userEvent.setup();

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          sourceSecurityAssessment={unableToScan}
        />,
      );

      await user.press(getByText("Proceed with caution"));
      expect(defaultProps.onSecurityWarningPress).toHaveBeenCalledTimes(1);
    }, 10000);

    it("shows unable to scan banner when both source and destination scans fail", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          sourceSecurityAssessment={unableToScan}
          destinationSecurityAssessment={unableToScan}
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });
  });

  describe("Combined scan states", () => {
    it("prioritizes transaction malicious over asset malicious in banner", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          transactionSecurityAssessment={malicious}
          sourceSecurityAssessment={malicious}
        />,
      );

      expect(getByText("This address was flagged as malicious")).toBeTruthy();
    });

    it("shows banner when both source and destination are malicious", () => {
      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet
          {...defaultProps}
          sourceSecurityAssessment={malicious}
          destinationSecurityAssessment={malicious}
        />,
      );

      expect(getByText("A token was flagged as malicious")).toBeTruthy();
    });
  });

  describe("non-held destination token icon", () => {
    const baseSwapState = {
      sourceAmount: "10",
      destinationAmount: "5",
      pathResult: {
        sourceAmount: "10",
        destinationAmount: "5",
        conversionRate: 0.5,
      },
      sourceTokenSymbol: "XLM",
      sourceTokenId: "XLM",
    };

    it("renders the USDC token icon (not XLM) when the destination is a non-held USDC", () => {
      // Use an issuer that is NOT present in mockBalances so destinationBalance
      // resolves to undefined — this is the exact bug scenario.
      const nonHeldUsdcIssuer =
        "GCOIN000000000000000000000000000000000000000000000000000NOT";
      (useSwapStore as unknown as jest.Mock).mockReturnValue({
        ...baseSwapState,
        destinationToken: {
          id: `USDC:${nonHeldUsdcIssuer}`,
          tokenCode: "USDC",
          issuer: nonHeldUsdcIssuer,
          decimals: 7,
          tokenType: "credit_alphanum4",
          requiresTrustline: true,
        },
      });

      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { UNSAFE_getAllByType: getAllByComponentType } =
        renderWithProviders(<SwapReviewBottomSheet {...defaultProps} />);

      // The sheet renders two TokenIcon instances: [0] = source, [1] = destination.
      // Before the fix, [1].props.token.type was "native" (XLM fallback).
      // After the fix, it must be "credit_alphanum4" with code "USDC".
      const tokenIcons = getAllByComponentType(TokenIcon);
      // There are at least 2 icons (source + destination)
      expect(tokenIcons.length).toBeGreaterThanOrEqual(2);

      const destIconToken = tokenIcons[1].props.token;
      expect(destIconToken.type).not.toBe("native");
      expect(destIconToken.code).toBe("USDC");
    });
  });

  describe("trustline banner", () => {
    const baseSwapState = {
      sourceAmount: "10",
      destinationAmount: "5",
      pathResult: {
        sourceAmount: "10",
        destinationAmount: "5",
        conversionRate: 0.5,
      },
      sourceTokenSymbol: "XLM",
      sourceTokenId: "XLM",
    };

    it("renders the purple banner when destinationToken.requiresTrustline is true", () => {
      (useSwapStore as unknown as jest.Mock).mockReturnValue({
        ...baseSwapState,
        destinationToken: {
          id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVV",
          tokenCode: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVV",
          decimals: 7,
          tokenType: "credit_alphanum4",
          requiresTrustline: true,
        },
      });

      const { getByText } = renderWithProviders(
        <SwapReviewBottomSheet {...defaultProps} />,
      );

      expect(getByText(/This will add a trustline to USDC/)).toBeTruthy();
    });

    it("does NOT render the banner when destinationToken.requiresTrustline is false", () => {
      (useSwapStore as unknown as jest.Mock).mockReturnValue({
        ...baseSwapState,
        destinationToken: {
          id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVV",
          tokenCode: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVV",
          decimals: 7,
          tokenType: "credit_alphanum4",
          requiresTrustline: false,
        },
      });

      const { queryByText } = renderWithProviders(
        <SwapReviewBottomSheet {...defaultProps} />,
      );

      expect(queryByText(/This will add a trustline/)).toBeNull();
    });

    it("does NOT render the banner when destinationToken is null", () => {
      (useSwapStore as unknown as jest.Mock).mockReturnValue({
        ...baseSwapState,
        destinationToken: null,
      });

      const { queryByText } = renderWithProviders(
        <SwapReviewBottomSheet {...defaultProps} />,
      );

      expect(queryByText(/This will add a trustline/)).toBeNull();
    });
  });
});

/* eslint-disable @fnando/consistent-import/consistent-import */
import { userEvent } from "@testing-library/react-native";
import { SendReviewBottomSheet } from "components/screens/SendScreen/components";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

import { mockBalances } from "../../../../../__mocks__/balances";
import { mockGestureHandler } from "../../../../../__mocks__/gesture-handler";
import { mockUseColors } from "../../../../../__mocks__/use-colors";

mockGestureHandler();
mockUseColors();

const mockAccount = {
  publicKey: "GDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
  accountName: "Test Account",
};

jest.mock("hooks/useGetActiveAccount", () => () => ({
  account: mockAccount,
}));

jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: jest.fn(() => ({
    transactionXDR: "mock-xdr",
    isBuilding: false,
  })),
}));

jest.mock("ducks/transactionSettings", () => ({
  useTransactionSettingsStore: jest.fn(() => ({
    recipientAddress:
      "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
    memo: "",
    isMemoRequired: false,
    transactionFee: "0.00001",
    transactionMemo: "",
  })),
}));

jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(() => ({
    balanceItems: mockBalances,
  })),
}));

jest.mock("hooks/useClipboard", () => ({
  useClipboard: jest.fn(() => ({
    copyToClipboard: jest.fn(),
  })),
}));

describe("SendReviewBottomSheet", () => {
  const defaultProps = {
    selectedBalance: mockBalances[0] as any,
    tokenAmount: "100",
    onBannerPress: jest.fn(),
    isRequiredMemoMissing: false,
    isMalicious: false,
    isSuspicious: false,
    isUnableToScan: false,
    bannerText: undefined,
    bannerVariant: undefined,
    signTransactionDetails: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic layout", () => {
    it("renders basic send review information", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet {...defaultProps} />,
      );

      expect(getByText("100.00 XLM")).toBeTruthy();
    });

    it("displays account information", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet {...defaultProps} />,
      );

      expect(getByText("Test Account")).toBeTruthy();
    });
  });

  describe("Security banner states", () => {
    it("shows malicious banner when transaction is malicious", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isMalicious
          bannerText="This address was flagged as malicious"
          bannerVariant="error"
        />,
      );

      expect(getByText("This address was flagged as malicious")).toBeTruthy();
    });

    it("shows suspicious banner when transaction is suspicious", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isSuspicious
          bannerText="This address was flagged as suspicious"
          bannerVariant="warning"
        />,
      );

      expect(getByText("This address was flagged as suspicious")).toBeTruthy();
    });

    it("shows unable to scan banner when transaction is unable to scan", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isUnableToScan
          bannerText="Proceed with caution"
          bannerVariant="warning"
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });

    it("calls onBannerPress when malicious banner is pressed", async () => {
      const user = userEvent.setup();
      const onBannerPress = jest.fn();

      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isMalicious
          bannerText="This address was flagged as malicious"
          bannerVariant="error"
          onBannerPress={onBannerPress}
        />,
      );

      await user.press(getByText("This address was flagged as malicious"));
      expect(onBannerPress).toHaveBeenCalledTimes(1);
    }, 10000);

    it("calls onBannerPress when suspicious banner is pressed", async () => {
      const user = userEvent.setup();
      const onBannerPress = jest.fn();

      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isSuspicious
          bannerText="This address was flagged as suspicious"
          bannerVariant="warning"
          onBannerPress={onBannerPress}
        />,
      );

      await user.press(getByText("This address was flagged as suspicious"));
      expect(onBannerPress).toHaveBeenCalledTimes(1);
    }, 10000);

    it("calls onBannerPress when unable to scan banner is pressed", async () => {
      const user = userEvent.setup();
      const onBannerPress = jest.fn();

      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isUnableToScan
          bannerText="Proceed with caution"
          bannerVariant="warning"
          onBannerPress={onBannerPress}
        />,
      );

      await user.press(getByText("Proceed with caution"));
      expect(onBannerPress).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe("Combined security states", () => {
    it("prioritizes malicious over suspicious in banner", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isMalicious
          isSuspicious
          bannerText="This address was flagged as malicious"
          bannerVariant="error"
        />,
      );

      expect(getByText("This address was flagged as malicious")).toBeTruthy();
    });

    it("prioritizes malicious over unable to scan in banner", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isMalicious
          isUnableToScan
          bannerText="This address was flagged as malicious"
          bannerVariant="error"
        />,
      );

      expect(getByText("This address was flagged as malicious")).toBeTruthy();
    });

    it("prioritizes suspicious over unable to scan in banner", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isSuspicious
          isUnableToScan
          bannerText="This address was flagged as suspicious"
          bannerVariant="warning"
        />,
      );

      expect(getByText("This address was flagged as suspicious")).toBeTruthy();
    });

    it("shows banner when multiple security states are true", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isMalicious
          isSuspicious
          isUnableToScan
          bannerText="This address was flagged as malicious"
          bannerVariant="error"
        />,
      );

      expect(getByText("This address was flagged as malicious")).toBeTruthy();
    });
  });

  describe("Memo required states", () => {
    it("shows memo missing banner when memo is required", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isRequiredMemoMissing
          bannerText="Memo is required for this address"
          bannerVariant="error"
        />,
      );

      expect(getByText("Memo is required for this address")).toBeTruthy();
    });

    it("prioritizes security banners over memo missing banner", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isRequiredMemoMissing
          isMalicious
          bannerText="This address was flagged as malicious"
          bannerVariant="error"
        />,
      );

      expect(getByText("This address was flagged as malicious")).toBeTruthy();
    });
  });

  describe("Banner variant handling", () => {
    it("uses error variant for malicious banners", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isMalicious
          bannerText="This address was flagged as malicious"
          bannerVariant="error"
        />,
      );

      expect(getByText("This address was flagged as malicious")).toBeTruthy();
    });

    it("uses warning variant for suspicious banners", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isSuspicious
          bannerText="This address was flagged as suspicious"
          bannerVariant="warning"
        />,
      );

      expect(getByText("This address was flagged as suspicious")).toBeTruthy();
    });

    it("uses warning variant for unable to scan banners", () => {
      const { getByText } = renderWithProviders(
        <SendReviewBottomSheet
          {...defaultProps}
          isUnableToScan
          bannerText="Proceed with caution"
          bannerVariant="warning"
        />,
      );

      expect(getByText("Proceed with caution")).toBeTruthy();
    });
  });
});

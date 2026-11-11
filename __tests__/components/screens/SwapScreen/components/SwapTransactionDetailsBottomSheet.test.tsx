/* eslint-disable @fnando/consistent-import/consistent-import */
import SwapTransactionDetailsBottomSheet from "components/screens/SwapScreen/components/SwapTransactionDetailsBottomSheet";
import { NativeToken, NonNativeToken } from "config/types";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

import { mockUseColors } from "../../../../../__mocks__/use-colors";

mockUseColors();

jest.mock("hooks/useGetActiveAccount", () => () => ({
  account: { publicKey: "GACCOUNT", accountName: "Test Account" },
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({ network: "testnet" })),
}));

jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: jest.fn(),
}));

jest.mock("ducks/prices", () => ({
  usePricesForNetwork: jest.fn(() => ({})),
}));

jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(() => ({ balanceItems: [] })),
}));

jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({ open: jest.fn() }),
}));

jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: jest.fn() }),
}));

const xlm = { code: "XLM", type: "native" } as NativeToken;
const usdc = {
  code: "USDC",
  type: "credit_alphanum4",
  issuer: { key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
} as NonNativeToken;

const builderState = (swapReview: { minReceived?: string } | null) => ({
  transactionXDR: "xdr",
  transactionHash: null,
  error: null,
  isSubmitting: false,
  swapReview,
});

const renderSheet = () =>
  renderWithProviders(
    <SwapTransactionDetailsBottomSheet
      sourceAmount="100"
      sourceToken={xlm}
      destinationAmount="17.2"
      destinationToken={usdc}
    />,
  );

describe("SwapTransactionDetailsBottomSheet", () => {
  it("shows the minimum the signed transaction guarantees", () => {
    (useTransactionBuilderStore as unknown as jest.Mock).mockReturnValue(
      builderState({ sendAmount: "100", minReceived: "17.1941798" } as never),
    );

    const { getByText } = renderSheet();

    expect(getByText("17.1941798 USDC")).toBeTruthy();
  });

  it("falls back to quote × slippage when the transaction has no minimum", () => {
    (useTransactionBuilderStore as unknown as jest.Mock).mockReturnValue(
      builderState({ sendAmount: "100" } as never),
    );

    const { getByText } = renderSheet();

    // 17.2 at the settings store's default 2% slippage.
    expect(getByText("16.856 USDC")).toBeTruthy();
  });
});

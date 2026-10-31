import {
  G_ACCOUNT,
  MUXED_CONTRACT_ID_1234,
} from "__tests__/support/muxedContractFixtures";
import { TransactionDetailsBottomSheetCustomContent } from "components/screens/HistoryScreen/TransactionDetailsBottomSheetCustomContent";
import {
  TransactionDetails,
  TransactionStatus,
  TransactionType,
} from "components/screens/HistoryScreen/types";
import { SorobanTokenInterface } from "helpers/soroban";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => key,
}));

const NATIVE_SAC_TESTNET =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const base = {
  operation: { created_at: "2026-11-03T12:00:00Z" },
  transactionTitle: "title",
  status: TransactionStatus.SUCCESS,
  fee: "100",
  xdr: "AAAA",
  externalUrl: "",
  IconComponent: null,
  ActionIconComponent: null,
};

describe("TransactionDetailsBottomSheetCustomContent for a transfer to a muxed contract (W)", () => {
  it.each([
    [
      "a contract row built from balance changes",
      {
        transactionType: TransactionType.CONTRACT,
        assetDiffs: [
          {
            assetCode: "XLM",
            assetIssuer: null,
            decimals: 7,
            amount: "5",
            isCredit: false,
            destination: MUXED_CONTRACT_ID_1234,
          },
        ],
      },
    ],
    [
      "a direct SAC transfer",
      {
        transactionType: TransactionType.CONTRACT_TRANSFER,
        contractDetails: {
          contractAddress: NATIVE_SAC_TESTNET,
          contractSymbol: "XLM",
          contractDecimals: 7,
          sorobanTokenInterface: SorobanTokenInterface.transfer,
          transferDetails: {
            from: G_ACCOUNT,
            to: MUXED_CONTRACT_ID_1234,
            amount: "50000000",
          },
        },
      },
    ],
  ])("shows the W and no memo row for %s", (_, fields) => {
    const { getByText, queryByText } = renderWithProviders(
      <TransactionDetailsBottomSheetCustomContent
        transactionDetails={
          { ...base, ...fields } as unknown as TransactionDetails
        }
      />,
    );

    expect(getByText("WA7Q...LLEM")).toBeTruthy();
    expect(queryByText("transactionAmountScreen.details.memo")).toBeNull();
    // No mux-id row either: 1234 only exists inside the W.
    expect(queryByText(/1234/)).toBeNull();
  });
});

import {
  Account,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  BASE_CONTRACT,
  G_ACCOUNT,
  M_ACCOUNT_ID_1234,
  MUXED_CONTRACT_ID_0,
} from "__tests__/support/muxedContractFixtures";
import TransactionDetailsBottomSheet from "components/TransactionDetailsBottomSheet";
import { NETWORKS } from "config/constants";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const mockNetwork = NETWORKS.TESTNET;
const mockAccount = { publicKey: G_ACCOUNT, accountName: "Test Account" };

// A transaction with no memo of its own, so the memo row can only come from
// the settings store.
const mockTransactionXdr = new TransactionBuilder(new Account(G_ACCOUNT, "1"), {
  fee: "100",
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.bumpSequence({ bumpTo: "2" }))
  .setTimeout(30)
  .build()
  .toXDR();

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({ network: mockNetwork })),
}));

jest.mock("hooks/useGetActiveAccount", () => () => ({
  account: mockAccount,
}));

jest.mock("ducks/transactionSettings", () => ({
  useTransactionSettingsStore: jest.fn(),
}));

jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: jest.fn(() => ({
    transactionXDR: mockTransactionXdr,
    transactionHash: null,
    error: null,
    isSubmitting: false,
  })),
}));

jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(() => ({ balanceItems: [] })),
}));

jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: jest.fn(() => ({ getCollectible: () => undefined })),
}));

jest.mock("hooks/useClipboard", () => ({
  useClipboard: jest.fn(() => ({ copyToClipboard: jest.fn() })),
}));

jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: jest.fn(() => ({ open: jest.fn() })),
}));

jest.mock("services/stellar", () => ({
  getTransactionDetails: jest.fn(),
}));

jest.mock("components/TokenIcon", () => ({ TokenIcon: () => null }));
jest.mock("components/CollectibleImage", () => ({
  CollectibleImage: () => null,
}));
jest.mock("components/sds/Avatar", () => () => null);

const mockUseTransactionSettingsStore =
  useTransactionSettingsStore as unknown as jest.Mock;

/**
 * Points the mocked settings store at a recipient and a stored memo, with no
 * collectible selected.
 *
 * @param recipientAddress The address the send is going to
 * @param transactionMemo The memo held in the settings store
 */
const mockSettings = (recipientAddress: string, transactionMemo: string) => {
  mockUseTransactionSettingsStore.mockReturnValue({
    recipientAddress,
    transactionMemo,
    selectedTokenId: "",
    selectedCollectibleDetails: { collectionAddress: "", tokenId: "" },
  });
};

describe("TransactionDetailsBottomSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Memo row", () => {
    it("shows the memo row and memo for a G recipient", () => {
      mockSettings(G_ACCOUNT, "hello");

      const { getByText } = renderWithProviders(
        <TransactionDetailsBottomSheet type="token" transactionAmount="1" />,
      );

      expect(getByText("Memo")).toBeTruthy();
      expect(getByText("hello")).toBeTruthy();
    });

    it("hides the memo row for a W recipient, even with a stored memo", () => {
      mockSettings(MUXED_CONTRACT_ID_0, "hello");

      const { queryByText } = renderWithProviders(
        <TransactionDetailsBottomSheet type="token" transactionAmount="1" />,
      );

      expect(queryByText("Memo")).toBeNull();
      expect(queryByText("hello")).toBeNull();
    });

    it("hides the memo row for an M recipient, even with a stored memo", () => {
      mockSettings(M_ACCOUNT_ID_1234, "hello");

      const { queryByText } = renderWithProviders(
        <TransactionDetailsBottomSheet type="token" transactionAmount="1" />,
      );

      expect(queryByText("Memo")).toBeNull();
      expect(queryByText("hello")).toBeNull();
    });

    it("shows the memo row and memo for a C recipient", () => {
      mockSettings(BASE_CONTRACT, "hello");

      const { getByText } = renderWithProviders(
        <TransactionDetailsBottomSheet type="token" transactionAmount="1" />,
      );

      expect(getByText("Memo")).toBeTruthy();
      expect(getByText("hello")).toBeTruthy();
    });
  });
});

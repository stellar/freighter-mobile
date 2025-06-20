import { Horizon } from "@stellar/stellar-sdk";
import { renderHook, waitFor } from "@testing-library/react-native";
import { PUBLIC_NETWORK_DETAILS } from "config/constants";
import { useGetHistoryData } from "hooks/useGetHistoryData";
import * as backendService from "services/backend";

jest.mock("services/backend");
jest.mock("ducks/balances", () => ({
  useBalancesStore: () => ({
    fetchAccountBalances: jest.fn(),
    getBalances: jest.fn(() => ({})),
  }),
}));

const mockBackendService = backendService as jest.Mocked<typeof backendService>;

type TestOperationRecord = Horizon.ServerApi.OperationRecord & {
  transaction_attr?: {
    operation_count?: number;
    successful?: boolean;
  };
};

describe("useGetHistoryData - Hide create claimable balance spam", () => {
  const mockPublicKey =
    "GCKUVXILBNYS4FDNWCGCYSJBY2PBQ4KAW2M5CODRVJPUFM62IJFH67J2";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should filter out create_claimable_balance operations with more than 50 operations", async () => {
    const mockHistoryData: TestOperationRecord[] = [
      {
        amount: "0.0010000",
        asset_code: "USDC",
        asset_issuer:
          "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        asset_type: "credit_alphanum4",
        created_at: "2025-03-21T22:28:46Z",
        from: "GDF32CQINROD3E2LMCGZUDVMWTXCJFR5SBYVRJ7WAAIAS3P7DCVWZEFY",
        id: "164007621169153",
        paging_token: "164007621169153",
        source_account:
          "GDF32CQINROD3E2LMCGZUDVMWTXCJFR5SBYVRJ7WAAIAS3P7DCVWZEFY",
        to: mockPublicKey,
        transaction_attr: {},
        transaction_hash:
          "686601028de9ddf40a1c24461a6a9c0415d60a39255c35eccad0b52ac1e700a5",
        transaction_successful: true,
        type: "payment",
        type_i: 1,
      } as TestOperationRecord,
      {
        amount: "0.0020000",
        asset_code: "USDC",
        asset_issuer:
          "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        asset_type: "credit_alphanum4",
        created_at: "2025-03-20T22:28:46Z",
        from: "GDF32CQINROD3E2LMCGZUDVMWTXCJFR5SBYVRJ7WAAIAS3P7DCVWZEFY",
        id: "164007621169154",
        paging_token: "164007621169154",
        source_account:
          "GDF32CQINROD3E2LMCGZUDVMWTXCJFR5SBYVRJ7WAAIAS3P7DCVWZEFY",
        to: mockPublicKey,
        transaction_attr: {},
        transaction_hash:
          "686601028de9ddf40a1c24461a6a9c0415d60a39255c35eccad0b52ac1e700a5",
        transaction_successful: true,
        type: "payment",
        type_i: 1,
      } as TestOperationRecord,
      {
        amount: "0.0010000",
        asset: "USDC",
        created_at: "2025-03-19T22:28:46Z",
        id: "164007621169155",
        paging_token: "164007621169155",
        source_account:
          "GDF32CQINROD3E2LMCGZUDVMWTXCJFR5SBYVRJ7WAAIAS3P7DCVWZEFY",
        transaction_attr: {
          operation_count: 100,
          successful: true,
        },
        transaction_hash:
          "686601028de9ddf40a1c24461a6a9c0415d60a39255c35eccad0b52ac1e700a5",
        transaction_successful: true,
        type: "create_claimable_balance",
        type_i: 14,
      } as TestOperationRecord,
      {
        amount: "0.0010000",
        asset: "USDC",
        created_at: "2025-03-18T22:28:46Z",
        id: "164007621169156",
        paging_token: "164007621169156",
        source_account:
          "GDF32CQINROD3E2LMCGZUDVMWTXCJFR5SBYVRJ7WAAIAS3P7DCVWZEFY",
        transaction_attr: {
          operation_count: 100,
          successful: false,
        },
        transaction_hash:
          "686601028de9ddf40a1c24461a6a9c0415d60a39255c35eccad0b52ac1e700a5",
        transaction_successful: false,
        type: "create_claimable_balance",
        type_i: 14,
      } as TestOperationRecord,
    ];

    mockBackendService.getAccountHistory.mockResolvedValue(mockHistoryData);

    const { result } = renderHook(() =>
      useGetHistoryData(mockPublicKey, PUBLIC_NETWORK_DETAILS),
    );

    await result.current.fetchData({ isRefresh: false });

    await waitFor(() => {
      expect(result.current.historyData).not.toBeNull();
    });

    const { historyData } = result.current;
    expect(historyData).not.toBeNull();

    if (historyData) {
      const totalOperations = historyData.history.reduce(
        (total, section) => total + section.operations.length,
        0,
      );

      expect(totalOperations).toBe(2);

      historyData.history.forEach((section) => {
        section.operations.forEach((operation) => {
          expect(operation.type).toBe("payment");
        });
      });
    }
  });
});

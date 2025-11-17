import { Networks } from "@stellar/stellar-sdk";
import {
  NetworkDetails,
  NETWORKS,
  NETWORK_NAMES,
  NETWORK_URLS,
} from "config/constants";
import {
  filterOperationsByToken,
  operationInvolvesToken,
} from "helpers/history";
import {
  getAttrsFromSorobanHorizonOp,
  isContractId,
  SorobanTokenInterface,
} from "helpers/soroban";

// Mock soroban helpers
jest.mock("helpers/soroban", () => ({
  getAttrsFromSorobanHorizonOp: jest.fn(),
  isContractId: jest.fn(),
  SorobanTokenInterface: {
    transfer: "transfer",
    mint: "mint",
  },
}));

const mockGetAttrsFromSorobanHorizonOp =
  getAttrsFromSorobanHorizonOp as jest.MockedFunction<
    typeof getAttrsFromSorobanHorizonOp
  >;
const mockIsContractId = isContractId as jest.MockedFunction<
  typeof isContractId
>;

describe("history helpers - custom token decimal handling", () => {
  const mockNetworkDetails: NetworkDetails = {
    network: NETWORKS.PUBLIC,
    networkPassphrase: Networks.PUBLIC,
    networkUrl: NETWORK_URLS.PUBLIC,
    networkName: NETWORK_NAMES.PUBLIC,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("filterOperationsByToken - custom tokens with decimals", () => {
    it("should handle custom tokens with decimals in Soroban operations", () => {
      const contractId = "C1234567890ABCDEF";
      mockIsContractId.mockImplementation((id) => id === contractId);

      // Mock a Soroban transfer operation with custom token
      // Raw amount: 10000 for token with 4 decimals = 1.0000 tokens
      mockGetAttrsFromSorobanHorizonOp.mockReturnValue({
        fnName: SorobanTokenInterface.transfer,
        contractId,
        from: "GABC",
        to: "GDEF",
        amount: BigInt(10000), // Raw amount for token with 4 decimals = 1.0000
      });

      const operations = [
        {
          type: "invoke_host_function",
        },
      ] as any[];

      const result = filterOperationsByToken(
        operations,
        contractId,
        mockNetworkDetails,
      );

      expect(result).toHaveLength(1);
      // Verify that the operation involves the correct contract
      expect(
        operationInvolvesToken(result[0], { contractId }, mockNetworkDetails),
      ).toBe(true);
    });
  });
});

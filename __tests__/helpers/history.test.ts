import type { Horizon } from "@stellar/stellar-sdk";
import {
  NETWORKS,
  mapNetworkToNetworkDetails,
  NATIVE_TOKEN_CODE,
} from "config/constants";
import type { NetworkDetails } from "config/constants";
import {
  getTokenFromTokenId,
  operationInvolvesToken,
  filterOperationsByToken,
} from "helpers/history";
import {
  SorobanTokenInterface,
  getAttrsFromSorobanHorizonOp,
} from "helpers/soroban";

// Mock the soroban helpers
jest.mock("helpers/soroban", () => {
  const actual =
    jest.requireActual<typeof import("helpers/soroban")>("helpers/soroban");
  return {
    ...actual,
    getAttrsFromSorobanHorizonOp: jest.fn(),
    getNativeContractDetails: jest.fn(() => ({
      contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    })),
  };
});

const mockGetAttrsFromSorobanHorizonOp =
  getAttrsFromSorobanHorizonOp as jest.MockedFunction<
    typeof getAttrsFromSorobanHorizonOp
  >;

describe("history helpers", () => {
  const networkDetails: NetworkDetails = mapNetworkToNetworkDetails(
    NETWORKS.PUBLIC,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getTokenFromTokenId", () => {
    it("should return native token info for 'native'", () => {
      const result = getTokenFromTokenId("native");
      expect(result).toEqual({
        code: "XLM",
        issuer: undefined,
        contractId: undefined,
      });
    });

    it("should return contractId for direct contract ID", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const result = getTokenFromTokenId(contractId);
      expect(result).toEqual({
        code: undefined,
        issuer: undefined,
        contractId,
      });
    });

    it("should extract contractId from SYMBOL:CONTRACTID format", () => {
      const symbol = "USDC";
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const tokenId = `${symbol}:${contractId}`;
      const result = getTokenFromTokenId(tokenId);
      expect(result).toEqual({
        code: undefined,
        issuer: undefined,
        contractId,
      });
    });

    it("should return code and issuer for classic token format", () => {
      const tokenId =
        "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
      const result = getTokenFromTokenId(tokenId);
      expect(result).toEqual({
        code: "USDC",
        issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        contractId: undefined,
      });
    });

    it("should handle classic token when second part is not a contract ID", () => {
      const tokenId =
        "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
      const result = getTokenFromTokenId(tokenId);
      expect(result).toEqual({
        code: "USDC",
        issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        contractId: undefined,
      });
    });
  });

  describe("operationInvolvesToken", () => {
    const mockSorobanOperation = {
      type: "invoke_host_function",
      id: "123",
    } as Horizon.ServerApi.OperationRecord;

    const mockClassicPaymentOperation = {
      type: "payment",
      id: "456",
      asset_type: "native",
    } as Horizon.ServerApi.OperationRecord;

    it("should match Soroban token operation by contractId", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const targetToken = { contractId };

      mockGetAttrsFromSorobanHorizonOp.mockReturnValue({
        contractId,
        fnName: SorobanTokenInterface.transfer,
        from: "G...",
        to: "G...",
        amount: BigInt(1000000),
      });

      const result = operationInvolvesToken(
        mockSorobanOperation,
        targetToken,
        networkDetails,
      );

      expect(result).toBe(true);
      expect(mockGetAttrsFromSorobanHorizonOp).toHaveBeenCalledWith(
        mockSorobanOperation,
        networkDetails,
      );
    });

    it("should not match Soroban operation with different contractId", () => {
      const targetContractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const operationContractId =
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const targetToken = { contractId: targetContractId };

      mockGetAttrsFromSorobanHorizonOp.mockReturnValue({
        contractId: operationContractId,
        fnName: SorobanTokenInterface.transfer,
        from: "G...",
        to: "G...",
        amount: BigInt(1000000),
      });

      const result = operationInvolvesToken(
        mockSorobanOperation,
        targetToken,
        networkDetails,
      );

      expect(result).toBe(false);
    });

    it("should match native XLM classic payment operation", () => {
      const targetToken = { code: NATIVE_TOKEN_CODE };

      const result = operationInvolvesToken(
        mockClassicPaymentOperation,
        targetToken,
        networkDetails,
      );

      expect(result).toBe(true);
    });

    it("should match Soroban token operation when tokenId is in SYMBOL:CONTRACTID format", () => {
      const symbol = "USDC";
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const tokenId = `${symbol}:${contractId}`;
      const targetToken = getTokenFromTokenId(tokenId);

      expect(targetToken.contractId).toBe(contractId);

      mockGetAttrsFromSorobanHorizonOp.mockReturnValue({
        contractId,
        fnName: SorobanTokenInterface.transfer,
        from: "G...",
        to: "G...",
        amount: BigInt(1000000),
      });

      const result = operationInvolvesToken(
        mockSorobanOperation,
        targetToken,
        networkDetails,
      );

      expect(result).toBe(true);
    });
  });

  describe("filterOperationsByToken", () => {
    const contractId =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    const differentContractId =
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    const mockSorobanOperation1 = {
      type: "invoke_host_function",
      id: "1",
    } as Horizon.ServerApi.OperationRecord;

    const mockSorobanOperation2 = {
      type: "invoke_host_function",
      id: "2",
    } as Horizon.ServerApi.OperationRecord;

    const mockClassicPaymentOperation = {
      type: "payment",
      id: "3",
      asset_type: "native",
    } as Horizon.ServerApi.OperationRecord;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should filter Soroban token operations by contractId", () => {
      mockGetAttrsFromSorobanHorizonOp.mockImplementation((op) => {
        if (op.id === "1") {
          return {
            contractId,
            fnName: SorobanTokenInterface.transfer,
            from: "G...",
            to: "G...",
            amount: BigInt(1000000),
          };
        }
        if (op.id === "2") {
          return {
            contractId: differentContractId,
            fnName: SorobanTokenInterface.transfer,
            from: "G...",
            to: "G...",
            amount: BigInt(2000000),
          };
        }
        return null;
      });

      const operations = [mockSorobanOperation1, mockSorobanOperation2];

      const filtered = filterOperationsByToken(
        operations,
        contractId,
        networkDetails,
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(mockSorobanOperation1);
    });

    it("should filter Soroban token operations when tokenId is SYMBOL:CONTRACTID format", () => {
      const symbol = "USDC";
      const tokenId = `${symbol}:${contractId}`;

      mockGetAttrsFromSorobanHorizonOp.mockImplementation((op) => {
        if (op.id === "1") {
          return {
            contractId,
            fnName: SorobanTokenInterface.transfer,
            from: "G...",
            to: "G...",
            amount: BigInt(1000000),
          };
        }
        if (op.id === "2") {
          return {
            contractId: differentContractId,
            fnName: SorobanTokenInterface.transfer,
            from: "G...",
            to: "G...",
            amount: BigInt(2000000),
          };
        }
        return null;
      });

      const operations = [mockSorobanOperation1, mockSorobanOperation2];

      const filtered = filterOperationsByToken(
        operations,
        tokenId,
        networkDetails,
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(mockSorobanOperation1);
    });

    it("should return empty array when no operations match", () => {
      mockGetAttrsFromSorobanHorizonOp.mockReturnValue({
        contractId: differentContractId,
        fnName: SorobanTokenInterface.transfer,
        from: "G...",
        to: "G...",
        amount: BigInt(1000000),
      });

      const operations = [mockSorobanOperation1];

      const filtered = filterOperationsByToken(
        operations,
        contractId,
        networkDetails,
      );

      expect(filtered).toHaveLength(0);
    });

    it("should filter native XLM operations", () => {
      const operations = [mockClassicPaymentOperation, mockSorobanOperation1];

      const filtered = filterOperationsByToken(
        operations,
        "native",
        networkDetails,
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(mockClassicPaymentOperation);
    });

    it("should handle mixed operations correctly", () => {
      const symbol = "USDC";
      const tokenId = `${symbol}:${contractId}`;

      mockGetAttrsFromSorobanHorizonOp.mockImplementation((op) => {
        if (op.id === "1") {
          return {
            contractId,
            fnName: SorobanTokenInterface.transfer,
            from: "G...",
            to: "G...",
            amount: BigInt(1000000),
          };
        }
        if (op.id === "2") {
          return {
            contractId: differentContractId,
            fnName: SorobanTokenInterface.transfer,
            from: "G...",
            to: "G...",
            amount: BigInt(2000000),
          };
        }
        return null;
      });

      const operations = [
        mockSorobanOperation1,
        mockSorobanOperation2,
        mockClassicPaymentOperation,
      ];

      const filtered = filterOperationsByToken(
        operations,
        tokenId,
        networkDetails,
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(mockSorobanOperation1);
    });
  });
});

import { xdr } from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import {
  ClassicBalance,
  NativeBalance,
  SorobanBalance,
  TokenTypeWithCustomToken,
} from "config/types";
import {
  getArgsForTokenInvocation,
  SorobanTokenInterface,
  addressToString,
  isSorobanTransaction,
} from "helpers/soroban";

// Mock isContractId before importing the module
const mockIsContractId = jest.fn();
jest.mock("helpers/soroban", () => {
  const actual = jest.requireActual("helpers/soroban");
  return {
    ...actual,
    isContractId: (address: string) => mockIsContractId(address),
  };
});

describe("soroban helpers", () => {
  describe("getArgsForTokenInvocation", () => {
    describe("interface detection for transfer function", () => {
      it("should detect SEP-41 token transfer (amount as i128)", () => {
        // Mock ScVal for addresses
        const mockFromAddress = xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(Buffer.alloc(32, 1)),
          ),
        );
        const mockToAddress = xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(Buffer.alloc(32, 2)),
          ),
        );

        // Mock i128 amount for token transfer
        const mockAmount = xdr.ScVal.scvI128(
          new xdr.Int128Parts({
            lo: xdr.Uint64.fromString("1000000"),
            hi: xdr.Int64.fromString("0"),
          }),
        );

        const args = [mockFromAddress, mockToAddress, mockAmount];

        const result = getArgsForTokenInvocation(
          SorobanTokenInterface.transfer,
          args,
        );

        expect(result).toHaveProperty("from");
        expect(result).toHaveProperty("to");
        expect(result).toHaveProperty("amount");
        expect(result.amount).toBeDefined();
        expect(result.tokenId).toBeUndefined();
      });

      it("should detect SEP-50 collectible transfer (tokenId as u32)", () => {
        // Mock ScVal for addresses
        const mockFromAddress = xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(Buffer.alloc(32, 1)),
          ),
        );
        const mockToAddress = xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(Buffer.alloc(32, 2)),
          ),
        );

        // Mock u32 tokenId for collectible transfer
        const mockTokenId = xdr.ScVal.scvU32(12345);

        const args = [mockFromAddress, mockToAddress, mockTokenId];

        const result = getArgsForTokenInvocation(
          SorobanTokenInterface.transfer,
          args,
        );

        expect(result).toHaveProperty("from");
        expect(result).toHaveProperty("to");
        expect(result).toHaveProperty("tokenId");
        expect(result.tokenId).toBe(12345);
        expect(result.amount).toBeUndefined();
      });

      it("should correctly parse from and to addresses for token transfer", () => {
        const mockFromAddress = xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(Buffer.alloc(32, 1)),
          ),
        );
        const mockToAddress = xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(Buffer.alloc(32, 2)),
          ),
        );
        const mockAmount = xdr.ScVal.scvI128(
          new xdr.Int128Parts({
            lo: xdr.Uint64.fromString("1000000"),
            hi: xdr.Int64.fromString("0"),
          }),
        );

        const args = [mockFromAddress, mockToAddress, mockAmount];

        const result = getArgsForTokenInvocation(
          SorobanTokenInterface.transfer,
          args,
        );

        expect(result.from).toBeTruthy();
        expect(result.to).toBeTruthy();
        expect(typeof result.from).toBe("string");
        expect(typeof result.to).toBe("string");
      });

      it("should correctly parse from and to addresses for collectible transfer", () => {
        const mockFromAddress = xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(Buffer.alloc(32, 1)),
          ),
        );
        const mockToAddress = xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(Buffer.alloc(32, 2)),
          ),
        );
        const mockTokenId = xdr.ScVal.scvU32(99999);

        const args = [mockFromAddress, mockToAddress, mockTokenId];

        const result = getArgsForTokenInvocation(
          SorobanTokenInterface.transfer,
          args,
        );

        expect(result.from).toBeTruthy();
        expect(result.to).toBeTruthy();
        expect(typeof result.from).toBe("string");
        expect(typeof result.to).toBe("string");
        expect(result.tokenId).toBe(99999);
      });
    });

    describe("mint function", () => {
      it("should parse mint function arguments correctly", () => {
        const mockToAddress = xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(Buffer.alloc(32, 1)),
          ),
        );
        const mockAmount = xdr.ScVal.scvI128(
          new xdr.Int128Parts({
            lo: xdr.Uint64.fromString("5000000"),
            hi: xdr.Int64.fromString("0"),
          }),
        );
        // Add a dummy third argument to satisfy the implementation
        const mockDummy = xdr.ScVal.scvVoid();

        const args = [mockToAddress, mockAmount, mockDummy];

        const result = getArgsForTokenInvocation(
          SorobanTokenInterface.mint,
          args,
        );

        expect(result).toHaveProperty("to");
        expect(result).toHaveProperty("amount");
        expect(result.to).toBeTruthy();
        expect(result.amount).toBeDefined();
        expect(result.from).toBe("");
      });
    });

    describe("unknown function", () => {
      it("should return default values for unknown function", () => {
        const mockAddress = xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(Buffer.alloc(32, 1)),
          ),
        );
        // Add dummy arguments to satisfy the implementation
        const mockDummy1 = xdr.ScVal.scvVoid();
        const mockDummy2 = xdr.ScVal.scvVoid();

        const args = [mockAddress, mockDummy1, mockDummy2];

        const result = getArgsForTokenInvocation("unknown_function", args);

        expect(result).toHaveProperty("from");
        expect(result).toHaveProperty("to");
        expect(result).toHaveProperty("amount");
        expect(result.from).toBe("");
        expect(result.to).toBe("");
        expect(result.amount).toBe(BigInt(0));
      });
    });
  });

  describe("addressToString", () => {
    it("should convert account address to string", () => {
      const mockAddress = xdr.ScAddress.scAddressTypeAccount(
        xdr.PublicKey.publicKeyTypeEd25519(Buffer.alloc(32, 1)),
      );

      const result = addressToString(mockAddress);

      expect(typeof result).toBe("string");
      expect(result).toBeTruthy();
      // Should start with 'G' for public key addresses
      expect(result[0]).toBe("G");
    });

    it("should convert contract address to string", () => {
      // Buffer extends Uint8Array, which is compatible with the Hash type expected by stellar-sdk
      const mockAddress = xdr.ScAddress.scAddressTypeContract(
        Buffer.alloc(32, 1) as any,
      );

      const result = addressToString(mockAddress);

      expect(typeof result).toBe("string");
      expect(result).toBeTruthy();
      // Should start with 'C' for contract addresses
      expect(result[0]).toBe("C");
    });
  });

  describe("isSorobanTransaction", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Default mock: return false (not a contract ID)
      mockIsContractId.mockReturnValue(false);
    });

    // Mock balance types
    const createMockSorobanBalance = (contractId: string): SorobanBalance => ({
      token: {
        code: "TEST",
        issuer: { key: contractId },
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      },
      total: new BigNumber("100"),
      available: new BigNumber("100"),
      contractId,
      name: "Test Token",
      symbol: "TEST",
      decimals: 7,
    });

    const createMockClassicBalance = (): ClassicBalance => ({
      token: {
        code: "USDC",
        issuer: {
          key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      },
      total: new BigNumber("200"),
      available: new BigNumber("200"),
      limit: new BigNumber("1000"),
      buyingLiabilities: "0",
      sellingLiabilities: "0",
    });

    const createMockNativeBalance = (): NativeBalance => ({
      token: {
        code: "XLM",
        type: TokenTypeWithCustomToken.NATIVE,
      },
      total: new BigNumber("100.5"),
      available: new BigNumber("100.5"),
      minimumBalance: new BigNumber("1"),
      buyingLiabilities: "0",
      sellingLiabilities: "0",
    });

    describe("when selectedBalance has contractId", () => {
      it("should return true for SorobanBalance with valid contractId", () => {
        const contractId =
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
        const sorobanBalance = createMockSorobanBalance(contractId);

        const result = isSorobanTransaction(sorobanBalance, undefined);

        expect(result).toBe(true);
      });

      it("should return true even if recipientAddress is not a contract", () => {
        const contractId =
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
        const sorobanBalance = createMockSorobanBalance(contractId);
        const recipientAddress =
          "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF";

        const result = isSorobanTransaction(sorobanBalance, recipientAddress);

        expect(result).toBe(true);
        // Since selectedBalance has contractId, recipientAddress check is short-circuited
        expect(mockIsContractId).not.toHaveBeenCalled();
      });
    });

    describe("when selectedBalance does not have contractId", () => {
      it("should return false for ClassicBalance", () => {
        const classicBalance = createMockClassicBalance();

        const result = isSorobanTransaction(classicBalance, undefined);

        expect(result).toBe(false);
      });

      it("should return false for NativeBalance", () => {
        const nativeBalance = createMockNativeBalance();

        const result = isSorobanTransaction(nativeBalance, undefined);

        expect(result).toBe(false);
      });

      it("should return false when selectedBalance is undefined", () => {
        const result = isSorobanTransaction(undefined, undefined);

        expect(result).toBe(false);
      });
    });

    describe("when recipientAddress is a contract ID", () => {
      it("should return true when recipientAddress is a contract ID", () => {
        const contractAddress =
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

        mockIsContractId.mockReturnValue(true);

        const result = isSorobanTransaction(undefined, contractAddress);

        expect(result).toBe(true);
      });

      it("should return true even if selectedBalance is ClassicBalance", () => {
        const classicBalance = createMockClassicBalance();
        const contractAddress =
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

        mockIsContractId.mockReturnValue(true);

        const result = isSorobanTransaction(classicBalance, contractAddress);

        expect(result).toBe(true);
      });

      it("should return true even if selectedBalance is NativeBalance", () => {
        const nativeBalance = createMockNativeBalance();
        const contractAddress =
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

        mockIsContractId.mockReturnValue(true);

        const result = isSorobanTransaction(nativeBalance, contractAddress);

        expect(result).toBe(true);
      });
    });

    describe("when recipientAddress is not a contract ID", () => {
      it("should return false when recipientAddress is a regular G address", () => {
        const recipientAddress =
          "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF";

        mockIsContractId.mockReturnValue(false);

        const result = isSorobanTransaction(undefined, recipientAddress);

        expect(result).toBe(false);
      });

      it("should return false when recipientAddress is undefined", () => {
        mockIsContractId.mockReturnValue(false);

        const result = isSorobanTransaction(undefined, undefined);

        expect(result).toBe(false);
        expect(mockIsContractId).not.toHaveBeenCalled();
      });

      it("should return false when recipientAddress is empty string", () => {
        const result = isSorobanTransaction(undefined, "");

        expect(result).toBe(false);
        // Empty string is falsy, so isContractId won't be called due to short-circuit evaluation
        expect(mockIsContractId).not.toHaveBeenCalled();
      });
    });

    describe("edge cases", () => {
      it("should return true when both conditions are true", () => {
        const contractId =
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
        const sorobanBalance = createMockSorobanBalance(contractId);
        const recipientAddress =
          "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

        mockIsContractId.mockReturnValue(true);

        const result = isSorobanTransaction(sorobanBalance, recipientAddress);

        expect(result).toBe(true);
      });

      it("should return false when both conditions are false", () => {
        const classicBalance = createMockClassicBalance();
        const recipientAddress =
          "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF";

        mockIsContractId.mockReturnValue(false);

        const result = isSorobanTransaction(classicBalance, recipientAddress);

        expect(result).toBe(false);
      });

      it("should handle SorobanBalance with empty string contractId", () => {
        const sorobanBalance = createMockSorobanBalance("");

        const result = isSorobanTransaction(sorobanBalance, undefined);

        expect(result).toBe(false);
      });

      it("should handle object with contractId property but falsy value", () => {
        const balanceWithFalsyContractId = {
          ...createMockSorobanBalance(""),
          contractId: "",
        } as SorobanBalance;

        const result = isSorobanTransaction(
          balanceWithFalsyContractId,
          undefined,
        );

        expect(result).toBe(false);
      });
    });
  });
});

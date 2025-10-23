import { xdr } from "@stellar/stellar-sdk";
import {
  getArgsForTokenInvocation,
  SorobanTokenInterface,
  addressToString,
} from "helpers/soroban";

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
});

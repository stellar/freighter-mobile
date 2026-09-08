import { Address, Asset as SdkToken, Keypair, xdr } from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import { NETWORKS, TESTNET_NETWORK_DETAILS } from "config/constants";
import {
  Balance,
  ClassicBalance,
  NativeBalance,
  SorobanBalance,
  TokenTypeWithCustomToken,
} from "config/types";
import {
  computeTotalFeeXlm,
  getArgsForTokenInvocation,
  getAuthEntryBoundAddress,
  getBalanceByKey,
  getInvocationArgs,
  getInvocationDetails,
  getNativeContractDetails,
  INVOCATION_TYPE_EXTERNAL_REF,
  INVOCATION_TYPE_UNRECOGNIZED,
  INVOCATION_TYPE_WASM,
  scValByType,
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

// A well-formed contract strkey used as an executable owner / address fixture.
const OWNER_CONTRACT =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

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
            lo: BigInt("1000000"),
            hi: BigInt(0),
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
            lo: BigInt("1000000"),
            hi: BigInt(0),
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
            lo: BigInt("5000000"),
            hi: BigInt(0),
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
      // v17: ScAddress contract ids are xdr.ContractId wrappers, not raw bytes.
      const mockAddress = xdr.ScAddress.scAddressTypeContract(
        new xdr.ContractId(Buffer.alloc(32, 1)),
      );

      const result = addressToString(mockAddress);

      expect(typeof result).toBe("string");
      expect(result).toBeTruthy();
      // Should start with 'C' for contract addresses
      expect(result[0]).toBe("C");
    });
  });

  describe("getAuthEntryBoundAddress", () => {
    const BOUND_ADDRESS =
      "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3";

    const rootInvocation = () =>
      new xdr.SorobanAuthorizedInvocation({
        function:
          xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: new Address(
                "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
              ).toScAddress(),
              functionName: "transfer",
              args: [],
            }),
          ),
        subInvocations: [],
      });

    const addressCreds = () =>
      new xdr.SorobanAddressCredentials({
        address: new Address(BOUND_ADDRESS).toScAddress(),
        nonce: BigInt("1"),
        signatureExpirationLedger: 999999,
        signature: xdr.ScVal.scvVoid(),
      });

    const buildEntry = (credentials: xdr.SorobanCredentials) =>
      new xdr.SorobanAuthorizationEntry({
        credentials,
        rootInvocation: rootInvocation(),
      });

    it("returns undefined for source-account credentials", () => {
      const entry = buildEntry(
        xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      );
      expect(getAuthEntryBoundAddress(entry)).toBeUndefined();
    });

    it("returns the bound address for ADDRESS credentials", () => {
      const entry = buildEntry(
        xdr.SorobanCredentials.sorobanCredentialsAddress(addressCreds()),
      );
      expect(getAuthEntryBoundAddress(entry)).toBe(BOUND_ADDRESS);
    });

    it("returns the bound address for ADDRESS_V2 credentials", () => {
      const entry = buildEntry(
        xdr.SorobanCredentials.sorobanCredentialsAddressV2(addressCreds()),
      );
      expect(getAuthEntryBoundAddress(entry)).toBe(BOUND_ADDRESS);
    });

    it("returns the top-level bound address for ADDRESS_WITH_DELEGATES credentials", () => {
      const entry = buildEntry(
        xdr.SorobanCredentials.sorobanCredentialsAddressWithDelegates(
          new xdr.SorobanAddressCredentialsWithDelegates({
            addressCredentials: addressCreds(),
            delegates: [],
          }),
        ),
      );
      expect(getAuthEntryBoundAddress(entry)).toBe(BOUND_ADDRESS);
    });
  });

  describe("getInvocationDetails", () => {
    const deployer = Keypair.random().publicKey();

    const buildCreateInvocation = (
      executable: xdr.ContractExecutable,
      constructorArgs?: xdr.ScVal[],
    ) => {
      const preimage = xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: new Address(deployer).toScAddress(),
          salt: new xdr.Uint256Bytes(Buffer.alloc(32, 7)),
        }),
      );
      const fn = constructorArgs
        ? xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractV2HostFn(
            new xdr.CreateContractArgsV2({
              contractIdPreimage: preimage,
              executable,
              constructorArgs,
            }),
          )
        : xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractHostFn(
            new xdr.CreateContractArgs({
              contractIdPreimage: preimage,
              executable,
            }),
          );
      return new xdr.SorobanAuthorizedInvocation({
        function: fn,
        subInvocations: [],
      });
    };

    it("describes a wasm contract creation", () => {
      const invocation = buildCreateInvocation(
        xdr.ContractExecutable.contractExecutableWasm(
          new xdr.Hash(Buffer.alloc(32, 9)),
        ),
      );

      const [details] = getInvocationDetails(invocation);

      expect(details.type).toBe(INVOCATION_TYPE_WASM);
      if (details.type !== INVOCATION_TYPE_WASM) throw new Error("unreachable");
      expect(details.hash).toBe("09".repeat(32));
      expect(details.salt).toBe("07".repeat(32));
      expect(details.address).toBe(deployer);
    });

    it("describes a CAP-85 external-executable contract creation (Protocol 28)", () => {
      const invocation = buildCreateInvocation(
        xdr.ContractExecutable.contractExecutableExternalRef(
          new xdr.ContractExecutableExternalRef({
            executableOwner: new Address(OWNER_CONTRACT).toScAddress(),
            tag: "token-v2",
          }),
        ),
        [xdr.ScVal.scvU32(1)],
      );

      // Round-trip through XDR so the assertion covers the decode path a dapp
      // request actually takes.
      const decoded = xdr.SorobanAuthorizedInvocation.fromXdr(
        invocation.toXdr("base64"),
        "base64",
      );
      const [details] = getInvocationDetails(decoded);

      expect(details.type).toBe(INVOCATION_TYPE_EXTERNAL_REF);
      if (details.type !== INVOCATION_TYPE_EXTERNAL_REF) {
        throw new Error("unreachable");
      }
      expect(details.owner).toBe(OWNER_CONTRACT);
      expect(details.tag).toBe("token-v2");
      expect(details.salt).toBe("07".repeat(32));
      expect(details.address).toBe(deployer);
      expect(details.args).toHaveLength(1);
    });

    it("renders a non-UTF-8 external-executable tag in its reversible SEP-51 form", () => {
      // Two distinct binary tags must not collapse to the same replacement
      // characters: the tag decides which executable runs.
      const invocation = buildCreateInvocation(
        xdr.ContractExecutable.contractExecutableExternalRef(
          new xdr.ContractExecutableExternalRef({
            executableOwner: new Address(OWNER_CONTRACT).toScAddress(),
            tag: new Uint8Array([0xff, 0xfe]),
          }),
        ),
      );

      const [details] = getInvocationDetails(invocation);

      expect(details.type).toBe(INVOCATION_TYPE_EXTERNAL_REF);
      if (details.type !== INVOCATION_TYPE_EXTERNAL_REF) {
        throw new Error("unreachable");
      }
      expect(details.tag).toBe("\\xff\\xfe");
    });

    it("rejects an external-executable creation whose preimage is not the address arm", () => {
      // Like the SDK's own invocation decoder: an external reference deploys
      // from an address, so this pairing is invalid and must surface as
      // unrecognized rather than as a normal contract creation.
      const invocation = new xdr.SorobanAuthorizedInvocation({
        function:
          xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractHostFn(
            new xdr.CreateContractArgs({
              contractIdPreimage:
                xdr.ContractIdPreimage.contractIdPreimageFromAsset(
                  xdr.Asset.assetTypeNative(),
                ),
              executable: xdr.ContractExecutable.contractExecutableExternalRef(
                new xdr.ContractExecutableExternalRef({
                  executableOwner: new Address(OWNER_CONTRACT).toScAddress(),
                  tag: "v2",
                }),
              ),
            }),
          ),
        subInvocations: [],
      });

      expect(() => getInvocationArgs(invocation)).toThrow(
        /external executable reference.*contractIdPreimageFromAsset/,
      );
      expect(getInvocationDetails(invocation)).toEqual([
        { type: INVOCATION_TYPE_UNRECOGNIZED },
      ]);
    });

    it("explains which executable/preimage pairing was invalid when it throws", () => {
      const assetPreimage = xdr.ContractIdPreimage.contractIdPreimageFromAsset(
        xdr.Asset.assetTypeNative(),
      );
      const addressPreimage =
        xdr.ContractIdPreimage.contractIdPreimageFromAddress(
          new xdr.ContractIdPreimageFromAddress({
            address: new Address(deployer).toScAddress(),
            salt: new xdr.Uint256Bytes(Buffer.alloc(32)),
          }),
        );
      const build = (
        executable: xdr.ContractExecutable,
        contractIdPreimage: xdr.ContractIdPreimage,
      ) =>
        new xdr.SorobanAuthorizedInvocation({
          function:
            xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractHostFn(
              new xdr.CreateContractArgs({ contractIdPreimage, executable }),
            ),
          subInvocations: [],
        });

      // wasm code must be deployed from an address, never derived from an asset
      expect(() =>
        getInvocationArgs(
          build(
            xdr.ContractExecutable.contractExecutableWasm(
              new xdr.Hash(Buffer.alloc(32)),
            ),
            assetPreimage,
          ),
        ),
      ).toThrow(/wasm executable.*contractIdPreimageFromAsset/);

      // and a SAC is only ever derived from an asset
      expect(() =>
        getInvocationArgs(
          build(
            xdr.ContractExecutable.contractExecutableStellarAsset(),
            addressPreimage,
          ),
        ),
      ).toThrow(/Stellar asset executable.*contractIdPreimageFromAddress/);
    });

    it("marks an invocation it cannot parse as unrecognized instead of throwing", () => {
      // A wasm executable paired with an asset preimage is decodable XDR but a
      // nonsensical combination -- the kind of thing a future protocol arm or a
      // hostile dApp could produce. It must not crash the review UI.
      const invocation = new xdr.SorobanAuthorizedInvocation({
        function:
          xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractHostFn(
            new xdr.CreateContractArgs({
              contractIdPreimage:
                xdr.ContractIdPreimage.contractIdPreimageFromAsset(
                  xdr.Asset.assetTypeNative(),
                ),
              executable: xdr.ContractExecutable.contractExecutableWasm(
                new xdr.Hash(Buffer.alloc(32)),
              ),
            }),
          ),
        subInvocations: [],
      });

      expect(getInvocationDetails(invocation)).toEqual([
        { type: INVOCATION_TYPE_UNRECOGNIZED },
      ]);
    });
  });

  describe("scValByType", () => {
    it("decodes a CAP-85 executable tag like a string", () => {
      expect(scValByType(xdr.ScVal.scvExecutableTag("token-v2"))).toBe(
        "token-v2",
      );
    });

    it("keeps a non-UTF-8 executable tag distinguishable via its SEP-51 form", () => {
      expect(
        scValByType(xdr.ScVal.scvExecutableTag(new Uint8Array([0xff, 0xfe]))),
      ).toBe("\\xff\\xfe");
    });

    it("hex-encodes string payloads that are not valid UTF-8", () => {
      expect(
        scValByType(xdr.ScVal.scvString(new Uint8Array([0xff, 0xfe]))),
      ).toBe("fffe");
    });

    it("hex-encodes bytes", () => {
      expect(scValByType(xdr.ScVal.scvBytes(new Uint8Array([1, 2, 255])))).toBe(
        "0102ff",
      );
    });

    it("returns a strkey for account and contract addresses", () => {
      const account = Keypair.random().publicKey();
      expect(
        scValByType(xdr.ScVal.scvAddress(new Address(account).toScAddress())),
      ).toBe(account);
      expect(
        scValByType(
          xdr.ScVal.scvAddress(new Address(OWNER_CONTRACT).toScAddress()),
        ),
      ).toBe(OWNER_CONTRACT);
    });

    it("stringifies integers", () => {
      expect(scValByType(xdr.ScVal.scvU32(7))).toBe("7");
      expect(scValByType(xdr.ScVal.scvI64(BigInt("-5")))).toBe("-5");
    });
  });

  describe("computeTotalFeeXlm", () => {
    const CLASSIC_FEE = "0.00001";

    it("returns the sum of inclusion and resource fees for Soroban", () => {
      expect(computeTotalFeeXlm("0.00001", "0.00123", CLASSIC_FEE)).toBe(
        "0.00124",
      );
    });

    it("returns transactionFee when inclusionFee is null", () => {
      expect(computeTotalFeeXlm(null, "0.00123", CLASSIC_FEE)).toBe(
        CLASSIC_FEE,
      );
    });

    it("returns transactionFee when resourceFee is null", () => {
      expect(computeTotalFeeXlm("0.00001", null, CLASSIC_FEE)).toBe(
        CLASSIC_FEE,
      );
    });

    it("returns transactionFee when both fees are null", () => {
      expect(computeTotalFeeXlm(null, null, CLASSIC_FEE)).toBe(CLASSIC_FEE);
    });

    it("preserves BigNumber precision for very small Soroban fees", () => {
      expect(computeTotalFeeXlm("0.0000100", "0.0000001", CLASSIC_FEE)).toBe(
        "0.0000101",
      );
    });

    it("returns transactionFee when either fee is an empty string (falsy)", () => {
      expect(computeTotalFeeXlm("", "0.00123", CLASSIC_FEE)).toBe(CLASSIC_FEE);
      expect(computeTotalFeeXlm("0.00001", "", CLASSIC_FEE)).toBe(CLASSIC_FEE);
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

  describe("getNativeContractDetails", () => {
    it("derives a contract id for every network, including unlisted ones", () => {
      expect(getNativeContractDetails(NETWORKS.PUBLIC).contract).toBe(
        "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
      );
      expect(getNativeContractDetails(NETWORKS.TESTNET).contract).toBe(
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      );
      expect(getNativeContractDetails(NETWORKS.FUTURENET).contract).toMatch(
        /^C[A-Z2-7]{55}$/,
      );
    });
  });

  describe("getBalanceByKey", () => {
    const networkDetails = TESTNET_NETWORK_DETAILS; // from config/constants
    const NATIVE_SAC =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    const CLASSIC_XLM_ISSUER =
      "GBEO62ZYAOEKVL4WMF5Q6VYTOJQUT7H2QYRDVFO5LT4W7VQPFDWVKUHO";
    const classicXlmSac = new SdkToken("XLM", CLASSIC_XLM_ISSUER).contractId(
      networkDetails.networkPassphrase,
    );

    const nativeBalance = {
      token: { type: "native", code: "XLM" },
      total: new BigNumber("10"),
    } as unknown as Balance;

    const nonNativeXlmBalance = {
      token: { code: "XLM", issuer: { key: CLASSIC_XLM_ISSUER } },
      total: new BigNumber("10"),
    } as unknown as Balance;

    it("resolves the native SAC to the native balance even when an XLM-coded classic balance sorts first", () => {
      const found = getBalanceByKey(
        NATIVE_SAC,
        [nonNativeXlmBalance, nativeBalance],
        networkDetails,
      );
      expect(found).toBe(nativeBalance);
    });

    it("resolves an XLM-coded classic balance by its own SAC", () => {
      const found = getBalanceByKey(
        classicXlmSac,
        [nonNativeXlmBalance, nativeBalance],
        networkDetails,
      );
      expect(found).toBe(nonNativeXlmBalance);
    });
  });
});

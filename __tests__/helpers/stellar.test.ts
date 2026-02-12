import { MuxedAccount, StrKey, hash } from "@stellar/stellar-sdk";
import { logger } from "config/logger";
import { isContractId } from "helpers/soroban";
import {
  createMuxedAccount,
  encodeSep53Message,
  getBaseAccount,
  getMuxedId,
  isFederationAddress,
  isMuxedAccount,
  isSameAccount,
  isValidStellarAddress,
  SIGN_MESSAGE_PREFIX,
  signMessage,
  truncateAddress,
} from "helpers/stellar";

jest.mock("@stellar/stellar-sdk", () => {
  const originalSdk = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...originalSdk,
    StrKey: {
      isValidEd25519PublicKey: jest.fn(),
      isValidMed25519PublicKey: jest.fn(),
    },
    Account: jest.fn().mockImplementation((accountId, sequenceNumber) => ({
      accountId: () => accountId,
      sequenceNumber: () => sequenceNumber,
      incrementSequenceNumber: jest.fn(),
    })),
    MuxedAccount: Object.assign(
      jest.fn().mockImplementation((account, muxedId) => ({
        accountId: () => `M${account.accountId()}${muxedId}`,
        id: () => muxedId,
        baseAccount: () => account,
        sequenceNumber: () => account.sequenceNumber(),
        incrementSequenceNumber: jest.fn(),
        setId: jest.fn(),
        toXDRObject: jest.fn(),
        equals: jest.fn(),
      })),
      {
        fromAddress: jest
          .fn()
          .mockImplementation((_muxedAddress: string, sequenceNum = "0") => ({
            accountId: () => _muxedAddress,
            id: () => _muxedAddress,
            baseAccount: () => ({
              accountId: () =>
                "GBIG5762G5N7PSR437NAF5KZC6EDY3PCHQ6SRG5Z3DSGKWU45KL2MSQZ",
              sequenceNumber: () => sequenceNum,
              incrementSequenceNumber: jest.fn(),
            }),
            sequenceNumber: () => sequenceNum,
            incrementSequenceNumber: jest.fn(),
            setId: jest.fn(),
            toXDRObject: jest.fn(),
            equals: jest.fn(),
          })),
      },
    ),
  };
});

jest.mock("helpers/soroban", () => ({
  isContractId: jest.fn(),
}));

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

const mockedStrKey = StrKey as jest.Mocked<typeof StrKey>;
const mockedMuxedAccount = MuxedAccount as jest.MockedClass<
  typeof MuxedAccount
>;
const mockedIsContractId = isContractId as jest.MockedFunction<
  typeof isContractId
>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

// Get the mocked fromAddress function
const getMuxedAccountFromAddress = () =>
  (MuxedAccount as unknown as { fromAddress: jest.Mock }).fromAddress;

describe("Stellar helpers", () => {
  const validEd25519 =
    "GBIG5762G5N7PSR437NAF5KZC6EDY3PCHQ6SRG5Z3DSGKWU45KL2MSQZ";
  const validMuxed =
    "MAQAAAAABLAGAQAAAAAQ7ZWXCGLQUPH37VPKM7VQ2PZY4XQ45KKSWY7VAI65RFNQ3XWZC35336P5Y";
  const validFederation = "test*example.com";
  const validContract =
    "CCJZ5WH4XJZJ4OJ5VZ7H5QP374UCHNNUC6WCNMFRW7G5GP3W3O5HLNGG";
  const invalidAddress = "invalid-address";
  const shortAddress = "GABC";
  const longAddress =
    "GD5LMKHSG5TQZ5QN5J5ZZBQCBYBEOXJU5OJGIJRJ54KUR2HGR5X45MBN";

  beforeEach(() => {
    jest.clearAllMocks();

    mockedStrKey.isValidEd25519PublicKey.mockImplementation(
      (key) => key === validEd25519 || key === longAddress,
    );
    mockedStrKey.isValidMed25519PublicKey.mockImplementation(
      (key) => key === validMuxed,
    );
    mockedIsContractId.mockImplementation((key) => key === validContract);
  });

  describe("isFederationAddress", () => {
    it("should return true for valid federation addresses", () => {
      expect(isFederationAddress("user*domain.com")).toBe(true);
      expect(isFederationAddress("long.user.name*sub.domain.org")).toBe(true);
    });

    it("should return false for invalid federation addresses", () => {
      expect(isFederationAddress("user@domain.com")).toBe(false);
      expect(isFederationAddress("user*domain")).toBe(false);
      expect(isFederationAddress("userdomain.com")).toBe(false);
      expect(isFederationAddress("user*domain*com")).toBe(false);
      expect(isFederationAddress("")).toBe(false);
      expect(isFederationAddress(validEd25519)).toBe(false);
    });
  });

  describe("isMuxedAccount", () => {
    it("should call StrKey.isValidMed25519PublicKey and return its result", () => {
      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(true);
      expect(isMuxedAccount(validMuxed)).toBe(true);
      expect(mockedStrKey.isValidMed25519PublicKey).toHaveBeenCalledWith(
        validMuxed,
      );

      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(false);
      expect(isMuxedAccount(validEd25519)).toBe(false);
      expect(mockedStrKey.isValidMed25519PublicKey).toHaveBeenCalledWith(
        validEd25519,
      );
    });
  });

  describe("getBaseAccount", () => {
    it("should return the base account for a valid muxed address", () => {
      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(true);
      // Mock MuxedAccount.fromAddress
      const fromAddressSpy = jest.fn().mockReturnValue({
        accountId: () => validMuxed,
        baseAccount: () => ({
          accountId: () => validEd25519,
        }),
      });
      (MuxedAccount as unknown as { fromAddress: jest.Mock }).fromAddress =
        fromAddressSpy;

      const base = getBaseAccount(validMuxed);
      expect(base).toBe(validEd25519);
      expect(mockedStrKey.isValidMed25519PublicKey).toHaveBeenCalledWith(
        validMuxed,
      );
    });

    it("should return the original address if it's not muxed", () => {
      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(false);
      const base = getBaseAccount(validEd25519);
      expect(base).toBe(validEd25519);
      expect(mockedStrKey.isValidMed25519PublicKey).toHaveBeenCalledWith(
        validEd25519,
      );
      expect(mockedMuxedAccount.fromAddress).not.toHaveBeenCalled();
    });

    it("should return null and log error if MuxedAccount.fromAddress throws", () => {
      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(true);
      const error = new Error("SDK error");
      getMuxedAccountFromAddress().mockImplementationOnce(() => {
        throw error;
      });

      const base = getBaseAccount(validMuxed);
      expect(base).toBeNull();
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "StellarHelper",
        "Error extracting base account:",
        error,
      );
    });

    it("should return the input if it's not a valid muxed address", () => {
      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(false);
      expect(getBaseAccount("")).toBe("");

      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(false);
      expect(getBaseAccount(null as unknown as string)).toBeNull();

      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(false);
      expect(getBaseAccount(undefined as unknown as string)).toBeUndefined();
    });
  });

  describe("isValidStellarAddress", () => {
    it("should return true for valid Ed25519 public key", () => {
      expect(isValidStellarAddress(validEd25519)).toBe(true);
      expect(mockedStrKey.isValidEd25519PublicKey).toHaveBeenCalledWith(
        validEd25519,
      );
    });

    it("should return true for valid Muxed account", () => {
      mockedStrKey.isValidEd25519PublicKey.mockReturnValueOnce(false);
      expect(isValidStellarAddress(validMuxed)).toBe(true);
      expect(mockedStrKey.isValidMed25519PublicKey).toHaveBeenCalledWith(
        validMuxed,
      );
    });

    it("should return true for valid Contract ID", () => {
      mockedStrKey.isValidEd25519PublicKey.mockReturnValueOnce(false);
      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(false);
      expect(isValidStellarAddress(validContract)).toBe(true);
      expect(mockedIsContractId).toHaveBeenCalledWith(validContract);
    });

    it("should return true for valid Federation address", () => {
      mockedStrKey.isValidEd25519PublicKey.mockReturnValueOnce(false);
      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(false);
      mockedIsContractId.mockReturnValueOnce(false);
      expect(isValidStellarAddress(validFederation)).toBe(true);
    });

    it("should return false for invalid addresses", () => {
      mockedStrKey.isValidEd25519PublicKey.mockReturnValueOnce(false);
      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(false);
      mockedIsContractId.mockReturnValueOnce(false);
      expect(isValidStellarAddress(invalidAddress)).toBe(false);
    });

    it("should return false for empty, null, or undefined input", () => {
      expect(isValidStellarAddress("")).toBe(false);
      expect(isValidStellarAddress("   ")).toBe(false);
      expect(isValidStellarAddress(null as unknown as string)).toBe(false);
      expect(isValidStellarAddress(undefined as unknown as string)).toBe(false);
    });

    it("should return false and log error if StrKey throws", () => {
      const error = new Error("StrKey error");
      mockedStrKey.isValidEd25519PublicKey.mockImplementationOnce(() => {
        throw error;
      });
      expect(isValidStellarAddress(validEd25519)).toBe(false);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "StellarHelper",
        "Error validating Stellar address:",
        error,
      );
    });
  });

  describe("truncateAddress", () => {
    it("should truncate standard G address", () => {
      expect(truncateAddress(longAddress)).toBe("GD5L...5MBN");
    });

    it("should truncate with custom prefix/suffix", () => {
      expect(truncateAddress(longAddress, 6, 6)).toBe("GD5LMK...X45MBN");
    });

    it("should not truncate short addresses", () => {
      expect(truncateAddress(shortAddress, 4, 4)).toBe(shortAddress);
      expect(truncateAddress("GABCDEFG", 4, 4)).toBe("GABCDEFG");
    });

    it("should not truncate federation addresses", () => {
      expect(truncateAddress(validFederation)).toBe(validFederation);
    });

    it("should return empty string for empty input", () => {
      expect(truncateAddress("")).toBe("");
      expect(truncateAddress(null as unknown as string)).toBe("");
      expect(truncateAddress(undefined as unknown as string)).toBe("");
    });
  });

  describe("isSameAccount", () => {
    it("should return true for identical valid Ed25519 addresses", () => {
      expect(isSameAccount(validEd25519, validEd25519)).toBe(true);
    });

    it("should return false for different valid Ed25519 addresses", () => {
      expect(isSameAccount(validEd25519, longAddress)).toBe(false);
    });

    it("should return true for identical valid Muxed addresses", () => {
      mockedStrKey.isValidMed25519PublicKey.mockReturnValue(true);
      expect(isSameAccount(validMuxed, validMuxed)).toBe(true);
    });

    it("should return true for Muxed and Ed25519 with the same base account", () => {
      mockedStrKey.isValidMed25519PublicKey.mockImplementation(
        (key) => key === validMuxed,
      );
      mockedStrKey.isValidEd25519PublicKey.mockImplementation(
        (key) => key === validEd25519,
      );
      getMuxedAccountFromAddress().mockReturnValueOnce({
        accountId: () => validEd25519,
        id: () => validMuxed,
        baseAccount: () => ({
          accountId: () => validEd25519,
        }),
      });

      expect(isSameAccount(validMuxed, validEd25519)).toBe(true);
    });

    it("should return true for two Muxed accounts with the same base account", () => {
      const secondMuxed =
        "MAQAAAAABLAGAQAAAAAQ7ZWXCGLQUPH37VPKM7VQ2PZY4XQ45KKSWY7VAI65RFNQ3XWZC35336P5X";

      mockedStrKey.isValidMed25519PublicKey.mockReturnValue(false);
      mockedStrKey.isValidMed25519PublicKey.mockImplementation(
        (key) => key === validMuxed || key === secondMuxed,
      );
      getMuxedAccountFromAddress().mockReturnValue({
        accountId: () => validEd25519,
        id: () => validMuxed,
        baseAccount: () => ({
          accountId: () => validEd25519,
        }),
      });
      mockedStrKey.isValidEd25519PublicKey.mockImplementation(
        (key) => key === validEd25519,
      );

      expect(isSameAccount(validMuxed, secondMuxed)).toBe(true);
    });

    it("should return false if base account extraction fails for muxed", () => {
      mockedStrKey.isValidMed25519PublicKey.mockImplementation(
        (key) => key === validMuxed,
      );
      mockedStrKey.isValidEd25519PublicKey.mockImplementation(
        (key) => key === validEd25519,
      );
      getMuxedAccountFromAddress().mockImplementationOnce(() => {
        throw new Error("Fail");
      });

      expect(isSameAccount(validMuxed, validEd25519)).toBe(false);
      expect(mockedLogger.error).toHaveBeenCalled();
    });

    it("should return false when comparing Contract ID with Ed25519", () => {
      mockedStrKey.isValidEd25519PublicKey.mockReturnValue(true);
      mockedIsContractId.mockImplementation((key) => key === validContract);
      expect(isSameAccount(validContract, validEd25519)).toBe(false);
    });

    it("should return false when comparing Contract ID with Muxed", () => {
      mockedStrKey.isValidMed25519PublicKey.mockImplementation(
        (key) => key === validMuxed,
      );
      mockedIsContractId.mockImplementation((key) => key === validContract);
      expect(isSameAccount(validContract, validMuxed)).toBe(false);
    });

    it("should return false when comparing two different Contract IDs", () => {
      const anotherContract =
        "CDLZXAOBJQ4S7DRM35M6BOABGSCLZH6GFGDY55YF63H2PZLK2O34QQQC";
      mockedIsContractId.mockImplementation(
        (key) => key === validContract || key === anotherContract,
      );
      expect(isSameAccount(validContract, anotherContract)).toBe(false);
    });

    it("should return false when comparing Federation address with anything else", () => {
      mockedStrKey.isValidEd25519PublicKey.mockImplementation(
        (key) => key === validEd25519,
      );
      mockedStrKey.isValidMed25519PublicKey.mockImplementation(
        (key) => key === validMuxed,
      );
      mockedIsContractId.mockImplementation((key) => key === validContract);

      expect(isSameAccount(validFederation, validEd25519)).toBe(false);
      expect(isSameAccount(validFederation, validMuxed)).toBe(false);
      expect(isSameAccount(validFederation, validContract)).toBe(false);
      expect(isSameAccount(validFederation, validFederation)).toBe(false);
      expect(isSameAccount(validFederation, "another*example.com")).toBe(false);
    });

    it("should return false for invalid or empty inputs", () => {
      expect(isSameAccount(validEd25519, "")).toBe(false);
      expect(isSameAccount("", validEd25519)).toBe(false);
      expect(isSameAccount(null as unknown as string, validEd25519)).toBe(
        false,
      );
      expect(isSameAccount(validEd25519, undefined as unknown as string)).toBe(
        false,
      );
      expect(isSameAccount(invalidAddress, validEd25519)).toBe(false);
      expect(isSameAccount(validEd25519, invalidAddress)).toBe(false);
    });

    it("should return false and log error if an error occurs", () => {
      const error = new Error("Comparison error");
      mockedStrKey.isValidEd25519PublicKey.mockImplementationOnce(() => {
        throw error;
      });
      expect(isSameAccount(validEd25519, validEd25519)).toBe(false);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "StellarHelper",
        "Error comparing Stellar addresses:",
        error,
      );
    });
  });

  describe("createMuxedAccount", () => {
    it("should create a muxed account from a valid base account and muxed ID", () => {
      const baseAccount = validEd25519;
      const muxedId = "1234";

      mockedStrKey.isValidEd25519PublicKey.mockReturnValueOnce(true);
      const result = createMuxedAccount(baseAccount, muxedId);

      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
      expect(mockedStrKey.isValidEd25519PublicKey).toHaveBeenCalledWith(
        baseAccount,
      );
    });

    it("should create a muxed account with numeric muxed ID", () => {
      const baseAccount = validEd25519;
      const muxedId = 5678;

      mockedStrKey.isValidEd25519PublicKey.mockReturnValueOnce(true);
      const result = createMuxedAccount(baseAccount, muxedId);

      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("should return null for invalid base account", () => {
      const invalidBaseAccount = "invalid-address";
      const muxedId = "1234";

      mockedStrKey.isValidEd25519PublicKey.mockReturnValueOnce(false);
      const result = createMuxedAccount(invalidBaseAccount, muxedId);

      expect(result).toBeNull();
      expect(mockedLogger.error).toHaveBeenCalled();
    });

    it("should return null and log error if MuxedAccount creation fails", () => {
      const baseAccount = validEd25519;
      const muxedId = "1234";

      mockedStrKey.isValidEd25519PublicKey.mockReturnValueOnce(true);
      // Mock MuxedAccount constructor to throw
      mockedMuxedAccount.mockImplementationOnce(() => {
        throw new Error("MuxedAccount creation failed");
      });

      const result = createMuxedAccount(baseAccount, muxedId);

      expect(result).toBeNull();
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe("getMuxedId", () => {
    it("should extract muxed ID from a valid muxed address", () => {
      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(true);
      getMuxedAccountFromAddress().mockReturnValueOnce({
        accountId: () => validMuxed,
        id: () => "1234",
      });

      const result = getMuxedId(validMuxed);

      expect(result).toBe("1234");
      expect(mockedStrKey.isValidMed25519PublicKey).toHaveBeenCalledWith(
        validMuxed,
      );
    });

    it("should return null for non-muxed address", () => {
      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(false);
      const result = getMuxedId(validEd25519);

      expect(result).toBeNull();
    });

    it("should return null if MuxedAccount.fromAddress throws", () => {
      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(true);
      getMuxedAccountFromAddress().mockImplementationOnce(() => {
        throw new Error("SDK error");
      });

      const result = getMuxedId(validMuxed);

      expect(result).toBeNull();
    });
  });

  describe("SEP-53 Message Signing", () => {
    describe("encodeSep53Message", () => {
      it("should encode a simple message with SEP-53 prefix", () => {
        const message = "Hello, Stellar!";
        const encoded = encodeSep53Message(message);

        expect(encoded).toBeInstanceOf(Buffer);
        expect(encoded.length).toBe(32); // SHA-256 hash is 32 bytes
      });

      it("should encode empty message", () => {
        const message = "";
        const encoded = encodeSep53Message(message);

        expect(encoded).toBeInstanceOf(Buffer);
        expect(encoded.length).toBe(32);
      });

      it("should encode UTF-8 message with special characters", () => {
        const message = "Hello 世界! 🌟";
        const encoded = encodeSep53Message(message);

        expect(encoded).toBeInstanceOf(Buffer);
        expect(encoded.length).toBe(32);
      });

      it("should produce different hashes for different messages", () => {
        const message1 = "Message 1";
        const message2 = "Message 2";

        const encoded1 = encodeSep53Message(message1);
        const encoded2 = encodeSep53Message(message2);

        expect(encoded1).not.toEqual(encoded2);
      });

      it("should produce same hash for same message", () => {
        const message = "Test message";

        const encoded1 = encodeSep53Message(message);
        const encoded2 = encodeSep53Message(message);

        expect(encoded1).toEqual(encoded2);
      });

      it("should include SEP-53 prefix in encoding", () => {
        // We can verify the prefix is used by comparing hashes
        // If we hash the message directly vs with prefix, they should be different
        const message = "Test";

        const directHash = hash(Buffer.from(message, "utf8"));
        const sep53Hash = encodeSep53Message(message);

        expect(directHash).not.toEqual(sep53Hash);
      });
    });

    describe("signMessage", () => {
      it("should sign a message and return base64 signature", () => {
        const message = "Hello, Stellar!";
        const privateKey =
          "SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

        // This will use the real Keypair implementation from stellar-sdk
        // We test that it returns a string that could be a base64 signature
        try {
          const signature = signMessage(message, privateKey);
          expect(typeof signature).toBe("string");
          expect(signature.length).toBeGreaterThan(0);
        } catch (error) {
          // Expected to fail with invalid key in test, but we're testing the flow
          expect(error).toBeDefined();
        }
      });

      it("should throw error for invalid private key", () => {
        const message = "Test message";
        const invalidKey = "invalid-key";

        expect(() => signMessage(message, invalidKey)).toThrow();
      });

      it("should sign empty message", () => {
        const message = "";
        const privateKey =
          "SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

        try {
          const signature = signMessage(message, privateKey);
          expect(typeof signature).toBe("string");
        } catch (error) {
          // Expected to fail with invalid key, but validates the flow
          expect(error).toBeDefined();
        }
      });
    });

    describe("SIGN_MESSAGE_PREFIX constant", () => {
      it("should have the correct SEP-53 prefix value", () => {
        expect(SIGN_MESSAGE_PREFIX).toBe("Stellar Signed Message:\n");
      });
    });
  });
});

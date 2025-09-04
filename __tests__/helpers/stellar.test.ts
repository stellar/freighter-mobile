import { MuxedAccount, StrKey } from "@stellar/stellar-sdk";
import { logger } from "config/logger";
import { isContractId } from "helpers/soroban";
import {
  getBaseAccount,
  isFederationAddress,
  isMuxedAccount,
  isSameAccount,
  isValidStellarAddress,
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
    MuxedAccount: {
      fromAddress: jest
        .fn()
        .mockImplementation((_muxedAddress, sequenceNum = "0") => ({
          accountId: () =>
            "GBIG5762G5N7PSR437NAF5KZC6EDY3PCHQ6SRG5Z3DSGKWU45KL2MSQZ", // Sample base G address
          id: () => _muxedAddress, // Return the original M address
          sequenceNumber: () => sequenceNum,
          incrementSequenceNumber: jest.fn(),
          baseAccount: () => ({
            accountId: () =>
              "GBIG5762G5N7PSR437NAF5KZC6EDY3PCHQ6SRG5Z3DSGKWU45KL2MSQZ",
            sequenceNumber: () => sequenceNum,
            incrementSequenceNumber: jest.fn(),
          }),
        })),
    },
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
const mockedMuxedAccount = MuxedAccount as jest.Mocked<typeof MuxedAccount>;
const mockedIsContractId = isContractId as jest.MockedFunction<
  typeof isContractId
>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

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
      const base = getBaseAccount(validMuxed);
      expect(base).toBe(validEd25519);
      expect(mockedStrKey.isValidMed25519PublicKey).toHaveBeenCalledWith(
        validMuxed,
      );
      expect(mockedMuxedAccount.fromAddress).toHaveBeenCalledWith(
        validMuxed,
        "0",
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
      mockedMuxedAccount.fromAddress.mockImplementationOnce(() => {
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
      expect(mockedMuxedAccount.fromAddress).not.toHaveBeenCalled();

      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(false);
      expect(getBaseAccount(null as unknown as string)).toBeNull();
      expect(mockedMuxedAccount.fromAddress).not.toHaveBeenCalled();

      mockedStrKey.isValidMed25519PublicKey.mockReturnValueOnce(false);
      expect(getBaseAccount(undefined as unknown as string)).toBeUndefined();
      expect(mockedMuxedAccount.fromAddress).not.toHaveBeenCalled();
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
      mockedMuxedAccount.fromAddress.mockImplementationOnce(
        (_muxedAddress, sequenceNum = "0") => ({
          accountId: () => validEd25519,
          id: () => _muxedAddress,
          sequenceNumber: () => sequenceNum,
          incrementSequenceNumber: jest.fn(),
          baseAccount: () => ({
            accountId: () => validEd25519,
            sequenceNumber: () => sequenceNum,
            incrementSequenceNumber: jest.fn(),
          }),
          setId: jest.fn(),
          toXDRObject: jest.fn(),
          equals: jest.fn(),
        }),
      );

      expect(isSameAccount(validMuxed, validEd25519)).toBe(true);
      expect(mockedMuxedAccount.fromAddress).toHaveBeenCalledWith(
        validMuxed,
        "0",
      );
    });

    it("should return true for two Muxed accounts with the same base account", () => {
      const secondMuxed =
        "MAQAAAAABLAGAQAAAAAQ7ZWXCGLQUPH37VPKM7VQ2PZY4XQ45KKSWY7VAI65RFNQ3XWZC35336P5X";

      mockedStrKey.isValidMed25519PublicKey.mockReturnValue(false);
      mockedStrKey.isValidMed25519PublicKey.mockImplementation(
        (key) => key === validMuxed || key === secondMuxed,
      );
      mockedMuxedAccount.fromAddress.mockImplementation(
        (_muxedAddress, sequenceNum = "0") => ({
          accountId: () => validEd25519,
          id: () => _muxedAddress,
          sequenceNumber: () => sequenceNum,
          incrementSequenceNumber: jest.fn(),
          baseAccount: () => ({
            accountId: () => validEd25519,
            sequenceNumber: () => sequenceNum,
            incrementSequenceNumber: jest.fn(),
          }),
          setId: jest.fn(),
          toXDRObject: jest.fn(),
          equals: jest.fn(),
        }),
      );
      mockedStrKey.isValidEd25519PublicKey.mockImplementation(
        (key) => key === validEd25519,
      );

      expect(isSameAccount(validMuxed, secondMuxed)).toBe(true);
      expect(mockedMuxedAccount.fromAddress).toHaveBeenCalledWith(
        validMuxed,
        "0",
      );
      expect(mockedMuxedAccount.fromAddress).toHaveBeenCalledWith(
        secondMuxed,
        "0",
      );
      expect(mockedMuxedAccount.fromAddress).toHaveBeenCalledTimes(2);
    });

    it("should return false if base account extraction fails for muxed", () => {
      mockedStrKey.isValidMed25519PublicKey.mockImplementation(
        (key) => key === validMuxed,
      );
      mockedStrKey.isValidEd25519PublicKey.mockImplementation(
        (key) => key === validEd25519,
      );
      mockedMuxedAccount.fromAddress.mockImplementationOnce(() => {
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
});

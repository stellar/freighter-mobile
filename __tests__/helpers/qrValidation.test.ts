import {
  isValidWalletConnectURI,
  isValidStellarAddressForQR,
  validateQRCodeContent,
} from "helpers/qrValidation";
import { isValidStellarAddress } from "helpers/stellar";

// Mock the stellar helper to use the same mocks as the existing stellar tests
jest.mock("helpers/stellar", () => {
  const originalModule = jest.requireActual("helpers/stellar");
  return {
    ...originalModule,
    isValidStellarAddress: jest.fn(),
  };
});

const mockedIsValidStellarAddress =
  isValidStellarAddress as jest.MockedFunction<typeof isValidStellarAddress>;

describe("QR Validation", () => {
  // Use the same valid addresses from the stellar test
  const validEd25519 =
    "GBIG5762G5N7PSR437NAF5KZC6EDY3PCHQ6SRG5Z3DSGKWU45KL2MSQZ";
  const validMuxed =
    "MAQAAAAABLAGAQAAAAAQ7ZWXCGLQUPH37VPKM7VQ2PZY4XQ45KKSWY7VAI65RFNQ3XWZC35336P5Y";
  const validFederation = "test*example.com";
  const validContract =
    "CCJZ5WH4XJZJ4OJ5VZ7H5QP374UCHNNUC6WCNMFRW7G5GP3W3O5HLNGG";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isValidWalletConnectURI", () => {
    it("should validate correct WalletConnect URIs", () => {
      const validURIs = [
        // WalletConnect v1 format
        "wc:12345678-1234-1234-1234-123456789abc@2?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=abc123def456",
        "wc:87654321-4321-4321-4321-cba987654321@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=def456ghi789",
        "wc:abcdef12-3456-7890-abcd-ef1234567890@2?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=ghi789jkl012",
        // WalletConnect v2 format
        "wc:b90698bedbc7da879e3c079e7d1275fef9c4ae7f46b24327f1e0082a3b21b625@2?relay-protocol=irn&symKey=535e8d8e9989fccf40925e8488c5cf6dc4c9b6582edb914222d9e340e0e76e3c",
        "wc:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef@2?relay-protocol=irn&symKey=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        // Discovery tab apps
        "wc:7eadcb4eb777b9f2c5e9d3faf19049bd038923bfbe949a1ac81d1d65faf31895@2?expiryTimestamp=1757014512&relay-protocol=irn&symKey=00184e99499837f06756e2084848626cdb6d9c329c6e2c27c98c5f2c5a14eaf6", // FxDAO
        "wc:5c1caaf291d160fe83d7895a67786e38cabf51b186a79a6de692be88b359b292@2?expiryTimestamp=1757014558&relay-protocol=irn&symKey=81f5e1e8a77272e5a62361ef8a7448e9f237d1fe1e3b600deb132af7bd65a99c", // Aqua
        "wc:b0ef5e7e4f8c886d13a2edf5850fbca8ccdf82aef9509ce2a744fee9be54588e@2?relay-protocol=irn&symKey=b67e8e7ac0e52449e2e2588a389660529c3b645c343d7048725612d23b1cd2ce&expiryTimestamp=1757014601", // Allbridge
        "wc:f16720099ac84e4225bdc9e359470fdf923322cc43625c382f1129e78fd79641@2?expiryTimestamp=1757014673&relay-protocol=irn&symKey=d1eacbb456944023b23cd3cde033b0bc8d82d9d51b7afcb242222bceb8a96052", // Blend
        "wc:c5f5d1405a2fbd9c247e994528e4448a68b5292c5438960f1d33a3b7204eb03f@2?expiryTimestamp=1757014760&relay-protocol=irn&symKey=5e35941d82425ed5892ae2f733051f7738c2dca9bb7932ec5a16adfb2bcd8d83", // Etherfuse
        "wc:7de080bd9dea4baf8ad88870990f3856eff7063a3cd681484545de47f93b55f4@2?expiryTimestamp=1757014846&relay-protocol=irn&symKey=429fa73b0617720a3f89a0af648e12dcd78f43edb137b890a06732e8b20c7dad", // xBull Swaps
        "wc:f82c24f0a750254e6534140a7338b141717c7ae1fb2711a4d3b4af6c2e1c565d@2?expiryTimestamp=1757014875&relay-protocol=irn&symKey=5263c001b26889d3f1e2769766fbdcc643860848e27023783116c270a50a86dc", // Soroban Domains
      ];

      validURIs.forEach((uri) => {
        expect(isValidWalletConnectURI(uri)).toBe(true);
      });
    });

    it("should reject invalid WalletConnect URIs", () => {
      const invalidURIs = [
        "", // empty string
        "   ", // whitespace only
        "wc:", // missing topic
        "wc:123@", // missing version
        "wc:123@2", // missing parameters
        "wc:123@2?bridge=test", // missing key parameter (v1)
        "wc:123@2?key=test", // missing bridge parameter (v1)
        "wc:123@2?relay-protocol=irn", // missing symKey parameter (v2)
        "wc:123@2?symKey=test", // missing relay-protocol parameter (v2)
        "wc:123@2?bridge=test&relay-protocol=irn", // mixed v1/v2 parameters without proper pairs
        "http://example.com", // not a WC URI
        "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567890123456789012345678901234567", // Stellar address
        "invalid-uri", // random string
      ];

      invalidURIs.forEach((uri) => {
        expect(isValidWalletConnectURI(uri)).toBe(false);
      });
    });

    it("should handle edge cases", () => {
      expect(isValidWalletConnectURI(null as any)).toBe(false);
      expect(isValidWalletConnectURI(undefined as any)).toBe(false);
      expect(isValidWalletConnectURI(123 as any)).toBe(false);
    });
  });

  describe("isValidStellarAddressForQR", () => {
    it("should validate correct Stellar addresses", () => {
      const validAddresses = [
        validEd25519, // Ed25519
        validMuxed, // Muxed account
        validContract, // Contract ID
        validFederation, // Federation address
      ];

      validAddresses.forEach((address) => {
        mockedIsValidStellarAddress.mockReturnValueOnce(true);
        expect(isValidStellarAddressForQR(address)).toBe(true);
        expect(mockedIsValidStellarAddress).toHaveBeenCalledWith(address);
      });
    });

    it("should reject invalid Stellar addresses", () => {
      const invalidAddresses = [
        "", // empty string
        "   ", // whitespace only
        "invalid-address", // random string
        "GABCDEFGHIJKLMNOPQRSTUVWXYZ23456789012345678901234567890123456", // too short
        "GABCDEFGHIJKLMNOPQRSTUVWXYZ2345678901234567890123456789012345678", // too long
        "wc:12345678-1234-1234-1234-123456789abc@2?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=abc123def456", // WalletConnect URI
      ];

      invalidAddresses.forEach((address) => {
        mockedIsValidStellarAddress.mockReturnValueOnce(false);
        expect(isValidStellarAddressForQR(address)).toBe(false);
        expect(mockedIsValidStellarAddress).toHaveBeenCalledWith(address);
      });
    });
  });

  describe("validateQRCodeContent", () => {
    it("should identify and validate WalletConnect URIs", () => {
      // Test WalletConnect v1 format
      const wcV1URI =
        "wc:12345678-1234-1234-1234-123456789abc@2?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=abc123def456";

      const v1Result = validateQRCodeContent(wcV1URI);

      expect(v1Result.isValid).toBe(true);
      expect(v1Result.type).toBe("walletconnect");
      expect(v1Result.content).toBe(wcV1URI);

      // Test WalletConnect v2 format
      const wcV2URI =
        "wc:b90698bedbc7da879e3c079e7d1275fef9c4ae7f46b24327f1e0082a3b21b625@2?relay-protocol=irn&symKey=535e8d8e9989fccf40925e8488c5cf6dc4c9b6582edb914222d9e340e0e76e3c";

      const v2Result = validateQRCodeContent(wcV2URI);

      expect(v2Result.isValid).toBe(true);
      expect(v2Result.type).toBe("walletconnect");
      expect(v2Result.content).toBe(wcV2URI);
    });

    it("should identify and validate Stellar addresses", () => {
      const stellarAddress = validEd25519;

      mockedIsValidStellarAddress.mockReturnValueOnce(true);
      const result = validateQRCodeContent(stellarAddress);

      expect(result.isValid).toBe(true);
      expect(result.type).toBe("stellar_address");
      expect(result.content).toBe(stellarAddress);
      expect(mockedIsValidStellarAddress).toHaveBeenCalledWith(stellarAddress);
    });

    it("should reject unknown content types", () => {
      const unknownContent = "invalid-qr-content";

      mockedIsValidStellarAddress.mockReturnValueOnce(false);
      const result = validateQRCodeContent(unknownContent);

      expect(result.isValid).toBe(false);
      expect(result.type).toBe("unknown");
      expect(result.content).toBe(unknownContent);
      expect(mockedIsValidStellarAddress).toHaveBeenCalledWith(unknownContent);
    });

    it("should handle empty and whitespace content", () => {
      mockedIsValidStellarAddress.mockReturnValue(false);
      const emptyResult = validateQRCodeContent("");

      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.type).toBe("unknown");
      expect(emptyResult.content).toBe(""); // trimmed content

      mockedIsValidStellarAddress.mockReturnValue(false);
      const whitespaceResult = validateQRCodeContent("   ");

      expect(whitespaceResult.isValid).toBe(false);
      expect(whitespaceResult.type).toBe("unknown");
      expect(whitespaceResult.content).toBe(""); // trimmed content (whitespace removed)
    });

    it("should trim content but preserve original for validation", () => {
      const wcURIWithSpaces =
        "  wc:12345678-1234-1234-1234-123456789abc@2?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=abc123def456  ";

      const result = validateQRCodeContent(wcURIWithSpaces);

      expect(result.isValid).toBe(true);
      expect(result.type).toBe("walletconnect");
      expect(result.content).toBe(
        "wc:12345678-1234-1234-1234-123456789abc@2?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=abc123def456",
      );
    });
  });
});

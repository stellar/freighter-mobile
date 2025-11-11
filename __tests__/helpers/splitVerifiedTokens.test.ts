import { NETWORKS, NATIVE_TOKEN_CODE } from "config/constants";
import { FormattedSearchTokenRecord } from "config/types";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { getNativeContractDetails } from "helpers/soroban";
import { splitVerifiedTokens } from "helpers/splitVerifiedTokens";

jest.mock("ducks/verifiedTokens");
jest.mock("helpers/soroban");

describe("splitVerifiedTokens", () => {
  const mockGetVerifiedTokens = jest.fn();
  const mockGetNativeContractDetails = getNativeContractDetails as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (useVerifiedTokensStore.getState as jest.Mock) = jest.fn(() => ({
      getVerifiedTokens: mockGetVerifiedTokens,
    }));

    // Mock native contract details
    mockGetNativeContractDetails.mockReturnValue({
      contract: "native-contract-123",
      issuer: "native-issuer-456",
      code: NATIVE_TOKEN_CODE,
      domain: "stellar.org",
    });
  });

  describe("token categorization", () => {
    it("categorizes tokens as verified when issuer matches verified list", async () => {
      const verifiedTokens = [
        {
          code: "USDC",
          issuer: "GABC123",
          contract: "C123",
          domain: "example.com",
          icon: "icon.png",
          decimals: 7,
        },
        {
          code: "USDT",
          issuer: "GDEF456",
          contract: "C456",
          domain: "example2.com",
          icon: "icon2.png",
          decimals: 7,
        },
      ];

      mockGetVerifiedTokens.mockResolvedValue(verifiedTokens);

      const tokens: FormattedSearchTokenRecord[] = [
        {
          tokenCode: "USDC",
          issuer: "GABC123",
          domain: "example.com",
          hasTrustline: false,
          isNative: false,
        },
        {
          tokenCode: "UNKNOWN",
          issuer: "GXYZ789",
          domain: "unknown.com",
          hasTrustline: false,
          isNative: false,
        },
      ];

      const result = await splitVerifiedTokens({
        tokens,
        network: NETWORKS.PUBLIC,
      });

      expect(result.verified).toHaveLength(1);
      expect(result.verified[0].tokenCode).toBe("USDC");
      expect(result.unverified).toHaveLength(1);
      expect(result.unverified[0].tokenCode).toBe("UNKNOWN");
    });

    it("categorizes tokens as verified when issuer matches (case insensitive)", async () => {
      const verifiedTokens = [
        {
          code: "USDC",
          issuer: "GABC123",
          contract: "C123",
          domain: "example.com",
          icon: "icon.png",
          decimals: 7,
        },
      ];

      mockGetVerifiedTokens.mockResolvedValue(verifiedTokens);

      const tokens: FormattedSearchTokenRecord[] = [
        {
          tokenCode: "USDC",
          issuer: "gabc123", // lowercase
          domain: "example.com",
          hasTrustline: false,
          isNative: false,
        },
      ];

      const result = await splitVerifiedTokens({
        tokens,
        network: NETWORKS.PUBLIC,
      });

      expect(result.verified).toHaveLength(1);
      expect(result.verified[0].tokenCode).toBe("USDC");
      expect(result.unverified).toHaveLength(0);
    });

    it("categorizes native tokens as verified", async () => {
      mockGetVerifiedTokens.mockResolvedValue([]);

      const tokens: FormattedSearchTokenRecord[] = [
        {
          tokenCode: NATIVE_TOKEN_CODE,
          issuer: "native-issuer-456",
          domain: "stellar.org",
          hasTrustline: true,
          isNative: true,
        },
        {
          tokenCode: NATIVE_TOKEN_CODE,
          issuer: "some-issuer",
          domain: "stellar.org",
          hasTrustline: true,
          isNative: false, // not marked as native but code is XLM
        },
      ];

      const result = await splitVerifiedTokens({
        tokens,
        network: NETWORKS.PUBLIC,
      });

      expect(result.verified).toHaveLength(2);
      expect(
        result.verified.every((t) => t.tokenCode === NATIVE_TOKEN_CODE),
      ).toBe(true);
      expect(result.unverified).toHaveLength(0);
    });

    it("categorizes tokens as unverified when not in verified list", async () => {
      const verifiedTokens = [
        {
          code: "USDC",
          issuer: "GABC123",
          contract: "C123",
          domain: "example.com",
          icon: "icon.png",
          decimals: 7,
        },
      ];

      mockGetVerifiedTokens.mockResolvedValue(verifiedTokens);

      const tokens: FormattedSearchTokenRecord[] = [
        {
          tokenCode: "SCAM",
          issuer: "GSCAM123",
          domain: "scam.com",
          hasTrustline: false,
          isNative: false,
        },
        {
          tokenCode: "FAKE",
          issuer: "GFAKE456",
          domain: "fake.com",
          hasTrustline: false,
          isNative: false,
        },
      ];

      const result = await splitVerifiedTokens({
        tokens,
        network: NETWORKS.PUBLIC,
      });

      expect(result.verified).toHaveLength(0);
      expect(result.unverified).toHaveLength(2);
    });

    it("handles empty token list", async () => {
      mockGetVerifiedTokens.mockResolvedValue([]);

      const result = await splitVerifiedTokens({
        tokens: [],
        network: NETWORKS.PUBLIC,
      });

      expect(result.verified).toHaveLength(0);
      expect(result.unverified).toHaveLength(0);
    });

    it("handles tokens with missing issuer", async () => {
      const verifiedTokens = [
        {
          code: "USDC",
          issuer: "GABC123",
          contract: "C123",
          domain: "example.com",
          icon: "icon.png",
          decimals: 7,
        },
      ];

      mockGetVerifiedTokens.mockResolvedValue(verifiedTokens);

      const tokens: FormattedSearchTokenRecord[] = [
        {
          tokenCode: "UNKNOWN",
          issuer: "", // empty issuer
          domain: "unknown.com",
          hasTrustline: false,
          isNative: false,
        },
      ];

      const result = await splitVerifiedTokens({
        tokens,
        network: NETWORKS.PUBLIC,
      });

      expect(result.verified).toHaveLength(0);
      expect(result.unverified).toHaveLength(1);
    });
  });

  describe("network handling", () => {
    it("works with different networks", async () => {
      const verifiedTokens = [
        {
          code: "TEST",
          issuer: "GTEST123",
          contract: "CTEST123",
          domain: "test.com",
          icon: "icon.png",
          decimals: 7,
        },
      ];

      mockGetVerifiedTokens.mockResolvedValue(verifiedTokens);

      const tokens: FormattedSearchTokenRecord[] = [
        {
          tokenCode: "TEST",
          issuer: "GTEST123",
          domain: "test.com",
          hasTrustline: false,
          isNative: false,
        },
      ];

      // Test with TESTNET
      const result = await splitVerifiedTokens({
        tokens,
        network: NETWORKS.TESTNET,
      });

      expect(mockGetVerifiedTokens).toHaveBeenCalledWith({
        network: NETWORKS.TESTNET,
      });
      expect(result.verified).toHaveLength(1);
    });
  });

  describe("verified token list processing", () => {
    it("includes both issuer and contract from verified tokens", async () => {
      const verifiedTokens = [
        {
          code: "TOKEN1",
          issuer: "GISSuer1",
          contract: "CCONTRACT1",
          domain: "example.com",
          icon: "icon.png",
          decimals: 7,
        },
        {
          code: "TOKEN2",
          issuer: "GISSuer2",
          contract: "", // no contract
          domain: "example2.com",
          icon: "icon2.png",
          decimals: 7,
        },
        {
          code: "TOKEN3",
          issuer: "", // no issuer
          contract: "CCONTRACT3",
          domain: "example3.com",
          icon: "icon3.png",
          decimals: 7,
        },
      ];

      mockGetVerifiedTokens.mockResolvedValue(verifiedTokens);

      const tokens: FormattedSearchTokenRecord[] = [
        {
          tokenCode: "TOKEN1",
          issuer: "GISSuer1", // matches issuer
          domain: "example.com",
          hasTrustline: false,
          isNative: false,
        },
        {
          tokenCode: "TOKEN1",
          issuer: "CCONTRACT1", // matches contract (as issuer)
          domain: "example.com",
          hasTrustline: false,
          isNative: false,
        },
        {
          tokenCode: "TOKEN3",
          issuer: "CCONTRACT3", // matches contract (as issuer)
          domain: "example3.com",
          hasTrustline: false,
          isNative: false,
        },
      ];

      const result = await splitVerifiedTokens({
        tokens,
        network: NETWORKS.PUBLIC,
      });

      expect(result.verified).toHaveLength(3);
      expect(result.unverified).toHaveLength(0);
    });

    it("always includes native contract in verified list", async () => {
      mockGetVerifiedTokens.mockResolvedValue([]);

      const tokens: FormattedSearchTokenRecord[] = [
        {
          tokenCode: "SOME",
          issuer: "native-contract-123", // matches native contract
          domain: "example.com",
          hasTrustline: false,
          isNative: false,
        },
        {
          tokenCode: "OTHER",
          issuer: "native-issuer-456", // matches native issuer
          domain: "example2.com",
          hasTrustline: false,
          isNative: false,
        },
      ];

      const result = await splitVerifiedTokens({
        tokens,
        network: NETWORKS.PUBLIC,
      });

      expect(result.verified).toHaveLength(2);
      expect(result.unverified).toHaveLength(0);
    });
  });

  describe("mixed scenarios", () => {
    it("correctly splits mixed verified and unverified tokens", async () => {
      const verifiedTokens = [
        {
          code: "VERIFIED1",
          issuer: "GVER1",
          contract: "CVER1",
          domain: "verified.com",
          icon: "icon.png",
          decimals: 7,
        },
        {
          code: "VERIFIED2",
          issuer: "GVER2",
          contract: "CVER2",
          domain: "verified2.com",
          icon: "icon2.png",
          decimals: 7,
        },
      ];

      mockGetVerifiedTokens.mockResolvedValue(verifiedTokens);

      const tokens: FormattedSearchTokenRecord[] = [
        {
          tokenCode: NATIVE_TOKEN_CODE,
          issuer: "native-issuer",
          domain: "stellar.org",
          hasTrustline: true,
          isNative: true,
        },
        {
          tokenCode: "VERIFIED1",
          issuer: "GVER1",
          domain: "verified.com",
          hasTrustline: false,
          isNative: false,
        },
        {
          tokenCode: "UNVERIFIED1",
          issuer: "GUNV1",
          domain: "unverified.com",
          hasTrustline: false,
          isNative: false,
        },
        {
          tokenCode: "VERIFIED2",
          issuer: "GVER2",
          domain: "verified2.com",
          hasTrustline: false,
          isNative: false,
        },
        {
          tokenCode: "UNVERIFIED2",
          issuer: "GUNV2",
          domain: "unverified2.com",
          hasTrustline: false,
          isNative: false,
        },
      ];

      const result = await splitVerifiedTokens({
        tokens,
        network: NETWORKS.PUBLIC,
      });

      expect(result.verified).toHaveLength(3); // native + 2 verified
      expect(result.unverified).toHaveLength(2);
      expect(result.verified.map((t) => t.tokenCode)).toEqual([
        NATIVE_TOKEN_CODE,
        "VERIFIED1",
        "VERIFIED2",
      ]);
      expect(result.unverified.map((t) => t.tokenCode)).toEqual([
        "UNVERIFIED1",
        "UNVERIFIED2",
      ]);
    });
  });
});

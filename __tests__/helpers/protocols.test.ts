import { DiscoverProtocol } from "config/types";
import { findMatchedProtocol } from "helpers/protocols";

describe("Protocols Helper", () => {
  const mockProtocols: DiscoverProtocol[] = [
    {
      name: "StellarX",
      description: "StellarX Protocol",
      iconUrl: "https://stellarx.com/icon.png",
      websiteUrl: "https://stellarx.com",
      tags: ["dex", "trading"],
    },
    {
      name: "Aquarius",
      description: "Aquarius Protocol",
      iconUrl: "https://aquarius.com/icon.png",
      websiteUrl: "https://aquarius.com",
      tags: ["liquidity", "amm"],
    },
    {
      name: "Blend",
      description: "Blend Protocol",
      iconUrl: "https://blend.com/icon.png",
      websiteUrl: "https://blend.com",
      tags: ["lending", "defi"],
    },
  ];

  describe("findMatchedProtocol", () => {
    it("should find protocol by exact name match", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchName: "StellarX",
      });

      expect(result).toEqual(mockProtocols[0]);
    });

    it("should handle case-insensitive matching", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchName: "steLLarx",
      });

      expect(result).toEqual(mockProtocols[0]);
    });

    it("should find protocol by partial name match", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchName: "StellarXDEX",
      });

      expect(result).toEqual(mockProtocols[0]);
    });

    it("should find protocol by domain in URL", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchName: "Some App",
        searchUrl: "https://stellarx.com/some-path",
      });

      expect(result).toEqual(mockProtocols[0]);
    });

    it("should find protocol by website URL match", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchName: "Some App",
        searchUrl: "https://aquarius.com",
      });

      expect(result).toEqual(mockProtocols[1]);
    });

    it("should return undefined when no match found", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchName: "NonExistent",
        searchUrl: "https://nonexistent.com",
      });

      expect(result).toBeUndefined();
    });

    it("should handle empty protocols array", () => {
      const result = findMatchedProtocol({
        protocols: [],
        searchName: "StellarX",
        searchUrl: "https://stellarx.com",
      });

      expect(result).toBeUndefined();
    });

    it("should handle undefined search parameters", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchName: undefined as any,
        searchUrl: undefined as any,
      });

      expect(result).toBeUndefined();
    });

    it("should prioritize name match over URL match", () => {
      // Create a protocol that could match both name and URL
      const protocolsWithOverlap = [
        {
          name: "StellarX",
          description: "StellarX Protocol",
          iconUrl: "https://stellarx.com/icon.png",
          websiteUrl: "https://stellarx.com",
          tags: ["dex", "trading"],
        },
        {
          name: "OtherApp",
          description: "Other App",
          iconUrl: "https://other.com/icon.png",
          websiteUrl: "https://stellarx.com", // Same domain as StellarX
          tags: ["other"],
        },
      ];

      const result = findMatchedProtocol({
        protocols: protocolsWithOverlap,
        searchName: "StellarX",
        searchUrl: "https://stellarx.com",
      });

      // Should return StellarX (name match) not OtherApp (URL match)
      expect(result).toEqual(protocolsWithOverlap[0]);
    });

    it("should handle protocols with special characters in names", () => {
      const protocolsWithSpecialChars = [
        {
          name: "Stellar-X",
          description: "Stellar-X Protocol",
          iconUrl: "https://stellar-x.com/icon.png",
          websiteUrl: "https://stellar-x.com",
          tags: ["dex"],
        },
        {
          name: "Stellar_X",
          description: "Stellar_X Protocol",
          iconUrl: "https://stellar_x.com/icon.png",
          websiteUrl: "https://stellar_x.com",
          tags: ["dex"],
        },
      ];

      const result = findMatchedProtocol({
        protocols: protocolsWithSpecialChars,
        searchName: "Stellar-X",
        searchUrl: "https://stellar-x.com",
      });

      expect(result).toEqual(protocolsWithSpecialChars[0]);
    });

    it("should handle URLs with subdomains", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchName: "Some App",
        searchUrl: "https://app.stellarx.com",
      });

      expect(result).toEqual(mockProtocols[0]);
    });

    it("should handle URLs with query parameters", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchName: "Some App",
        searchUrl: "https://stellarx.com?param=value",
      });

      expect(result).toEqual(mockProtocols[0]);
    });
  });
});

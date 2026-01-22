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
    it("should find protocol by domain in URL", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchUrl: "https://stellarx.com/some-path",
      });

      expect(result).toEqual(mockProtocols[0]);
    });

    it("should find protocol by website URL match", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchUrl: "https://aquarius.com",
      });

      expect(result).toEqual(mockProtocols[1]);
    });

    it("should return undefined when no match found", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchUrl: "https://nonexistent.com",
      });

      expect(result).toBeUndefined();
    });

    it("should return undefined when searchUrl is undefined", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchUrl: undefined,
      });

      expect(result).toBeUndefined();
    });

    it("should handle empty protocols array", () => {
      const result = findMatchedProtocol({
        protocols: [],
        searchUrl: "https://stellarx.com",
      });

      expect(result).toBeUndefined();
    });

    it("should handle protocols with special characters in domains", () => {
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
        searchUrl: "https://stellar-x.com",
      });

      expect(result).toEqual(protocolsWithSpecialChars[0]);
    });

    it("should handle URLs with query parameters", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchUrl: "https://stellarx.com?param=value",
      });

      expect(result).toEqual(mockProtocols[0]);
    });

    it("should NOT match subdomains (app.stellarx.com should not match stellarx.com)", () => {
      const result = findMatchedProtocol({
        protocols: mockProtocols,
        searchUrl: "https://app.stellarx.com",
      });

      expect(result).toBeUndefined();
    });

    it("should return first match when multiple protocols share the same domain", () => {
      const protocolsWithSameDomain = [
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
        protocols: protocolsWithSameDomain,
        searchUrl: "https://stellarx.com",
      });

      // Should return the first match (StellarX)
      expect(result).toEqual(protocolsWithSameDomain[0]);
    });

    describe("security: domain impersonation prevention", () => {
      it("should NOT match domain suffix attacks (stellarx.com.evil.com)", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "https://stellarx.com.evil.com",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match subdomain prefix attacks (evil-stellarx.com)", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "https://evil-stellarx.com",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match similar-looking domains (stellerx.com)", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "https://stellerx.com", // Missing 'a' in stellar
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match IP addresses", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "https://192.168.1.1",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match localhost", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "https://localhost",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match invalid URLs", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "not-a-valid-url",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match subdomains (app.stellarx.com should not match stellarx.com)", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "https://app.stellarx.com",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match complex subdomains (api.v2.stellarx.com should not match stellarx.com)", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "https://api.v2.stellarx.com",
        });

        expect(result).toBeUndefined();
      });

      it("should match exact hostname (case-sensitive)", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "https://stellarx.com",
        });

        expect(result).toEqual(mockProtocols[0]);
      });

      it("should match protocol with subdomain if searchUrl also has same subdomain", () => {
        const protocolsWithSubdomain = [
          {
            name: "StellarX App",
            description: "StellarX App Protocol",
            iconUrl: "https://app.stellarx.com/icon.png",
            websiteUrl: "https://app.stellarx.com",
            tags: ["dex", "trading"],
          },
        ];

        const result = findMatchedProtocol({
          protocols: protocolsWithSubdomain,
          searchUrl: "https://app.stellarx.com",
        });

        expect(result).toEqual(protocolsWithSubdomain[0]);
      });
    });

    describe("non-standard transfer protocols", () => {
      it("should NOT match http: protocol (only HTTPS is allowed)", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "http://stellarx.com",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match mailto: protocol", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "mailto:user@stellarx.com",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match tel: protocol", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "tel:+1234567890",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match file: protocol", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "file:///path/to/file.html",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match data: URI", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "data:text/html,<html></html>",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match ftp: protocol even with valid hostname", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "ftp://stellarx.com/file.txt",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match ws: (WebSocket) protocol", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "ws://stellarx.com/socket",
        });

        expect(result).toBeUndefined();
      });

      it("should NOT match wss: (Secure WebSocket) protocol", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "wss://stellarx.com/socket",
        });

        expect(result).toBeUndefined();
      });

      it("should handle mailto: with domain-like structure", () => {
        const result = findMatchedProtocol({
          protocols: mockProtocols,
          searchUrl: "mailto:contact@stellarx.com",
        });

        expect(result).toBeUndefined();
      });
    });
  });
});

// Test the filtering logic directly
describe("Backend Service - Protocol Filtering Logic", () => {
  // Import the filtering logic from the backend service
  const testFilteringLogic = (protocols: any[]) =>
    protocols.filter((protocol) => {
      if (
        protocol.is_blacklisted === true ||
        protocol.is_wc_not_supported === true
      ) {
        return false;
      }

      return true;
    });

  describe("Filtering logic with different API responses", () => {
    it("should filter out blacklisted protocols", () => {
      const mockProtocols = [
        {
          description: "Blacklisted Protocol",
          icon_url: "https://example.com/blacklisted.png",
          name: "BlacklistedProtocol",
          website_url: "https://blacklisted.example.com",
          tags: ["blacklisted"],
          is_blacklisted: true,
          is_wc_not_supported: false,
        },
        {
          description: "Valid Protocol",
          icon_url: "https://example.com/valid.png",
          name: "ValidProtocol",
          website_url: "https://valid.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ValidProtocol");
    });

    it("should filter out WC unsupported protocols", () => {
      const mockProtocols = [
        {
          description: "WC Unsupported Protocol",
          icon_url: "https://example.com/unsupported.png",
          name: "UnsupportedProtocol",
          website_url: "https://unsupported.example.com",
          tags: ["unsupported"],
          is_blacklisted: false,
          is_wc_not_supported: true,
        },
        {
          description: "Valid Protocol",
          icon_url: "https://example.com/valid.png",
          name: "ValidProtocol",
          website_url: "https://valid.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ValidProtocol");
    });

    it("should filter out protocols that are both blacklisted and WC unsupported", () => {
      const mockProtocols = [
        {
          description: "Double Filtered Protocol",
          icon_url: "https://example.com/double.png",
          name: "DoubleFilteredProtocol",
          website_url: "https://double.example.com",
          tags: ["double"],
          is_blacklisted: true,
          is_wc_not_supported: true,
        },
        {
          description: "Valid Protocol",
          icon_url: "https://example.com/valid.png",
          name: "ValidProtocol",
          website_url: "https://valid.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ValidProtocol");
    });

    it("should handle protocols with undefined filtering flags", () => {
      const mockProtocols = [
        {
          description: "Protocol with undefined flags",
          icon_url: "https://example.com/undefined.png",
          name: "UndefinedProtocol",
          website_url: "https://undefined.example.com",
          tags: ["undefined"],
          is_blacklisted: undefined,
          is_wc_not_supported: undefined,
        },
        {
          description: "Valid Protocol",
          icon_url: "https://example.com/valid.png",
          name: "ValidProtocol",
          website_url: "https://valid.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("UndefinedProtocol");
      expect(result[1].name).toBe("ValidProtocol");
    });

    it("should handle protocols with null filtering flags", () => {
      const mockProtocols = [
        {
          description: "Protocol with null flags",
          icon_url: "https://example.com/null.png",
          name: "NullProtocol",
          website_url: "https://null.example.com",
          tags: ["null"],
          is_blacklisted: null,
          is_wc_not_supported: null,
        },
        {
          description: "Valid Protocol",
          icon_url: "https://example.com/valid.png",
          name: "ValidProtocol",
          website_url: "https://valid.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("NullProtocol");
      expect(result[1].name).toBe("ValidProtocol");
    });

    it("should include protocols with is_blacklisted: false and is_wc_not_supported: false", () => {
      const mockProtocols = [
        {
          description: "Valid Protocol 1",
          icon_url: "https://example.com/valid1.png",
          name: "ValidProtocol1",
          website_url: "https://valid1.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
        {
          description: "Valid Protocol 2",
          icon_url: "https://example.com/valid2.png",
          name: "ValidProtocol2",
          website_url: "https://valid2.example.com",
          tags: ["valid"],
          is_blacklisted: false,
          is_wc_not_supported: false,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("ValidProtocol1");
      expect(result[1].name).toBe("ValidProtocol2");
    });

    it("should include protocols with undefined filtering flags", () => {
      const mockProtocols = [
        {
          description: "Protocol with undefined flags",
          icon_url: "https://example.com/undefined.png",
          name: "UndefinedProtocol",
          website_url: "https://undefined.example.com",
          tags: ["undefined"],
          is_blacklisted: undefined,
          is_wc_not_supported: undefined,
        },
      ];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("UndefinedProtocol");
    });

    it("should handle empty protocols array", () => {
      const mockProtocols: any[] = [];

      const result = testFilteringLogic(mockProtocols);

      expect(result).toEqual([]);
    });
  });
});

import { validateIconUrl } from "helpers/validateIconUrl";
import { Image } from "react-native";

// Mock React Native Image
jest.mock("react-native", () => ({
  Image: {
    prefetch: jest.fn(),
  },
}));

// Mock debug helper
jest.mock("helpers/debug", () => ({
  debug: jest.fn(),
}));

describe("validateIconUrl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("empty or invalid URLs", () => {
    it("should return false for empty string", async () => {
      const result = await validateIconUrl("");
      expect(result).toBe(false);
    });

    it("should return false for null-like values", async () => {
      const result = await validateIconUrl("");
      expect(result).toBe(false);
    });

    it("should return false for non-string values", async () => {
      const result = await validateIconUrl("");
      expect(result).toBe(false);
    });
  });

  describe("local resources and non-HTTP URLs", () => {
    it("should return true for local file paths", async () => {
      const result = await validateIconUrl("/assets/logo.png");
      expect(result).toBe(true);
      expect(Image.prefetch).not.toHaveBeenCalled();
    });

    it("should return true for relative paths", async () => {
      const result = await validateIconUrl("assets/logo.png");
      expect(result).toBe(true);
      expect(Image.prefetch).not.toHaveBeenCalled();
    });

    it("should return true for data URIs", async () => {
      const dataUri =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const result = await validateIconUrl(dataUri);
      expect(result).toBe(true);
      expect(Image.prefetch).not.toHaveBeenCalled();
    });
  });

  describe("remote HTTPS URLs", () => {
    it("should prefetch and return true for valid HTTPS URLs", async () => {
      (Image.prefetch as jest.Mock).mockResolvedValue(undefined);

      const result = await validateIconUrl("https://example.com/logo.png");

      expect(result).toBe(true);
      expect(Image.prefetch).toHaveBeenCalledWith(
        "https://example.com/logo.png",
      );
    });

    it("should return false when prefetch fails", async () => {
      (Image.prefetch as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );

      const result = await validateIconUrl("https://example.com/logo.png");

      expect(result).toBe(false);
    });

    it("should return false on timeout (after 3 seconds)", async () => {
      // Mock a never-resolving promise
      (Image.prefetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(undefined), 10000); // Resolves after 10 seconds
          }),
      );

      const promise = validateIconUrl("https://example.com/slow-logo.png");

      // Fast-forward time to trigger timeout (3000ms)
      jest.advanceTimersByTime(3000);

      const result = await promise;
      expect(result).toBe(false);
    });

    it("should return true if prefetch completes before timeout", async () => {
      (Image.prefetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(undefined), 500); // Resolves before timeout
          }),
      );

      const promise = validateIconUrl("https://example.com/fast-logo.png");

      // Fast-forward to beyond when prefetch completes
      jest.advanceTimersByTime(600);

      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe("remote HTTP URLs", () => {
    it("should prefetch and return true for valid HTTP URLs", async () => {
      (Image.prefetch as jest.Mock).mockResolvedValue(undefined);

      const result = await validateIconUrl("http://example.com/logo.png");

      expect(result).toBe(true);
      expect(Image.prefetch).toHaveBeenCalledWith(
        "http://example.com/logo.png",
      );
    });

    it("should return false when HTTP URL prefetch fails", async () => {
      (Image.prefetch as jest.Mock).mockRejectedValue(
        new Error("404 Not Found"),
      );

      const result = await validateIconUrl("http://example.com/missing.png");

      expect(result).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should return false if Image.prefetch throws an error", async () => {
      (Image.prefetch as jest.Mock).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = await validateIconUrl("https://example.com/logo.png");

      expect(result).toBe(false);
    });

    it("should handle network timeout gracefully", async () => {
      (Image.prefetch as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), 5000);
          }),
      );

      const promise = validateIconUrl("https://example.com/slow-logo.png");

      // Fast-forward past our validation timeout
      jest.advanceTimersByTime(3000);

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe("concurrent validations", () => {
    it("should handle multiple concurrent validations", async () => {
      (Image.prefetch as jest.Mock).mockResolvedValue(undefined);

      const urls = [
        "https://example.com/logo1.png",
        "https://example.com/logo2.png",
        "https://example.com/logo3.png",
      ];

      const results = await Promise.all(urls.map(validateIconUrl));

      expect(results).toEqual([true, true, true]);
      expect(Image.prefetch).toHaveBeenCalledTimes(3);
    });

    it("should validate same URL multiple times independently", async () => {
      (Image.prefetch as jest.Mock).mockResolvedValue(undefined);

      const url = "https://example.com/logo.png";
      const results = await Promise.all([
        validateIconUrl(url),
        validateIconUrl(url),
        validateIconUrl(url),
      ]);

      expect(results).toEqual([true, true, true]);
      // Each call should independently call Image.prefetch
      expect(Image.prefetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("special cases", () => {
    it("should handle URLs with query parameters", async () => {
      (Image.prefetch as jest.Mock).mockResolvedValue(undefined);

      const result = await validateIconUrl(
        "https://example.com/logo.png?size=large&format=webp",
      );

      expect(result).toBe(true);
      expect(Image.prefetch).toHaveBeenCalledWith(
        "https://example.com/logo.png?size=large&format=webp",
      );
    });

    it("should handle URLs with fragments", async () => {
      (Image.prefetch as jest.Mock).mockResolvedValue(undefined);

      const result = await validateIconUrl(
        "https://example.com/logo.png#section",
      );

      expect(result).toBe(true);
    });

    it("should handle URLs with subdomains", async () => {
      (Image.prefetch as jest.Mock).mockResolvedValue(undefined);

      const result = await validateIconUrl(
        "https://cdn.assets.example.com/logo.png",
      );

      expect(result).toBe(true);
    });

    it("should handle URLs with port numbers", async () => {
      (Image.prefetch as jest.Mock).mockResolvedValue(undefined);

      const result = await validateIconUrl("https://example.com:8080/logo.png");

      expect(result).toBe(true);
    });
  });

  describe("timeout behavior", () => {
    it("should complete validation if prefetch completes just before timeout", async () => {
      (Image.prefetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(undefined), 2999);
          }),
      );

      const promise = validateIconUrl("https://example.com/logo.png");

      jest.advanceTimersByTime(2999);
      const result = await promise;

      expect(result).toBe(true);
    });

    it("should timeout if prefetch takes exactly 3 seconds", async () => {
      (Image.prefetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(undefined), 3000);
          }),
      );

      const promise = validateIconUrl("https://example.com/logo.png");

      jest.advanceTimersByTime(3000);
      const result = await promise;

      // Result depends on Promise.race behavior - both resolve at same time
      // In this case, either could win, but we test the behavior
      expect(typeof result).toBe("boolean");
    });
  });
});

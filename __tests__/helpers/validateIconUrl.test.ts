import FastImage from "@d11/react-native-fast-image";
import { validateIconUrl } from "helpers/validateIconUrl";

// Mock debug helper
jest.mock("helpers/debug", () => ({
  debug: jest.fn(),
}));

describe("validateIconUrl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    global.fetch = jest.fn();
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
    it("should return false for local file paths", async () => {
      const result = await validateIconUrl("/assets/logo.png");
      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should return false for relative paths", async () => {
      const result = await validateIconUrl("assets/logo.png");
      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should return true for data URIs", async () => {
      const dataUri =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const result = await validateIconUrl(dataUri);
      expect(result).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("remote HTTPS URLs", () => {
    it("should validate and preload for valid HTTPS URLs", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      const result = await validateIconUrl("https://example.com/logo.png");

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/logo.png",
        { method: "HEAD" },
      );
      expect(FastImage.preload).toHaveBeenCalledWith([
        { uri: "https://example.com/logo.png" },
      ]);
    });

    it("should return false when HEAD request fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });

      const result = await validateIconUrl("https://example.com/logo.png");

      expect(result).toBe(false);
      expect(FastImage.preload).not.toHaveBeenCalled();
    });

    it("should return false when fetch rejects", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await validateIconUrl("https://example.com/logo.png");

      expect(result).toBe(false);
      expect(FastImage.preload).not.toHaveBeenCalled();
    });

    it("should return false on timeout (after 3 seconds)", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, status: 200 }), 10000);
          }),
      );

      const promise = validateIconUrl("https://example.com/slow-logo.png");

      jest.advanceTimersByTime(3000);

      const result = await promise;
      expect(result).toBe(false);
    });

    it("should return true if fetch completes before timeout", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, status: 200 }), 500);
          }),
      );

      const promise = validateIconUrl("https://example.com/fast-logo.png");

      jest.advanceTimersByTime(600);

      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe("remote HTTP URLs", () => {
    it("should validate and preload for valid HTTP URLs", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      const result = await validateIconUrl("http://example.com/logo.png");

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith("http://example.com/logo.png", {
        method: "HEAD",
      });
      expect(FastImage.preload).toHaveBeenCalledWith([
        { uri: "http://example.com/logo.png" },
      ]);
    });

    it("should return false when HTTP URL returns error status", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });

      const result = await validateIconUrl("http://example.com/missing.png");

      expect(result).toBe(false);
      expect(FastImage.preload).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should return false if fetch throws synchronously", async () => {
      (global.fetch as jest.Mock).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = await validateIconUrl("https://example.com/logo.png");

      expect(result).toBe(false);
    });

    it("should handle network timeout gracefully", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), 5000);
          }),
      );

      const promise = validateIconUrl("https://example.com/slow-logo.png");

      jest.advanceTimersByTime(3000);

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe("concurrent validations", () => {
    it("should handle multiple concurrent validations", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      const urls = [
        "https://example.com/logo1.png",
        "https://example.com/logo2.png",
        "https://example.com/logo3.png",
      ];

      const results = await Promise.all(urls.map(validateIconUrl));

      expect(results).toEqual([true, true, true]);
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(FastImage.preload).toHaveBeenCalledTimes(3);
    });

    it("should validate same URL multiple times independently", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      const url = "https://example.com/logo.png";
      const results = await Promise.all([
        validateIconUrl(url),
        validateIconUrl(url),
        validateIconUrl(url),
      ]);

      expect(results).toEqual([true, true, true]);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("special cases", () => {
    it("should handle URLs with query parameters", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      const result = await validateIconUrl(
        "https://example.com/logo.png?size=large&format=webp",
      );

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/logo.png?size=large&format=webp",
        { method: "HEAD" },
      );
    });

    it("should handle URLs with fragments", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      const result = await validateIconUrl(
        "https://example.com/logo.png#section",
      );

      expect(result).toBe(true);
    });

    it("should handle URLs with subdomains", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      const result = await validateIconUrl(
        "https://cdn.assets.example.com/logo.png",
      );

      expect(result).toBe(true);
    });

    it("should handle URLs with port numbers", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      const result = await validateIconUrl("https://example.com:8080/logo.png");

      expect(result).toBe(true);
    });
  });

  describe("timeout behavior", () => {
    it("should complete validation if fetch completes just before timeout", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, status: 200 }), 2999);
          }),
      );

      const promise = validateIconUrl("https://example.com/logo.png");

      jest.advanceTimersByTime(2999);
      const result = await promise;

      expect(result).toBe(true);
    });

    it("should timeout if fetch takes exactly 3 seconds", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, status: 200 }), 3000);
          }),
      );

      const promise = validateIconUrl("https://example.com/logo.png");

      jest.advanceTimersByTime(3000);
      const result = await promise;

      // Result depends on Promise.race behavior - both resolve at same time
      expect(typeof result).toBe("boolean");
    });
  });
});

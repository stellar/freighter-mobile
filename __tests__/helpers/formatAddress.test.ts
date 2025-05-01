import { truncateAddress } from "helpers/formatAddress";

describe("formatAddress helpers", () => {
  describe("truncateAddress", () => {
    it("should truncate an address with default parameters (4 chars at start, 4 at end)", () => {
      const address =
        "GBQZGOCUYJFZB7WSDMFWJ2NDLXUFS7XK4WPIW4UR4TLQFFZGHC77T5NL";
      expect(truncateAddress(address)).toBe("GBQZ...T5NL");
    });

    it("should truncate an address with custom prefix and suffix lengths", () => {
      const address =
        "GBQZGOCUYJFZB7WSDMFWJ2NDLXUFS7XK4WPIW4UR4TLQFFZGHC77T5NL";
      expect(truncateAddress(address, 6, 8)).toBe("GBQZGO...HC77T5NL");
    });

    it("should return the original address if it's shorter than the prefix + suffix + ellipsis", () => {
      const shortAddress = "GBQZT5NL";
      expect(truncateAddress(shortAddress)).toBe(shortAddress);
    });

    it("should return empty string if the address is undefined or empty", () => {
      expect(truncateAddress("")).toBe("");
      expect(truncateAddress(undefined as unknown as string)).toBe("");
    });

    it("should handle edge cases with very small prefix or suffix", () => {
      const address =
        "GBQZGOCUYJFZB7WSDMFWJ2NDLXUFS7XK4WPIW4UR4TLQFFZGHC77T5NL";
      expect(truncateAddress(address, 0, 4)).toBe("...T5NL");
      expect(truncateAddress(address, 4, 0)).toBe("GBQZ...");
      expect(truncateAddress(address, 0, 0)).toBe("...");
    });

    it("should handle an address that's exactly the length of prefix + suffix + ellipsis", () => {
      const address = "GBQZT5NL"; // 4 + 4 + 3 = 11 chars
      expect(truncateAddress(address)).toBe(address);
    });

    it("should handle negative prefix or suffix length values", () => {
      const address =
        "GBQZGOCUYJFZB7WSDMFWJ2NDLXUFS7XK4WPIW4UR4TLQFFZGHC77T5NL";
      expect(truncateAddress(address, -2, 4)).toBe("...T5NL");
      expect(truncateAddress(address, 4, -3)).toBe("GBQZ...");
      expect(truncateAddress(address, -1, -1)).toBe("...");
    });
  });
});

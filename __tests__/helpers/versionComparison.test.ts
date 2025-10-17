import { Comparison } from "config/constants";
import {
  compareVersions,
  isVersionBelow,
  isDifferentProtocol,
} from "helpers/versionComparison";

describe("versionComparison helpers", () => {
  describe("compareVersions", () => {
    it("should return SAME for identical versions", () => {
      expect(compareVersions("1.0.0", "1.0.0")).toBe(Comparison.SAME);
      expect(compareVersions("2.5.3", "2.5.3")).toBe(Comparison.SAME);
      expect(compareVersions("0.0.1", "0.0.1")).toBe(Comparison.SAME);
    });

    it("should return LOWER when first version is lower", () => {
      expect(compareVersions("1.0.0", "1.0.1")).toBe(Comparison.LOWER);
      expect(compareVersions("1.0.0", "1.1.0")).toBe(Comparison.LOWER);
      expect(compareVersions("1.0.0", "2.0.0")).toBe(Comparison.LOWER);
      expect(compareVersions("0.9.9", "1.0.0")).toBe(Comparison.LOWER);
    });

    it("should return GREATER when first version is higher", () => {
      expect(compareVersions("1.0.1", "1.0.0")).toBe(Comparison.GREATER);
      expect(compareVersions("1.1.0", "1.0.0")).toBe(Comparison.GREATER);
      expect(compareVersions("2.0.0", "1.0.0")).toBe(Comparison.GREATER);
      expect(compareVersions("1.0.0", "0.9.9")).toBe(Comparison.GREATER);
    });

    it("should handle different length versions by padding with zeros", () => {
      expect(compareVersions("1.0", "1.0.0")).toBe(Comparison.SAME);
      expect(compareVersions("1.0.0", "1.0")).toBe(Comparison.SAME);
      expect(compareVersions("1.0", "1.0.1")).toBe(Comparison.LOWER);
      expect(compareVersions("1.0.1", "1.0")).toBe(Comparison.GREATER);
      expect(compareVersions("1", "1.0.0")).toBe(Comparison.SAME);
      expect(compareVersions("1.0.0", "1")).toBe(Comparison.SAME);
    });

    it("should handle complex version comparisons", () => {
      expect(compareVersions("1.2.3", "1.2.4")).toBe(Comparison.LOWER);
      expect(compareVersions("1.2.4", "1.2.3")).toBe(Comparison.GREATER);
      expect(compareVersions("2.0.0", "1.9.9")).toBe(Comparison.GREATER);
      expect(compareVersions("1.9.9", "2.0.0")).toBe(Comparison.LOWER);
    });

    it("should handle edge cases", () => {
      expect(compareVersions("0.0.0", "0.0.1")).toBe(Comparison.LOWER);
      expect(compareVersions("0.0.1", "0.0.0")).toBe(Comparison.GREATER);
      expect(compareVersions("", "1.0.0")).toBe(Comparison.LOWER);
      expect(compareVersions("1.0.0", "")).toBe(Comparison.GREATER);
    });
  });

  describe("isVersionBelow", () => {
    it("should return true when current version is below target", () => {
      expect(isVersionBelow("1.0.0", "1.0.1")).toBe(true);
      expect(isVersionBelow("1.0.0", "1.1.0")).toBe(true);
      expect(isVersionBelow("1.0.0", "2.0.0")).toBe(true);
      expect(isVersionBelow("0.9.9", "1.0.0")).toBe(true);
    });

    it("should return false when current version is at or above target", () => {
      expect(isVersionBelow("1.0.0", "1.0.0")).toBe(false);
      expect(isVersionBelow("1.0.1", "1.0.0")).toBe(false);
      expect(isVersionBelow("1.1.0", "1.0.0")).toBe(false);
      expect(isVersionBelow("2.0.0", "1.0.0")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(isVersionBelow("0.0.0", "0.0.1")).toBe(true);
      expect(isVersionBelow("0.0.1", "0.0.0")).toBe(false);
    });
  });

  describe("isDifferentProtocol", () => {
    it("should return true when protocol versions are different", () => {
      expect(isDifferentProtocol("1.5.23", "1.6.24")).toBe(true); // 23 vs 24
      expect(isDifferentProtocol("1.6.23", "1.6.24")).toBe(true); // 23 vs 24
      expect(isDifferentProtocol("1.0.0", "1.0.1")).toBe(true); // 0 vs 1
      expect(isDifferentProtocol("2.5.10", "2.5.11")).toBe(true); // 10 vs 11
    });

    it("should return false when protocol versions are the same", () => {
      expect(isDifferentProtocol("1.5.23", "1.6.23")).toBe(false); // 23 vs 23
      expect(isDifferentProtocol("1.6.23", "1.6.23")).toBe(false); // 23 vs 23
      expect(isDifferentProtocol("1.0.0", "1.0.0")).toBe(false); // 0 vs 0
      expect(isDifferentProtocol("2.5.10", "2.5.10")).toBe(false); // 10 vs 10
    });

    it("should handle versions with different lengths", () => {
      expect(isDifferentProtocol("1.5", "1.6.24")).toBe(true); // 0 vs 24
      expect(isDifferentProtocol("1.5.23", "1.6")).toBe(true); // 23 vs 0
      expect(isDifferentProtocol("1.5", "1.6")).toBe(false); // 0 vs 0
    });

    it("should handle edge cases", () => {
      expect(isDifferentProtocol("", "1.0.0")).toBe(false); // 0 vs 0 (empty string treated as 0)
      expect(isDifferentProtocol("1.0.0", "")).toBe(false); // 0 vs 0 (empty string treated as 0)
      expect(isDifferentProtocol("", "")).toBe(false); // 0 vs 0 (both empty)
      expect(isDifferentProtocol("1.0.1", "1.0.0")).toBe(true); // 1 vs 0
      expect(isDifferentProtocol("1.0.0", "1.0.1")).toBe(true); // 0 vs 1
    });
  });

  describe("real-world scenarios", () => {
    it("should handle typical app version scenarios", () => {
      // Current app version scenarios
      expect(isVersionBelow("0.1.0", "0.2.0")).toBe(true);
      expect(isVersionBelow("0.2.0", "0.2.0")).toBe(false);
      expect(isVersionBelow("0.3.0", "0.2.0")).toBe(false);

      // Protocol version scenarios (1.5.23 vs 1.4.23)
      expect(isVersionBelow("1.5.23", "1.4.23")).toBe(false); // 1.5.23 is above 1.4.23
      expect(isVersionBelow("1.4.23", "1.5.23")).toBe(true); // 1.4.23 is below 1.5.23
      expect(isVersionBelow("1.6.23", "1.6.24")).toBe(true); // 1.6.23 is below 1.6.24
    });
  });
});

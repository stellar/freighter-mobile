import {
  getFloatingTabBarClearance,
  getFloatingTabBarTop,
  getPillBottomOffset,
  getPillWidth,
  getTabTargetLeft,
} from "components/FloatingTabBar/geometry";
import { pxValue } from "helpers/dimensions";

// The identity, as everywhere in Jest, until a test swaps it.
jest.mock("helpers/dimensions", () => ({
  pxValue: jest.fn((value: number) => value),
}));

// Figma: Tab Bar Buttons (?node-id=3487-68630), a 227×64 pill holding three
// 77×56 targets that overlap by 8.
describe("floating tab bar geometry", () => {
  describe("getPillWidth", () => {
    it("is Figma's 227 for three tabs", () => {
      expect(getPillWidth(3)).toBe(227);
    });

    it("shrinks to 158 for two, with the same ends and overlap", () => {
      expect(getPillWidth(2)).toBe(158);
    });
  });

  describe("getTabTargetLeft", () => {
    it.each([
      [0, 6],
      [1, 75],
      [2, 144],
    ])("puts target %i at %i", (index, left) => {
      expect(getTabTargetLeft(index)).toBe(left);
    });
  });

  describe("getPillBottomOffset", () => {
    it("sits 6pt above the bottom inset", () => {
      expect(getPillBottomOffset(34)).toBe(40);
    });

    it("stays 16pt from the edge without an inset", () => {
      expect(getPillBottomOffset(0)).toBe(16);
    });
  });

  describe("getFloatingTabBarTop", () => {
    it("is the pill's offset and its height, with no gap", () => {
      expect(getFloatingTabBarTop(34)).toBe(104);
      expect(getFloatingTabBarTop(0)).toBe(80);
    });

    it("scales the pill, but not the offset", () => {
      jest.mocked(pxValue).mockImplementation((value) => value / 2);

      try {
        // 40 + 64 / 2
        expect(getFloatingTabBarTop(34)).toBe(72);
      } finally {
        jest.mocked(pxValue).mockImplementation((value) => value);
      }
    });
  });

  describe("getFloatingTabBarClearance", () => {
    it("is the pill's offset, its height and a 16pt gap", () => {
      expect(getFloatingTabBarClearance(34)).toBe(120);
      expect(getFloatingTabBarClearance(0)).toBe(96);
    });

    it("scales the pill and the gap, but not the offset", () => {
      // A screen half the design's width, to tell the scaled terms from the
      // unscaled one.
      jest.mocked(pxValue).mockImplementation((value) => value / 2);

      try {
        // 40 + 64 / 2 + 16 / 2
        expect(getFloatingTabBarClearance(34)).toBe(80);
      } finally {
        jest.mocked(pxValue).mockImplementation((value) => value);
      }
    });
  });
});

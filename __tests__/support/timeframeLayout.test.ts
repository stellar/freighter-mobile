import { readBundledFont, widthInEm } from "__tests__/support/fontMetrics";
import { DEVICES, pxValue } from "__tests__/support/timeframeLayout";

/**
 * The two models the selector's width guard rests on, pinned against
 * independent sources.
 *
 * Neither can be checked by the suites that use them: `jest.setup.js` mocks
 * `helpers/dimensions` to identity for every test, so the real `pxValue` is
 * unreachable there, and the font reader is the only thing measuring glyphs.
 * Without this file both are unfalsifiable — the exact property that made the
 * hand-transcribed advance-width table worth deleting.
 */
describe("the pxValue mirror", () => {
  /**
   * Pinned against values derived by hand from the formula in
   * `src/helpers/dimensions.ts`, rather than by calling it.
   *
   * Calling it is not possible from a suite: `jest.setup.js` mocks both
   * `helpers/dimensions` (to identity) and `react-native-responsive-screen`
   * (which it is built on), so `requireActual` would measure the mock. These
   * expectations are therefore an independent oracle in the same sense the
   * font measurements are — recompute them if the design reference, the 1.2
   * cap or the rounding in that file changes.
   */
  it.each([
    ["iPhone SE 1st gen", 14, 11.0],
    ["iPhone SE 1st gen", 22, 17.0],
    ["iPhone SE 1st gen", 24, 18.5],
    ["iPhone 16 Pro", 14, 14.0],
    ["iPhone 16 Pro", 24, 24.0],
    ["Android sw320dp (large display)", 14, 11.26],
    ["Android sw320dp (large display)", 24, 18.96],
  ])("scales %s's %ipt to %fpt", (name, design, expected) => {
    const device = DEVICES.find((d) => d.name === name)!;

    expect(pxValue(design, device)).toBeCloseTo(expected, 2);
  });

  it("is the identity on the design reference device", () => {
    // 402x874 is what the scale is defined against, so anything else there
    // means the reference constants have drifted.
    const reference = DEVICES.find((d) => d.width === 402)!;

    [14, 22, 24, 44].forEach((design) => {
      expect(pxValue(design, reference)).toBeCloseTo(design, 2);
    });
  });

  it("gives a 320-unit Android less room than a 320pt iPhone", () => {
    // `deviceScale` caps at 1.2, which the 320x568 iPhone trips and the taller
    // Android does not — so equal widths are not equal budgets, which is why
    // the device list cannot be iPhone-only.
    const iphone = DEVICES.find((d) => d.name === "iPhone SE 1st gen")!;
    const android = DEVICES.find((d) => d.width === 320 && d !== iphone)!;

    expect(pxValue(14, android)).toBeGreaterThan(pxValue(14, iphone));
  });
});

describe("the font reader", () => {
  const semiBold = readBundledFont("Inter-SemiBold.ttf");

  // Measured independently with fontTools against the same file. These pin
  // the cmap format 4 segment search, the idDelta wraparound (Á sits in a
  // different segment from the ASCII range) and the hmtx lookup.
  it.each([
    ["M", 0.9131],
    ["1", 0.4136],
    ["Á", 0.7202],
    ["MÁX", 2.3442],
    ["TUDO", 2.8623],
  ])("measures %s at %f em", (text, expected) => {
    expect(widthInEm(semiBold, text)).toBeCloseTo(expected, 3);
  });

  it("throws on a glyph the face does not contain", () => {
    expect(() => widthInEm(semiBold, "▚")).toThrow(/no glyph for/);
  });
});

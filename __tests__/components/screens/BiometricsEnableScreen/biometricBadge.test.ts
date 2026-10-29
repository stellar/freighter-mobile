/*
 * Same import/order vs prettier-plugin-sort-imports conflict that
 * __tests__/config/theme.test.ts documents: prettier runs after eslint --fix in
 * the pre-commit hook, so its alphabetical block always wins and the rule can
 * never be satisfied.
 */
/* eslint-disable import/order */
import { BIOMETRIC_BADGE } from "components/screens/BiometricsEnableScreen/BiometricsEnableScreen";
import { colors } from "config/colors";
import fs from "fs";
import path from "path";

/**
 * Values read from the Varial onboarding screens in Figma:
 * light https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=1-11981
 * dark  https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=760-36930
 */
describe("BIOMETRIC_BADGE", () => {
  it("frosts the card with the light surface on a light device", () => {
    expect(BIOMETRIC_BADGE.light).toMatchObject({
      // iOS blur materials carry their own tint, so the material *is* the
      // surface here. Compositing Figma's rgba on top of one as well stacked
      // two tints and made the card opaque, hiding the artwork it is meant to
      // blur.
      blurType: "light",
      blurAmount: 6,
      surface: "rgba(255, 255, 255, 0.7)",
    });
  });

  it("frosts the card with the dark surface on a dark device", () => {
    expect(BIOMETRIC_BADGE.dark).toMatchObject({
      blurType: "dark",
      blurAmount: 5,
      surface: "rgba(0, 0, 0, 0.56)",
    });
  });

  it("keeps a surface color for platforms and modes without a live blur", () => {
    // Android has no backdrop blur and iOS drops it under reduce-transparency,
    // so both fall back to painting this flat.
    expect(BIOMETRIC_BADGE.light.surface).toBe("rgba(255, 255, 255, 0.7)");
    expect(BIOMETRIC_BADGE.dark.surface).toBe("rgba(0, 0, 0, 0.56)");
  });

  it("draws the glyph so it reads against its own frosted card", () => {
    // The badge sits over artwork, not over the page, so the glyph takes its
    // contrast from the frosted surface rather than from a text token. Both
    // come from the palette: Figma binds the light card to Colors/Base/1 and
    // the dark one to Colors/Lime/9.
    //
    // base[1] is the scheme's ink, so reading it from the light ramp is the
    // point -- base[0] there is the page white, which would erase the glyph
    // against its own light card.
    expect(BIOMETRIC_BADGE.light.glyph).toBe(colors.light.base[1]);
    expect(BIOMETRIC_BADGE.dark.glyph).toBe(colors.dark.lime[9]);
  });

  it("takes both glyphs from the palette rather than a raw hex", () => {
    // The dark glyph used to be a one-off mint that matched no ramp. Figma
    // moved it onto Lime/9, so nothing here needs spelling out by hand.
    expect(BIOMETRIC_BADGE.light.glyph).not.toBe("#A1F293");
    expect(BIOMETRIC_BADGE.dark.glyph).not.toBe("#A1F293");

    const source = fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "src",
        "components",
        "screens",
        "BiometricsEnableScreen",
        "BiometricsEnableScreen.tsx",
      ),
      "utf8",
    );

    expect(/glyph:\s*"#/.test(source)).toBe(false);
  });

  it("describes both schemes with the same keys", () => {
    expect(Object.keys(BIOMETRIC_BADGE.light).sort()).toEqual(
      Object.keys(BIOMETRIC_BADGE.dark).sort(),
    );
  });
});

import { getButtonColors } from "components/sds/Button/theme";
import { PALETTE, getTheme } from "config/theme";

/**
 * Values read from the Varial welcome screen in Figma:
 * light https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=650-6360
 * dark  https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=760-37023
 */
const FIGMA = {
  light: {
    textPrimary: "#171717",
    base0: "#ffffff",
    borderPrimary: "#e2e2e2",
    backgroundTertiary: "#f3f3f3",
    foregroundPrimary: "#8f8f8f",
    errorBackground: "#fffcfc",
    errorBorder: "#f9c6c6",
    errorText: "#cd2b31",
  },
  dark: {
    textPrimary: "#ededed",
    base0: "#000000",
    borderPrimary: "#343434",
    backgroundTertiary: "#232323",
    foregroundPrimary: "#707070",
    errorBackground: "#1f1315",
    errorBorder: "#671e22",
    errorText: "#ff6369",
  },
} as const;

const SCHEMES = ["light", "dark"] as const;

describe("getButtonColors", () => {
  describe("secondary is the filled call to action", () => {
    it("fills with the inverted surface and writes in the page color", () => {
      (["light", "dark"] as const).forEach((scheme) => {
        const { colors } = getTheme(scheme);

        expect(getButtonColors(scheme).secondary).toMatchObject({
          background: colors.text.primary,
          text: colors.base.primary,
        });
      });
    });

    it("matches the hex values in the Figma welcome screen", () => {
      expect(getButtonColors("light").secondary).toMatchObject({
        background: FIGMA.light.textPrimary,
        text: FIGMA.light.base0,
      });
      expect(getButtonColors("dark").secondary).toMatchObject({
        background: FIGMA.dark.textPrimary,
        text: FIGMA.dark.base0,
      });
    });

    it("carries no border, so the fill reads as one solid shape", () => {
      expect(getButtonColors("light").secondary.border).toBeUndefined();
      expect(getButtonColors("dark").secondary.border).toBeUndefined();
    });
  });

  describe("tertiary is the outlined call to action", () => {
    it("has no fill, so the page shows through", () => {
      // Previously a near-black fill that merely *looked* transparent on a dark
      // page; on a light page it rendered as a second solid black button.
      expect(getButtonColors("light").tertiary.background).toBe("transparent");
      expect(getButtonColors("dark").tertiary.background).toBe("transparent");
    });

    it("outlines and labels from the active scheme", () => {
      (["light", "dark"] as const).forEach((scheme) => {
        const { colors } = getTheme(scheme);

        expect(getButtonColors(scheme).tertiary).toMatchObject({
          border: colors.border.default,
          text: colors.text.primary,
        });
      });
    });

    it("matches the hex values in the Figma welcome screen", () => {
      expect(getButtonColors("light").tertiary).toMatchObject({
        border: FIGMA.light.borderPrimary,
        text: FIGMA.light.textPrimary,
      });
      expect(getButtonColors("dark").tertiary).toMatchObject({
        border: FIGMA.dark.borderPrimary,
        text: FIGMA.dark.textPrimary,
      });
    });
  });

  describe("primary carries the brand color", () => {
    it("labels in white, which the brand blue needs in both schemes", () => {
      // text.primary would be near-black on a light device, which is unreadable
      // on the blue fill; base.primary would be black on a dark one.
      SCHEMES.forEach((scheme) => {
        expect(getButtonColors(scheme).primary.text).toBe("#ffffff");
      });
    });

    it("fills with the brand color of the active scheme", () => {
      expect(getButtonColors("light").primary.background).toBe("#0050ff");
      expect(getButtonColors("dark").primary.background).toBe("#1677ff");
    });
  });

  describe("error is the tinted warning action", () => {
    it("matches the hex values in Figma for both schemes", () => {
      SCHEMES.forEach((scheme) => {
        expect(getButtonColors(scheme).error).toMatchObject({
          background: FIGMA[scheme].errorBackground,
          border: FIGMA[scheme].errorBorder,
          text: FIGMA[scheme].errorText,
        });
      });
    });

    it("reads its tint from the red ramp of the active scheme", () => {
      SCHEMES.forEach((scheme) => {
        expect(getButtonColors(scheme).error).toMatchObject({
          background: PALETTE[scheme].red["01"],
          border: PALETTE[scheme].red["06"],
          text: PALETTE[scheme].red["11"],
        });
      });
    });
  });

  describe("destructive is the solid warning action", () => {
    it("keeps the same solid red and white label in both schemes", () => {
      // Figma pins the label to literal white rather than Colors/Base/0, which
      // would flip to black on dark and vanish into the red fill.
      SCHEMES.forEach((scheme) => {
        expect(getButtonColors(scheme).destructive).toMatchObject({
          background: "#e5484d",
          text: "#ffffff",
        });
      });
    });

    it("carries no border", () => {
      SCHEMES.forEach((scheme) => {
        expect(getButtonColors(scheme).destructive.border).toBeUndefined();
      });
    });
  });

  describe("minimal is the bare text action", () => {
    it("has no fill and labels from the active scheme", () => {
      SCHEMES.forEach((scheme) => {
        expect(getButtonColors(scheme).minimal).toMatchObject({
          background: "transparent",
          text: FIGMA[scheme].textPrimary,
        });
      });
    });
  });

  describe("disabled mutes the button in the active scheme", () => {
    it("matches the hex values in Figma for both schemes", () => {
      SCHEMES.forEach((scheme) => {
        expect(getButtonColors(scheme).disabled).toMatchObject({
          background: FIGMA[scheme].backgroundTertiary,
          border: FIGMA[scheme].borderPrimary,
          text: FIGMA[scheme].foregroundPrimary,
        });
      });
    });

    it("reads from the theme rather than a pinned palette", () => {
      SCHEMES.forEach((scheme) => {
        const { colors } = getTheme(scheme);

        expect(getButtonColors(scheme).disabled).toMatchObject({
          background: colors.background.tertiary,
          border: colors.border.default,
          text: colors.foreground.primary,
        });
      });
    });
  });

  it("keeps every variant the Button component can render", () => {
    expect(Object.keys(getButtonColors("light")).sort()).toEqual(
      [
        "destructive",
        "disabled",
        "error",
        "minimal",
        "primary",
        "secondary",
        "tertiary",
      ].sort(),
    );
  });
});

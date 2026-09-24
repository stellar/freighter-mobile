/*
 * eslint-disable-next-line is not enough here: `import/order` wants Node
 * builtins in their own group first, while @trivago/prettier-plugin-sort-imports
 * (see .prettierrc) sorts every bare specifier into one alphabetical block. The
 * pre-commit hook runs prettier after eslint --fix, so prettier's order always
 * wins and the rule can never be satisfied -- the same conflict already affects
 * the `crypto` imports in src/services/auth.
 */
/* eslint-disable import/order */
import { colors } from "config/colors";
import {
  BACKDROP_COLOR,
  BACKDROP_OPACITY,
  SHADOW_COLOR,
  DEFAULT_COLOR_SCHEME,
  PALETTE,
  getTheme,
  getNotificationVariants,
} from "config/theme";
import fs from "fs";
import path from "path";

/**
 * Collects the nested key structure of an object, ignoring the values. Used to
 * assert that both palettes expose the same shades, which is what lets
 * `PALETTE[scheme].green["03"]` typecheck for a `scheme` only known at runtime.
 */
const shapeOf = (value: object): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(value).map(([ramp, shades]) => [
      ramp,
      Object.keys(shades as object).sort(),
    ]),
  );

describe("PALETTE", () => {
  it("exposes the same shades in both color schemes", () => {
    // The theme factories index the palette with a scheme resolved at runtime,
    // so a shade present in only one scheme is both a type error and a crash
    // waiting to happen the first time that scheme is selected.
    expect(shapeOf(PALETTE.light)).toEqual(shapeOf(PALETTE.dark));
  });
});

describe("getTheme", () => {
  it("resolves colors from the dark palette when given dark", () => {
    const theme = getTheme("dark");

    expect(theme.colors.background.default).toBe(PALETTE.dark.gray["01"]);
    expect(theme.colors.text.primary).toBe(PALETTE.dark.gray["12"]);
    expect(theme.colors.primary).toBe(PALETTE.dark.lilac["09"]);
  });

  it("resolves colors from the light palette when given light", () => {
    const theme = getTheme("light");

    expect(theme.colors.background.default).toBe(PALETTE.light.gray["01"]);
    expect(theme.colors.text.primary).toBe(PALETTE.light.gray["12"]);
    expect(theme.colors.primary).toBe(PALETTE.light.lilac["09"]);
  });

  it("produces a different background per color scheme", () => {
    expect(getTheme("light").colors.background.default).not.toBe(
      getTheme("dark").colors.background.default,
    );
  });

  it("keeps opacity constant across color schemes", () => {
    expect(getTheme("light").opacity).toEqual(getTheme("dark").opacity);
  });
});

describe("getNotificationVariants", () => {
  it("resolves variant colors from the dark palette when given dark", () => {
    const variants = getNotificationVariants("dark");

    expect(variants.success.backgroundColor).toBe(PALETTE.dark.green["03"]);
    expect(variants.error.backgroundColor).toBe(PALETTE.dark.red["02"]);
    expect(variants.warning.backgroundColor).toBe(PALETTE.dark.amber["03"]);
  });

  it("resolves variant colors from the light palette when given light", () => {
    const variants = getNotificationVariants("light");

    expect(variants.success.backgroundColor).toBe(PALETTE.light.green["03"]);
    expect(variants.error.backgroundColor).toBe(PALETTE.light.red["02"]);
    expect(variants.warning.backgroundColor).toBe(PALETTE.light.amber["03"]);
  });

  it("exposes the same variant names in both color schemes", () => {
    // `NotificationVariant` is derived from these keys, so they must not drift.
    expect(Object.keys(getNotificationVariants("light"))).toEqual(
      Object.keys(getNotificationVariants("dark")),
    );
  });
});

describe("DEFAULT_COLOR_SCHEME", () => {
  const SRC_DIR = path.join(__dirname, "..", "..", "src");
  const HARDCODED_FALLBACK = /colorScheme\s*\?\?\s*["'](?:light|dark)["']/;

  const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) return sourceFiles(entryPath);

      return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
    });

  it("is the only color scheme fallback in the app", () => {
    // Every consumer of `useColorScheme` has to decide what to do when the
    // device reports none. If they answer that question independently, some
    // resolve light and some dark and a single screen renders as a mix of both.
    const offenders = sourceFiles(SRC_DIR).filter((file) =>
      HARDCODED_FALLBACK.test(fs.readFileSync(file, "utf8")),
    );

    expect(offenders.map((file) => path.relative(SRC_DIR, file))).toEqual([]);
  });

  it("is light, matching Varial's light-first design", () => {
    expect(DEFAULT_COLOR_SCHEME).toBe("light");
  });

  it("names a scheme the palette actually defines", () => {
    expect(Object.keys(PALETTE)).toContain(DEFAULT_COLOR_SCHEME);
  });
});

describe("migrated areas", () => {
  const SRC_DIR = path.join(__dirname, "..", "..", "src");

  // Areas whose components resolve colors through useTheme / useColors. The
  // whole of src/ now qualifies, so nothing can reintroduce a dark-pinned color
  // into code that already follows the device.
  const MIGRATED = ["."];

  // Where the colors are defined. Every literal value in the app traces back
  // here, so these are the one place a raw hex is the point.
  const PALETTE_SOURCES = ["config/theme.ts", "config/colors.ts"];

  // TrendingCarousel draws its title over a fetched background image, so that
  // text stays light in both schemes or it disappears against the artwork.
  const DELIBERATELY_PINNED = ["components/TrendingCarousel.tsx"];

  // THEME and NOTIFICATION_VARIANTS no longer exist; their names stay in the
  // pattern so a dark-pinned alias cannot come back under either of them.
  const DARK_PINNED = /\bTHEME\b|\bPALETTE\.dark\b|\bNOTIFICATION_VARIANTS\b/;

  const filesUnder = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) return filesUnder(entryPath);

      return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
    });

  const migratedFiles = (): string[] =>
    MIGRATED.flatMap((area) => {
      const target = path.join(SRC_DIR, area);

      return fs.statSync(target).isDirectory() ? filesUnder(target) : [target];
    })
      .map((file) => path.relative(SRC_DIR, file))
      .filter(
        (file) => ![...PALETTE_SOURCES, ...DELIBERATELY_PINNED].includes(file),
      );

  it("hardcode no page background color", () => {
    // A raw hex slips past the check above. The page background is the one that
    // matters: baked into a gradient or a mask, it pins that artwork to a
    // single scheme while everything around it follows the device.
    const PAGE_BACKGROUNDS = /#161616|#fcfcfc/i;

    const offenders = migratedFiles().filter((file) =>
      PAGE_BACKGROUNDS.test(fs.readFileSync(path.join(SRC_DIR, file), "utf8")),
    );

    expect(offenders).toEqual([]);
  });

  it("colour no text with the non-inverting white", () => {
    // `white` is #ffffff in both schemes, which is right for content sitting on
    // a colored fill and wrong for text on a page: it reads on a dark surface
    // and disappears on a light one.
    const WHITE_TEXT = /<Text[^>]*color=\{themeColors\.white\}/;

    const offenders = migratedFiles().filter((file) =>
      WHITE_TEXT.test(fs.readFileSync(path.join(SRC_DIR, file), "utf8")),
    );

    expect(offenders).toEqual([]);
  });

  it("cast no shadow with an inverting color", () => {
    // A shadow is one surface falling on another: it is black in either scheme.
    // base[1] and the overlay ramp both invert, so they turn a shadow white on
    // a dark device, which reads as a glow rather than depth.
    const INVERTING_SHADOW =
      /shadow-?[Cc]olor\s*[:=]\s*\{?\s*\w*[Cc]olors\.(?:base\[1\]|overlay)/;

    const offenders = migratedFiles().filter((file) =>
      INVERTING_SHADOW.test(fs.readFileSync(path.join(SRC_DIR, file), "utf8")),
    );

    expect(offenders).toEqual([]);
  });

  it("read no dark-pinned color", () => {
    const offenders = migratedFiles().filter((file) =>
      DARK_PINNED.test(fs.readFileSync(path.join(SRC_DIR, file), "utf8")),
    );

    expect(offenders).toEqual([]);
  });
});

describe("lilac ramp", () => {
  /**
   * Varial Blue replaces lilac in place rather than arriving as a new ramp, so
   * everything already themed with lilac turns blue. Values read from the
   * Varial Figma file:
   * light https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=1769-76771
   * dark  https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=1769-76734
   */
  const VARIAL_BLUE: Record<string, Record<string, string>> = {
    light: {
      1: "#fcfdff",
      2: "#f5faff",
      3: "#eef4ff",
      4: "#daeaff",
      5: "#c8e0ff",
      6: "#a8c6ff",
      7: "#98bfff",
      8: "#73a5ff",
      9: "#0050ff",
      10: "#0246df",
      11: "#0f53ec",
      12: "#0e2b6c",
    },
    dark: {
      1: "#0e1623",
      2: "#101a29",
      3: "#0d264d",
      4: "#092f69",
      5: "#0f3b7c",
      6: "#19478d",
      7: "#2255a3",
      8: "#2865c1",
      9: "#1677ff",
      10: "#0069f0",
      11: "#7eb6ff",
      12: "#cde3ff",
    },
  };

  /** PALETTE writes single digits as "01".."09"; normalise so the ramps compare. */
  const normalise = (ramp: Record<string, string>): Record<string, string> =>
    Object.fromEntries(
      Object.entries(ramp).map(([shade, value]) => [
        String(Number(shade)),
        value,
      ]),
    );

  /** global.css keeps light under :root and dark under a prefers-color-scheme block. */
  const cssRamp = (scheme: "light" | "dark"): Record<string, string> => {
    const css = fs.readFileSync(
      path.join(__dirname, "..", "..", "global.css"),
      "utf8",
    );
    const split = css.indexOf("@media (prefers-color-scheme: dark)");
    const block = scheme === "light" ? css.slice(0, split) : css.slice(split);

    return Object.fromEntries(
      [...block.matchAll(/--color-lilac-(\d+):\s*(#[0-9a-f]{6})/gi)].map(
        (match) => [match[1], match[2]],
      ),
    );
  };

  (["light", "dark"] as const).forEach((scheme) => {
    it(`is Varial Blue in config/theme.ts for ${scheme}`, () => {
      expect(normalise(PALETTE[scheme].lilac)).toEqual(VARIAL_BLUE[scheme]);
    });

    it(`is Varial Blue in config/colors.ts for ${scheme}`, () => {
      expect(normalise(colors[scheme].lilac)).toEqual(VARIAL_BLUE[scheme]);
    });

    it(`is Varial Blue in global.css for ${scheme}`, () => {
      expect(cssRamp(scheme)).toEqual(VARIAL_BLUE[scheme]);
    });
  });

  it("is what the primary token resolves to", () => {
    // theme.ts derives `primary` from the ramp, colors.ts spells it out. Left
    // to drift, `theme.colors.primary` and `themeColors.primary` render as two
    // different colors for the same token.
    (["light", "dark"] as const).forEach((scheme) => {
      expect(colors[scheme].primary).toBe(colors[scheme].lilac[9]);
      expect(colors[scheme].primary).toBe(PALETTE[scheme].lilac["09"]);
    });
  });

  it("keeps all three sources in step", () => {
    // Nativewind classes read global.css, useColors reads colors.ts and
    // useTheme reads theme.ts. A value changed in one of them and not the
    // others shows up as two shades of the same token on one screen.
    (["light", "dark"] as const).forEach((scheme) => {
      expect(normalise(colors[scheme].lilac)).toEqual(
        normalise(PALETTE[scheme].lilac),
      );
      expect(cssRamp(scheme)).toEqual(normalise(PALETTE[scheme].lilac));
    });
  });
});

describe("android window background", () => {
  // Under Android 15+ enforced edge-to-edge the system bars are transparent and
  // show the window background, so this resource is what the status and
  // navigation strips actually paint. It has to track the page color, and it
  // needs a night qualifier or it cannot follow the device at all.
  const RES = path.join(
    __dirname,
    "..",
    "..",
    "android",
    "app",
    "src",
    "main",
    "res",
  );

  const appBackground = (dir: string): string | undefined => {
    const file = path.join(RES, dir, "colors.xml");

    if (!fs.existsSync(file)) return undefined;

    return fs
      .readFileSync(file, "utf8")
      .match(/name="app_background">(#[0-9a-f]{6})</i)?.[1]
      ?.toLowerCase();
  };

  it("matches the light page color", () => {
    expect(appBackground("values")).toBe(PALETTE.light.base["00"]);
  });

  it("matches the dark page color under the night qualifier", () => {
    expect(appBackground("values-night")).toBe(PALETTE.dark.base["00"]);
  });
});

describe("splash screen dark mode", () => {
  // react-native-bootsplash only generates the light assets: its dark mode
  // options are a paid add-on. scripts/generate-splashscreen-dark.js derives
  // the rest and runs as part of `yarn generate-splashscreen`, because a
  // regeneration rewrites the iOS Contents.json and renames the asset catalogs
  // after the source's content hash. Without these assertions, dark mode could
  // disappear on the next regeneration without any error.
  const ROOT = path.join(__dirname, "..", "..");
  const ANDROID_RES = path.join(ROOT, "android", "app", "src", "main", "res");
  const DENSITIES = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];

  const catalog = (pattern: string): string => {
    const [dir] = fs
      .readdirSync(path.dirname(path.join(ROOT, pattern)))
      .filter((name) => name.startsWith(path.basename(pattern)));

    return path.join(path.dirname(path.join(ROOT, pattern)), dir);
  };

  const readJson = (
    file: string,
  ): Record<string, { appearances?: unknown }[]> =>
    JSON.parse(fs.readFileSync(file, "utf8")) as Record<
      string,
      { appearances?: unknown }[]
    >;

  it("has an android night logo at every density", () => {
    const missing = DENSITIES.filter(
      (density) =>
        !fs.existsSync(
          path.join(
            ANDROID_RES,
            `drawable-night-${density}`,
            "bootsplash_logo.png",
          ),
        ),
    );

    expect(missing).toEqual([]);
  });

  it("has an android night background matching the dark page color", () => {
    const xml = fs.readFileSync(
      path.join(ANDROID_RES, "values-night", "colors.xml"),
      "utf8",
    );

    expect(
      xml.match(/name="bootsplash_background">(#[0-9a-f]{6})</i)?.[1],
    ).toBe(PALETTE.dark.base["00"]);
  });

  it("pairs every ios logo scale with a dark one", () => {
    const dir = catalog("ios/freighter-mobile/Images.xcassets/BootSplashLogo-");
    const { images } = readJson(path.join(dir, "Contents.json")) as unknown as {
      images: { appearances?: unknown; filename: string }[];
    };
    const light = images.filter((image) => !image.appearances);
    const dark = images.filter((image) => image.appearances);

    expect(dark).toHaveLength(light.length);
    expect(
      dark.filter((image) => !fs.existsSync(path.join(dir, image.filename))),
    ).toEqual([]);
  });

  it("gives the ios background a dark appearance", () => {
    const dir = catalog(
      "ios/freighter-mobile/Colors.xcassets/BootSplashBackground-",
    );
    const manifest = readJson(path.join(dir, "Contents.json")) as unknown as {
      colors: { appearances?: unknown }[];
    };

    expect(manifest.colors.filter((color) => color.appearances)).toHaveLength(
      1,
    );
  });
});

describe("colors that do not follow the scheme", () => {
  it("dims a page to the opacity Figma asks for", () => {
    // https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=694-19010
    expect(BACKDROP_OPACITY).toBe(0.6);
    expect(BACKDROP_COLOR).toBe("rgba(0, 0, 0, 0.6)");
  });

  it("keeps backdrops and shadows black rather than inverting them", () => {
    // The overlay ramp is the trap here: it is black on light and white on
    // dark, so a backdrop drawn with it washes the page out instead of dimming
    // it, and a shadow becomes a glow.
    expect(BACKDROP_COLOR.startsWith("rgba(0, 0, 0")).toBe(true);
    expect(SHADOW_COLOR).toBe("#000000");
    expect(colors.dark.overlay[6].startsWith("rgba(255")).toBe(true);
  });
});

describe("palette copies", () => {
  type Ramps = Record<string, Record<string, string>>;

  /** Whitespace and case differ between the sources; the color does not. */
  const tidy = (value: string): string =>
    value.replace(/\s+/g, "").toLowerCase();

  /**
   * The ramps in colors.ts are the numerically keyed groups. Semantic groups
   * such as `status` or `background` are derived from them, not copies.
   */
  const ramps = (scheme: "light" | "dark"): Ramps =>
    Object.fromEntries(
      Object.entries(colors[scheme]).filter(
        ([, value]) =>
          typeof value === "object" &&
          Object.keys(value).every((shade) => /^\d+$/.test(shade)),
      ),
    ) as Ramps;

  /** global.css keeps light under :root and dark under a prefers-color-scheme block. */
  const cssRamps = (scheme: "light" | "dark"): Ramps => {
    const css = fs.readFileSync(
      path.join(__dirname, "..", "..", "global.css"),
      "utf8",
    );
    const split = css.indexOf("@media (prefers-color-scheme: dark)");
    const block = scheme === "light" ? css.slice(0, split) : css.slice(split);
    const found: Ramps = {};

    [...block.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)].forEach(
      ([, ramp, shade, value]) => {
        (found[ramp] ??= {})[shade] = tidy(value);
      },
    );

    return found;
  };

  (["light", "dark"] as const).forEach((scheme) => {
    it(`agree between config/theme.ts and config/colors.ts for ${scheme}`, () => {
      // PALETTE is a partial copy of colors.ts. Every shade it does carry has to
      // match, or the same token read through useTheme and through useColors
      // renders as two different colors on one screen.
      const full = ramps(scheme);
      const mismatches = Object.entries(PALETTE[scheme] as Ramps).flatMap(
        ([ramp, shades]) =>
          Object.entries(shades)
            .filter(
              ([shade, value]) =>
                tidy(full[ramp]?.[String(Number(shade))] ?? "missing") !==
                tidy(value),
            )
            .map(
              ([shade, value]) =>
                `${ramp}.${shade}: theme.ts ${value}, colors.ts ${
                  full[ramp]?.[String(Number(shade))] ?? "missing"
                }`,
            ),
      );

      expect(mismatches).toEqual([]);
    });

    it(`agree between config/colors.ts and global.css for ${scheme}`, () => {
      // global.css is the nativewind copy of the same ramps, kept by hand. A
      // shade that drifts paints one color through a className and another
      // through the matching themeColors value.
      const css = cssRamps(scheme);
      const mismatches = Object.entries(ramps(scheme)).flatMap(
        ([ramp, shades]) =>
          Object.entries(shades)
            .filter(([shade, value]) => css[ramp]?.[shade] !== tidy(value))
            .map(
              ([shade, value]) =>
                `${ramp}.${shade}: colors.ts ${value}, global.css ${
                  css[ramp]?.[shade] ?? "missing"
                }`,
            ),
      );

      expect(mismatches).toEqual([]);
    });
  });
});

describe("semantic tokens", () => {
  /**
   * getTheme() and colors.ts spell some tokens differently -- `background.default`
   * against `background.primary`, `base.primary` against `base[0]` -- but a token
   * both of them define has to resolve to one color. They are read side by side,
   * a few components read both, so a disagreement paints one token in two shades
   * on a single screen.
   *
   * Tokens only one side defines are out of scope: getTheme's `tab` and `list`
   * groups, colors.ts's numeric ramps. There is nothing for those to disagree
   * with.
   */
  const shared = (scheme: "light" | "dark") => {
    const theme = getTheme(scheme).colors;
    const palette = colors[scheme];

    return [
      ["primary", theme.primary, palette.primary],
      ["secondary", theme.secondary, palette.secondary],
      [
        "background.default / background.primary",
        theme.background.default,
        palette.background.primary,
      ],
      [
        "background.secondary",
        theme.background.secondary,
        palette.background.secondary,
      ],
      [
        "background.tertiary",
        theme.background.tertiary,
        palette.background.tertiary,
      ],
      [
        "foreground.primary",
        theme.foreground.primary,
        palette.foreground.primary,
      ],
      [
        "foreground.secondary",
        theme.foreground.secondary,
        palette.foreground.secondary,
      ],
      ["text.primary", theme.text.primary, palette.text.primary],
      ["text.secondary", theme.text.secondary, palette.text.secondary],
      ["status.success", theme.status.success, palette.status.success],
      ["status.error", theme.status.error, palette.status.error],
      ["status.warning", theme.status.warning, palette.status.warning],
      [
        "border.default / border.primary",
        theme.border.default,
        palette.border.primary,
      ],
      ["base.primary / base[0]", theme.base.primary, palette.base[0]],
      ["base.secondary / base[1]", theme.base.secondary, palette.base[1]],
    ] as const;
  };

  (["light", "dark"] as const).forEach((scheme) => {
    it(`resolve to one color in both theme systems for ${scheme}`, () => {
      const mismatches = shared(scheme)
        .filter(([, fromTheme, fromColors]) => fromTheme !== fromColors)
        .map(
          ([token, fromTheme, fromColors]) =>
            `${token}: getTheme ${fromTheme}, colors.ts ${fromColors}`,
        );

      expect(mismatches).toEqual([]);
    });
  });
});

describe("android status bar", () => {
  it("is declared translucent so the page, not the window, paints behind it", () => {
    // On a cold JS start React Native's StatusBar syncs its defaults to the
    // native module, and with RN's edge-to-edge flag off `hidden: false` runs
    // statusBarShow(), which calls setDecorFitsSystemWindows(true). That undoes
    // keyboard-controller's edge-to-edge: AppCompat insets the content by the
    // status bar height and the strip is painted by the window instead of the
    // page. The window's color is fixed at creation and uiMode is a handled
    // configChange, so a theme switch repaints the page but not the strip.
    //
    // `translucent` makes RN zero the top inset in its own decor listener, so
    // the re-fit is a no-op and the page keeps painting under the bar.
    const app = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "components", "App.tsx"),
      "utf8",
    );

    expect(/<StatusBar\b[\s\S]*?\/>/.exec(app)?.[0]).toMatch(/\btranslucent\b/);
  });
});

describe("history refresh indicator", () => {
  it("lets the page surface show through rather than painting its own", () => {
    // The indicator is a sibling above the list inside BaseLayout, which paints
    // base 0. Giving it a background of its own means picking a token that has
    // to agree with the page forever: background-primary is gray 1, one step
    // off base 0 -- invisible on light (#fcfcfc on #ffffff) and a grey band on
    // dark (#161616 on #000000). Painting nothing cannot drift.
    const list = fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "..",
        "src",
        "components",
        "screens",
        "HistoryScreen",
        "HistoryList.tsx",
      ),
      "utf8",
    );
    const indicator =
      /const CustomRefreshIndicator[\s\S]*?\[isNavigationRefresh\]\);/.exec(
        list,
      )?.[0] ?? "";

    expect(indicator).not.toBe("");
    expect(indicator).not.toMatch(/\bbg-[a-z0-9-]+/);
  });
});

describe("svg assets", () => {
  const ASSETS = path.join(__dirname, "..", "..", "src", "assets");

  /**
   * Marks that carry their own background. The white in these is a glyph on a
   * brand-colored disc, so it is opaque to the page behind it and must not
   * follow the scheme.
   */
  const OWN_BACKGROUND = ["logos/usdc-logo.svg"];

  const svgFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) return svgFiles(entryPath);

      return entry.name.endsWith(".svg") ? [entryPath] : [];
    });

  it("tint their glyphs rather than hardcoding a light fill", () => {
    // A bare glyph filled white is invisible on a light page. `currentColor`
    // lets the caller pass a theme color, the way every icon in src/assets/icons
    // already works. A clipPath's fill is a mask, never painted, so it does not
    // count.
    const offenders = svgFiles(ASSETS)
      .map((file) => [
        path.relative(ASSETS, file),
        fs
          .readFileSync(file, "utf8")
          .replace(/<clipPath[\s\S]*?<\/clipPath>/g, ""),
      ])
      .filter(
        ([name, body]) =>
          !OWN_BACKGROUND.includes(name) &&
          /fill="(?:white|#fff|#ffffff)"/i.test(body),
      )
      .map(([name]) => name);

    expect(offenders).toEqual([]);
  });
});

describe("transaction detail sheets", () => {
  const SRC = path.join(__dirname, "..", "..", "src");

  /** The sheets that show a completed transaction: history, send, swap. */
  const SHEETS = [
    "components/screens/HistoryScreen/TransactionDetailsBottomSheetCustomContent.tsx",
    "components/TransactionDetailsBottomSheet.tsx",
    "components/screens/SwapScreen/components/SwapTransactionDetailsBottomSheet.tsx",
  ];

  it("card surface matches the List they sit beside", () => {
    // Each sheet stacks a hand-rolled summary card above a <List variant=
    // "secondary">. The two are one visual group, so the card has to use the
    // surface that variant paints -- and because all three sheets use the same
    // variant, matching it also keeps the three screens consistent with each
    // other.
    const list = fs.readFileSync(path.join(SRC, "components/List.tsx"), "utf8");
    const surface = /case "secondary":\s*\n\s*return "(bg-[a-z-]+)/.exec(
      list,
    )?.[1];

    expect(surface).toBe("bg-background-tertiary");

    const offenders = SHEETS.flatMap((sheet) =>
      [
        ...fs
          .readFileSync(path.join(SRC, sheet), "utf8")
          .matchAll(
            /className="(bg-background-[a-z]+ rounded-\[16px\][^"]*)"/g,
          ),
      ]
        .filter((match) => !match[1].startsWith(`${surface} `))
        .map((match) => `${sheet}: ${match[1]}`),
    );

    expect(offenders).toEqual([]);
  });
});

describe("tailwind color classes", () => {
  const SRC = path.join(__dirname, "..", "..", "src");

  /**
   * Tailwind silently drops a utility naming a color it does not know, so a
   * typo or a stock-palette shade renders as nothing at all rather than
   * failing. `bg-amber-50` is the giveaway: this config's ramps run 1-12, so
   * the stock 50/200/500 shades paint nothing.
   */
  const UTILITIES =
    "bg|text|border|from|to|via|fill|stroke|shadow|ring|divide|placeholder|caret|accent|outline";

  /**
   * `text-base` is Tailwind's font size, and fontSize wins over the `base`
   * color family for that exact name.
   */
  const NOT_A_COLOR = ["text-base"];

  /** Families and shades the config actually defines. */
  const palette = (): {
    scalars: Set<string>;
    ramps: Map<string, Set<string>>;
  } => {
    const config = fs.readFileSync(
      path.join(__dirname, "..", "..", "tailwind.config.ts"),
      "utf8",
    );
    const block = /colors:\s*\{([\s\S]*?)\n {6}\},/.exec(config)?.[1] ?? "";
    const scalars = new Set<string>();
    const ramps = new Map<string, Set<string>>();
    let current: string | null = null;

    block.split("\n").forEach((line) => {
      const ramp = /^ {8}([a-zA-Z0-9]+):\s*\{/.exec(line);
      const scalar = /^ {8}([a-zA-Z0-9]+):\s*"/.exec(line);
      const shade = /^ {10}([a-zA-Z0-9]+):/.exec(line);

      if (ramp) {
        [, current] = ramp;
        ramps.set(current, new Set());
      } else if (scalar) {
        scalars.add(scalar[1]);
        current = null;
      } else if (shade && current) {
        ramps.get(current)?.add(shade[1]);
      }
    });

    return { scalars, ramps };
  };

  const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) return sourceFiles(entryPath);

      return entry.name.endsWith(".tsx") ? [entryPath] : [];
    });

  it("resolve to a color the config defines", () => {
    const { scalars, ramps } = palette();
    const pattern = new RegExp(
      `\\b(?:${UTILITIES})-([a-zA-Z][a-zA-Z0-9]*)(?:-([a-zA-Z0-9]+))?\\b`,
      "g",
    );

    const offenders = sourceFiles(SRC).flatMap((file) => {
      // Comments name classes they never render. A class assembled around an
      // interpolation is dropped whole, prefix included: only half its name is
      // in the source, so this check cannot judge it -- note that Tailwind
      // extracts classes by scanning text too, so such a class only exists if
      // it is also written out literally somewhere.
      const source = fs
        .readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "")
        .replace(/[\w-]*\$\{[^}]*\}[\w-]*/g, "");

      return [...source.matchAll(pattern)]
        .filter(([whole, family, shade]) => {
          if (NOT_A_COLOR.includes(whole)) return false;
          if (ramps.has(family))
            return !shade || !ramps.get(family)?.has(shade);

          return scalars.has(family) && Boolean(shade);
        })
        .map(([whole]) => `${path.relative(SRC, file)}: ${whole}`);
    });

    expect([...new Set(offenders)]).toEqual([]);
  });
});

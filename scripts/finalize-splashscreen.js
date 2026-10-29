/**
 * Everything the launch screen needs that react-native-bootsplash cannot
 * express, applied to what it has just generated.
 *
 * Run as part of `yarn generate-splashscreen`, never on its own. Regenerating
 * rewrites the iOS Contents.json and renames the asset catalogs after the
 * source's content hash, so any of this left as a manual step would disappear
 * on the next regeneration without an error to show for it.
 *
 * Three jobs:
 *
 * 1. Dark iOS assets. bootsplash can derive these through --dark-logo /
 *    --dark-background, but those options are a paid add-on and exit(1)
 *    without a license key. The two Figma splash screens differ only in
 *    colour, so the dark assets are the light ones recoloured: the mark moves
 *    from Blue/09 light to Blue/09 dark and the wordmark from black to white.
 *    Antialiasing lives in the alpha channel, so remapping RGB and leaving
 *    alpha alone is lossless and keeps the geometry identical.
 *
 * 2. A blank logo. The launch screen is a plain page-colour screen; the JS
 *    SplashAnimation owns the sequence from the first frame it can draw. The
 *    Android drawables are replaced with transparent images of the same size
 *    and the iOS storyboard's image view is removed, leaving the background
 *    colour — which already follows the device — to paint the screen.
 *
 * 3. Privacy shield artwork. The shield covers wallet contents in the app
 *    switcher. It used to draw the splash's own logo, which blanking would
 *    have emptied, so it carries its own copy of the lockup in light and dark.
 *
 * light https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=650-8853
 * dark  https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=760-37045
 */
const fs = require("fs");
const path = require("path");
const glob = require("glob");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const ANDROID_RES = path.join(ROOT, "android/app/src/main/res");
const DENSITIES = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];
const DENSITY_SCALE = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** Lockup width in dp, matching the constraint the iOS shield lays out with. */
const SHIELD_LOGO_DP = 128;
const SHIELD_IOS_SCALES = [1, 2, 3];

const SPLASH_SOURCE = path.join(ROOT, "splashscreen/varial-splash-logo.png");
const SPLASH_SOURCE_DARK = path.join(
  ROOT,
  "splashscreen/varial-splash-logo-dark.png",
);
const SHIELD_IMAGESET = path.join(
  ROOT,
  "ios/freighter-mobile/Images.xcassets/PrivacyShieldLogo.imageset",
);

const MARK_DARK = [0x16, 0x77, 0xff]; // Blue/09 dark
const WORD_DARK = [0xff, 0xff, 0xff];
const DARK_APPEARANCE = [{ appearance: "luminosity", value: "dark" }];

/** Repaint the mark and the wordmark, leaving every alpha value untouched. */
const recolor = async (from, to) => {
  const { data, info } = await sharp(from)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] === 0) continue;
    // the mark is the only blue in the asset; everything else is the wordmark
    const target = data[i + 2] > data[i] + 40 ? MARK_DARK : WORD_DARK;
    [data[i], data[i + 1], data[i + 2]] = target;
  }

  const { width, height, channels } = info;

  await sharp(data, { raw: { width, height, channels } }).png().toFile(to);
};

/**
 * Insert "-dark" before any @2x/@3x suffix rather than after it. Inside an
 * asset catalog the scale comes from Contents.json, not the name, so either
 * works -- but keeping the scale as the last token matches every other asset
 * in the project and does not read as though it might be parsed.
 */
const darkName = (filename) =>
  filename.replace(/(@[\d.,]+x)?\.png$/, "-dark$1.png");

const writeJson = (file, value) =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const deriveIosDarkAssets = async () => {
  const [imageset] = glob.sync(
    "ios/*/Images.xcassets/BootSplashLogo-*.imageset",
    { cwd: ROOT, absolute: true },
  );
  const [colorset] = glob.sync(
    "ios/*/Colors.xcassets/BootSplashBackground-*.colorset",
    { cwd: ROOT, absolute: true },
  );

  if (!imageset || !colorset) {
    console.log("  ios: no bootsplash asset catalogs found, skipping");

    return;
  }

  const contents = path.join(imageset, "Contents.json");
  const manifest = JSON.parse(fs.readFileSync(contents, "utf8"));
  // drop any dark entries from a previous run before deriving them again, and
  // the files with them: a rename would otherwise leave orphans behind
  const light = manifest.images.filter((image) => !image.appearances);

  manifest.images
    .filter((image) => image.appearances)
    .forEach((image) =>
      fs.rmSync(path.join(imageset, image.filename), { force: true }),
    );

  await Promise.all(
    light.map((image) =>
      recolor(
        path.join(imageset, image.filename),
        path.join(imageset, darkName(image.filename)),
      ),
    ),
  );

  writeJson(contents, {
    ...manifest,
    images: [
      ...light,
      ...light.map((image) => ({
        ...image,
        appearances: DARK_APPEARANCE,
        filename: darkName(image.filename),
      })),
    ],
  });

  const colorContents = path.join(colorset, "Contents.json");
  const colors = JSON.parse(fs.readFileSync(colorContents, "utf8"));
  const base = colors.colors.filter((color) => !color.appearances);

  writeJson(colorContents, {
    ...colors,
    colors: [
      ...base,
      {
        idiom: "universal",
        appearances: DARK_APPEARANCE,
        color: {
          "color-space": "srgb",
          components: {
            red: "0.00000000000000",
            green: "0.00000000000000",
            blue: "0.00000000000000",
            alpha: "1.000",
          },
        },
      },
    ],
  });

  console.log(`  ios: ${light.length} dark images + dark background`);
};

/**
 * Replace the generated Android logos with transparent images of the same
 * size. No night variants are written: a blank logo is blank in either
 * scheme, so Android falls back to these.
 */
const blankAndroidLogo = async () => {
  const blanked = await Promise.all(
    DENSITIES.map(async (density) => {
      const file = path.join(
        ANDROID_RES,
        `drawable-${density}`,
        "bootsplash_logo.png",
      );

      if (!fs.existsSync(file)) return false;

      const { width, height } = await sharp(file).metadata();

      await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .png()
        .toFile(file);

      // a night variant would only repeat this, and a stale one from an
      // earlier run would still be carrying a logo
      fs.rmSync(
        path.join(
          ANDROID_RES,
          `drawable-night-${density}`,
          "bootsplash_logo.png",
        ),
        { force: true },
      );

      return true;
    }),
  );

  console.log(`  android: ${blanked.filter(Boolean).length} logos blanked`);
};

/**
 * Strip the logo from the generated storyboard, leaving the background colour.
 * Throws rather than passing silently: a storyboard that still carries the
 * image view would show the lockup before the JS animation starts, which is
 * subtle enough on a fast launch to reach a release unnoticed.
 */
const blankIosStoryboard = () => {
  const [storyboard] = glob.sync("ios/*/BootSplash.storyboard", {
    cwd: ROOT,
    absolute: true,
  });

  if (!storyboard) {
    console.log("  ios: no BootSplash.storyboard found, skipping");

    return;
  }

  const before = fs.readFileSync(storyboard, "utf8");
  const after = before
    .replace(/\s*<subviews>[\s\S]*?<\/subviews>/, "")
    .replace(/\s*<constraints>[\s\S]*?<\/constraints>/, "")
    .replace(/\s*<image name="BootSplashLogo-[^"]*"[^/]*\/>/, "");

  if (/imageView|<image name="BootSplashLogo/.test(after)) {
    throw new Error(
      "BootSplash.storyboard still references the logo after blanking; the " +
        "generated markup has changed shape and this script needs updating.",
    );
  }

  fs.writeFileSync(storyboard, after);
  console.log("  ios: storyboard logo removed");
};

/** The shield's own copy of the lockup, in both schemes, on both platforms. */
const generateShieldArtwork = async () => {
  if (!fs.existsSync(SPLASH_SOURCE) || !fs.existsSync(SPLASH_SOURCE_DARK)) {
    throw new Error(
      `Missing splash artwork: expected ${SPLASH_SOURCE} and ${SPLASH_SOURCE_DARK}`,
    );
  }

  await Promise.all(
    DENSITIES.map(async (density) => {
      const width = Math.round(SHIELD_LOGO_DP * DENSITY_SCALE[density]);

      return Promise.all(
        [
          [`drawable-${density}`, SPLASH_SOURCE],
          [`drawable-night-${density}`, SPLASH_SOURCE_DARK],
        ].map(async ([dir, source]) => {
          fs.mkdirSync(path.join(ANDROID_RES, dir), { recursive: true });

          return sharp(source)
            .resize({ width })
            .png()
            .toFile(path.join(ANDROID_RES, dir, "privacy_shield_logo.png"));
        }),
      );
    }),
  );

  fs.mkdirSync(SHIELD_IMAGESET, { recursive: true });

  const images = [];

  await Promise.all(
    SHIELD_IOS_SCALES.flatMap((scale) =>
      [
        ["privacy-shield-logo", SPLASH_SOURCE, undefined],
        ["privacy-shield-logo-dark", SPLASH_SOURCE_DARK, DARK_APPEARANCE],
      ].map(async ([stem, source, appearances]) => {
        const filename = `${stem}${scale === 1 ? "" : `@${scale}x`}.png`;

        await sharp(source)
          .resize({ width: SHIELD_LOGO_DP * scale })
          .png()
          .toFile(path.join(SHIELD_IMAGESET, filename));

        images.push({
          idiom: "universal",
          filename,
          scale: `${scale}x`,
          ...(appearances ? { appearances } : {}),
        });
      }),
    ),
  );

  // sort so the file does not churn on the order promises happen to settle in
  images.sort(
    (a, b) =>
      a.scale.localeCompare(b.scale) || a.filename.localeCompare(b.filename),
  );

  writeJson(path.join(SHIELD_IMAGESET, "Contents.json"), {
    images,
    info: { author: "xcode", version: 1 },
  });

  console.log(
    `  shield: ${DENSITIES.length * 2} android drawables + ${images.length} ios images`,
  );
};

(async () => {
  console.log("Finalizing splash screen assets");
  await deriveIosDarkAssets();
  await blankAndroidLogo();
  blankIosStoryboard();
  await generateShieldArtwork();
  console.log("Done");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

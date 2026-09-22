/* eslint-disable no-console, @typescript-eslint/no-var-requires, global-require */
/**
 * Derives the dark-mode splash assets from the light ones react-native-bootsplash
 * just generated.
 *
 * bootsplash can do this itself through --dark-logo / --dark-background, but
 * those options are a paid add-on and exit(1) without a license key. The two
 * Figma splash screens differ only in color, so the dark assets are the light
 * ones recolored: the mark moves from Blue/09 light to Blue/09 dark, and the
 * wordmark from black to white. Antialiasing lives in the alpha channel, so
 * remapping RGB and leaving alpha alone is lossless and keeps the geometry
 * identical to the light variants.
 *
 * Run as part of `yarn generate-splashscreen`, because regenerating rewrites the
 * iOS Contents.json and renames the asset catalogs after the source's content
 * hash. Left as a manual step, dark mode would disappear on the next
 * regeneration without any error.
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

const generateAndroid = async () => {
  await Promise.all(
    DENSITIES.map(async (density) => {
      const from = path.join(
        ANDROID_RES,
        `drawable-${density}`,
        "bootsplash_logo.png",
      );

      if (!fs.existsSync(from)) return;

      const dir = path.join(ANDROID_RES, `drawable-night-${density}`);
      fs.mkdirSync(dir, { recursive: true });
      await recolor(from, path.join(dir, "bootsplash_logo.png"));
    }),
  );

  console.log(`  android: ${DENSITIES.length} drawable-night densities`);
};

const generateIos = async () => {
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

(async () => {
  console.log("Deriving dark-mode splash assets");
  await generateAndroid();
  await generateIos();
  console.log("Done");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

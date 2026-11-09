import { images } from "assets/images";
import React from "react";
import { Image } from "react-native";

/**
 * The sparkle image's canvas, in Figma points: Figma's export of the sparkle
 * with its glow (29.68 × 30.84) from the same origin, rounded up to whole
 * points.
 */
export const SPARKLE_GRAPHIC_SIZE = { width: 30, height: 31 };

interface SparkleGraphicProps {
  isLight: boolean;
  width: number;
  height: number;
  testID?: string;
}

/**
 * The wallet setup screen's sparkle with its glow: Figma's SVG export for
 * "Group 19" (?node-id=760-37099 dark, 2091-41732 light), rendered ahead of
 * time to PNGs at 1x, 2x and 3x.
 *
 * It's an image because the glow is a filter. Drawn as an SVG filter, iOS
 * took about a second to set Core Image up the first time, which froze the
 * screen just as it appeared and swallowed its fade-in. An image draws at
 * once, and looks the same on iOS and Android.
 *
 * To redraw it: export the sparkle as SVG from Figma, delete the
 * `feComposite operator="out"` step, and screenshot it in headless Chrome
 * with a transparent background at device scale 1, 2 and 3, cropped to
 * 30 × 31 points from the top left. That step cuts the glow out under the
 * shape with a hard-edged alpha, which leaves a thin rim along the shape's
 * anti-aliased edge. The shape is opaque, so the glow can sit fully beneath
 * it.
 */
export const SparkleGraphic: React.FC<SparkleGraphicProps> = ({
  isLight,
  width,
  height,
  testID,
}) => (
  <Image
    testID={testID}
    source={
      isLight ? images.walletSetupSparkleLight : images.walletSetupSparkleDark
    }
    style={{ width, height }}
    resizeMode="stretch"
    // The screen fades in on its own; Android would fade the image in again.
    fadeDuration={0}
  />
);

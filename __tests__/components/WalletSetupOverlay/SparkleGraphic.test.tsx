import { render } from "@testing-library/react-native";
import {
  SPARKLE_GRAPHIC_SIZE,
  SparkleGraphic,
} from "components/WalletSetupOverlay/SparkleGraphic";
import React from "react";
import { Image } from "react-native";
import Svg from "react-native-svg";

const renderGraphic = (isLight: boolean) =>
  render(
    <SparkleGraphic
      isLight={isLight}
      width={SPARKLE_GRAPHIC_SIZE.width * 2}
      height={SPARKLE_GRAPHIC_SIZE.height * 2}
    />,
  );

/** The file an image shows: Jest stands each asset in with its path. */
const fileOf = (screen: ReturnType<typeof renderGraphic>) =>
  (screen.UNSAFE_getByType(Image).props.source as { testUri: string }).testUri;

describe("SparkleGraphic", () => {
  it("draws the dark sparkle, its glow included", () => {
    expect(fileOf(renderGraphic(false))).toMatch(
      /wallet-setup-sparkle-dark\.png$/,
    );
  });

  it("draws the light sparkle in light mode", () => {
    expect(fileOf(renderGraphic(true))).toMatch(
      /wallet-setup-sparkle-light\.png$/,
    );
  });

  it("fills the size it's given", () => {
    const screen = renderGraphic(false);

    expect(screen.UNSAFE_getByType(Image).props.style).toMatchObject({
      width: SPARKLE_GRAPHIC_SIZE.width * 2,
      height: SPARKLE_GRAPHIC_SIZE.height * 2,
    });
  });

  // Drawn as an SVG filter, the glow took iOS about a second to set up the
  // first time, which froze the screen just as it appeared.
  it("draws no SVG", () => {
    expect(renderGraphic(false).UNSAFE_queryAllByType(Svg)).toHaveLength(0);
  });
});

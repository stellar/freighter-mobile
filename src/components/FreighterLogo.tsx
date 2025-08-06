import { logos } from "assets/logos";
import { pxValue } from "helpers/dimensions";
import React from "react";
import { Image } from "react-native";

const DEFAULT_LOGO_SIZE = 48;

export const FreighterLogo = ({
  width = DEFAULT_LOGO_SIZE,
  height = DEFAULT_LOGO_SIZE,
}: {
  width?: number;
  height?: number;
}) => (
  <Image
    source={logos.freighter}
    resizeMode="contain"
    style={{ width: pxValue(width), height: pxValue(height) }}
  />
);

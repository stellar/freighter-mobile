import {
  Blur,
  Group,
  Path,
  Rect,
  Transforms3d,
} from "@shopify/react-native-skia";
import {
  MARBLE_BLUR_SIGMA,
  MARBLE_CLIP_PATH,
  MARBLE_LAYER1_PATH,
  MARBLE_LAYER2_PATH,
  MARBLE_VIEWBOX,
  MarbleLayer,
  VARIAL_AVATAR_COLORS,
  avatarSeed,
  marbleAvatar,
} from "helpers/varialAvatar";
import React from "react";

const CENTER = MARBLE_VIEWBOX / 2;

// SVG's `translate rotate(r cx cy) scale`, in the same order.
const layerTransform = (layer: MarbleLayer): Transforms3d => [
  { translateX: layer.translateX + CENTER },
  { translateY: layer.translateY + CENTER },
  { rotate: (layer.rotate * Math.PI) / 180 },
  { translateX: -CENTER },
  { translateY: -CENTER },
  { scale: layer.scale },
];

interface MarbleAvatarProps {
  publicAddress: string;
  size: number;
}

/** Skia drawing of the account avatar; render inside a `size`-square Canvas. */
export const MarbleAvatar = ({ publicAddress, size }: MarbleAvatarProps) => {
  const { base, layer1, layer2 } = marbleAvatar(
    avatarSeed(publicAddress),
    VARIAL_AVATAR_COLORS,
  );

  return (
    <Group
      transform={[{ scale: size / MARBLE_VIEWBOX }]}
      clip={MARBLE_CLIP_PATH}
    >
      <Rect
        x={0}
        y={0}
        width={MARBLE_VIEWBOX}
        height={MARBLE_VIEWBOX}
        color={base}
      />
      <Path
        path={MARBLE_LAYER1_PATH}
        color={layer1.color}
        transform={layerTransform(layer1)}
      >
        <Blur blur={MARBLE_BLUR_SIGMA} mode="decal" />
      </Path>
      <Path
        path={MARBLE_LAYER2_PATH}
        color={layer2.color}
        blendMode="overlay"
        transform={layerTransform(layer2)}
      >
        <Blur blur={MARBLE_BLUR_SIGMA} mode="decal" />
      </Path>
    </Group>
  );
};

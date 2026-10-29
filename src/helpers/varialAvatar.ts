/* eslint-disable no-bitwise */
import { StrKey } from "@stellar/stellar-sdk";
import { colors as appColors } from "config/colors";

// Port of boring-avatars@2.0.4's "marble" variant (MIT, (c) boringdesigners),
// which the extension renders directly. It must stay output-identical so an
// account has the same avatar on both platforms; __tests__/helpers/fixtures
// pins that against the extension's fixtures.

// Marble uses three consecutive entries (wrapping), so order is part of the
// design. Must match the extension's VARIAL_AVATAR_COLORS. Steps are named by
// ramp, not the active theme, so an avatar never changes with the theme.
export const VARIAL_AVATAR_COLORS = [
  appColors.dark.lilac[9],
  appColors.light.lilac[5],
  appColors.light.lilac[12],
  appColors.light.lilac[9],
  appColors.light.lilac[8],
];

// The library draws on an 80x80 viewBox; callers scale to their size.
export const MARBLE_VIEWBOX = 80;

export const MARBLE_LAYER1_PATH =
  "M32.414 59.35L50.376 70.5H72.5v-71H33.728L26.5 13.381l19.057 27.08L32.414 59.35z";
export const MARBLE_LAYER2_PATH =
  "M22.216 24L0 46.75l14.108 38.129L78 86l-3.081-59.276-22.378 4.005 12.972 20.186-23.35 27.395L22.215 24z";
export const MARBLE_BLUR_SIGMA = 7;
export const MARBLE_CLIP_PATH = "M0 40a40 40 0 1 0 80 0a40 40 0 1 0-80 0z";

export interface MarbleLayer {
  color: string;
  translateX: number;
  translateY: number;
  rotate: number;
  scale: number;
}

const hashCode = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash &= hash;
  }
  return Math.abs(hash);
};

const getDigit = (num: number, ntn: number) =>
  Math.floor((num / 10 ** ntn) % 10);

const getUnit = (num: number, range: number, index?: number) => {
  const value = num % range;
  return index && getDigit(num, index) % 2 === 0 ? -value : value;
};

// A muxed (M…) address wraps a G… account, so it shows that account's avatar.
// Must match the extension's avatarSeed.
export const avatarSeed = (address: string) =>
  address.startsWith("M") && StrKey.isValidMed25519PublicKey(address)
    ? StrKey.encodeEd25519PublicKey(
        StrKey.decodeMed25519PublicKey(address).subarray(0, 32),
      )
    : address;

export const marbleAvatar = (name: string, colors: string[]) => {
  const num = hashCode(name);
  const layers: MarbleLayer[] = [0, 1, 2].map((i) => {
    const seed = num * (i + 1);
    return {
      color: colors[(num + i) % colors.length],
      translateX: getUnit(seed, MARBLE_VIEWBOX / 10, 1),
      translateY: getUnit(seed, MARBLE_VIEWBOX / 10, 2),
      scale: 1.2 + getUnit(seed, MARBLE_VIEWBOX / 20) / 10,
      rotate: getUnit(seed, 360, 1),
    };
  });

  return {
    base: layers[0].color,
    // The library scales the first shape by the second's scale; kept so the
    // output matches.
    layer1: { ...layers[1], scale: layers[2].scale },
    layer2: layers[2],
  };
};

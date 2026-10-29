import { DEFAULT_PADDING } from "config/constants";
import { PRICE_HISTORY_RANGES } from "config/types";

/**
 * The timeframe selector's geometry, derived rather than transcribed.
 *
 * Both selector suites read from here so neither restates a rendered figure.
 * That mattered: the original bug was a design-space constant (`PILL_HEIGHT =
 * 26`) treated as a rendered one, and the first attempt at a fix repeated it
 * with better numbers. Anything a test wants to assert about a real size
 * should come out of these functions.
 */

/** Mirrors `helpers/dimensions.ts`, which captures these once at module load. */
const DESIGN_WIDTH = 402;
const DESIGN_HEIGHT = 874;

export interface Device {
  name: string;
  width: number;
  height: number;
  /** Physical pixels per point, for the rounding the real helper applies. */
  pixelRatio: number;
}

/**
 * The supported floor is 320 logical units on both platforms: the iPhone SE
 * 1st gen, which iOS 15.1 still installs on, and Android's `sw320dp` bucket,
 * which a 411dp phone reaches at the largest Display size setting.
 *
 * Android matters separately from iOS because `deviceScale` caps at 1.2. A
 * 320x568 iPhone trips that cap and gets proportionally smaller type, while a
 * 320x720 Android does not — so the same width leaves less room on Android.
 */
export const DEVICES: Device[] = [
  { name: "iPhone SE 1st gen", width: 320, height: 568, pixelRatio: 2 },
  { name: "iPhone SE 2nd/3rd gen", width: 375, height: 667, pixelRatio: 2 },
  { name: "iPhone 12/13 mini", width: 375, height: 812, pixelRatio: 3 },
  { name: "iPhone 13/14", width: 390, height: 844, pixelRatio: 3 },
  { name: "iPhone 15/16", width: 393, height: 852, pixelRatio: 3 },
  { name: "iPhone 16 Pro", width: 402, height: 874, pixelRatio: 3 },
  { name: "iPhone 15/16 Pro Max", width: 430, height: 932, pixelRatio: 3 },
  // 320dp on Android is not a small phone: it is a 411dp phone at the largest
  // Display size, which RAISES density. Modelling it at pixelRatio 2 rounds
  // `pxValue` down and overstates the budget by about 2.5%.
  {
    name: "Android sw320dp (large display)",
    width: 320,
    height: 694,
    pixelRatio: 3.375,
  },
  { name: "Android 360dp", width: 360, height: 800, pixelRatio: 3 },
  { name: "Android 411dp", width: 411, height: 891, pixelRatio: 2.625 },
];

/**
 * `helpers/dimensions.ts` `pxValue`, including the `.toFixed(2)` it returns
 * and the physical-pixel rounding `react-native-responsive-screen` applies.
 * Both move the result by about a percent, always in the tighter direction on
 * some devices, which is too much to wave away in a budget this close.
 */
export const pxValue = (design: number, device: Device): number => {
  const scale = Math.min(
    device.width / device.height / (DESIGN_WIDTH / DESIGN_HEIGHT),
    1.2,
  );
  const raw = scale * (design / DESIGN_HEIGHT) * device.height;
  const rounded = Math.round(raw * device.pixelRatio) / device.pixelRatio;
  return Number(rounded.toFixed(2));
};

/** Width of one pill: the row less screen padding and gaps, split evenly. */
export const tabWidth = (device: Device, { gap }: { gap: number }): number => {
  const row = device.width - pxValue(DEFAULT_PADDING, device) * 2;
  return (
    (row - gap * (PRICE_HISTORY_RANGES.length - 1)) /
    PRICE_HISTORY_RANGES.length
  );
};

/** Rendered pill height: the scaled line height plus the pill's own padding. */
export const pillHeight = (
  device: Device,
  { lineHeight, padY }: { lineHeight: number; padY: number },
): number => pxValue(lineHeight, device) + padY * 2;

/**
 * Text room inside a SELECTED pill, as a multiple of the rendered font size.
 * Selected because every tab can be, and its border is border-box in Yoga so
 * it eats into the text box.
 */
export const textBudgetEm = (
  device: Device,
  {
    gap,
    padX,
    fontSize,
    border,
  }: {
    gap: number;
    padX: number;
    fontSize: number;
    border: number;
  },
): number =>
  (tabWidth(device, { gap }) - padX * 2 - border * 2) /
  pxValue(fontSize, device);

/** The tightest value of `measure` across every supported device. */
export const worstCase = (measure: (device: Device) => number): number =>
  DEVICES.reduce((min, device) => Math.min(min, measure(device)), Infinity);

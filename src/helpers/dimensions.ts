import { DEFAULT_PADDING } from "config/constants";
import { hasNotch } from "helpers/device";
import { Dimensions } from "react-native";
import { heightPercentageToDP } from "react-native-responsive-screen";

/**
 * Reference dimensions from the iPhone 16 Pro design
 * Used for calculating responsive sizes across different devices
 *
 * @internal
 */
const DESIGN_HEIGHT = 874;
const DESIGN_WIDTH = 402;
const DESIGN_ASPECT_RATIO = DESIGN_WIDTH / DESIGN_HEIGHT;

/**
 * Current device dimensions
 * @internal
 */
const { width, height } = Dimensions.get("window");

/**
 * The aspect ratio of the current device (width / height)
 *
 * The taller the device, the smaller this ratio will be.
 * This is used to calculate appropriate scaling factors for UI elements.
 */
export const deviceAspectRatio = width / height;

/**
 * Scaling factor based on the relationship between device aspect ratio and design aspect ratio
 *
 * This factor adjusts UI element sizes to work well across different device dimensions:
 * - For tall devices (smaller aspect ratio than design), elements will be scaled down
 * - For wide devices, scaling is capped at 1.2 to prevent oversized elements
 *
 * @internal
 */
const deviceScale = Math.min(deviceAspectRatio / DESIGN_ASPECT_RATIO, 1.2);

/**
 * Converts a pixel value from design specifications to a responsive pixel value for the current device
 *
 * This function ensures that UI elements maintain proportional sizes across different screen dimensions.
 * It accounts for the device's aspect ratio to provide better scaling on tall or wide devices.
 *
 * @param {number} designValue - The pixel value from design specifications
 * @returns {number} Responsive pixel value for the current device
 *
 * @example
 * // Convert a 50px height from design to responsive height
 * const buttonHeight = pxValue(50);
 */
export function pxValue(designValue: number): number {
  const designHeightPercentage =
    deviceScale * (designValue / DESIGN_HEIGHT) * 100;
  return heightPercentageToDP(designHeightPercentage);
}

/**
 * Converts a pixel value from design specifications to a responsive pixel string with "px" suffix
 *
 * @param {number} designValue - The pixel value from design specifications
 * @returns {string} Responsive pixel value as a string with "px" suffix
 *
 * @example
 * // Use in styled-components
 * const Container = styled.View`
 *   height: ${px(50)};
 *   margin-top: ${px(20)};
 * `;
 */
export function px(designValue: number): string {
  return `${pxValue(designValue)}px`;
}

/**
 * Converts a font size value from design specifications to a responsive font size for the current device
 *
 * @param {number} designFontSize - The font size from design specifications
 * @returns {number} Responsive font size for the current device
 *
 * @example
 * // Get responsive font size value for calculations
 * const scaledFontSize = fsValue(16);
 */
export function fsValue(designFontSize: number): number {
  return pxValue(designFontSize);
}

/**
 * Converts a font size value from design specifications to a responsive font size string with "px" suffix
 *
 * @param {number} designFontSize - The font size from design specifications
 * @returns {string} Responsive font size as a string with "px" suffix
 *
 * @example
 * // Use in styled-components
 * const Title = styled.Text`
 *   font-size: ${fs(18)};
 * `;
 */
export function fs(designFontSize: number): string {
  return `${fsValue(designFontSize)}px`;
}

/**
 * Calculates responsive spacing that adapts to the device's notch status and platform
 *
 * This function provides consistent spacing across different device types by:
 * - Accepting a base spacing value from design specs
 * - Applying platform-specific adjustments (Android devices with notch get additional padding)
 * - Allowing optional multiplier to easily create spacing variants
 * - Converting the result to responsive pixel values with proper units
 *
 * @param {number} baseSpacing - The base spacing value from design specifications
 * @param {Object} options - Optional configuration parameters
 * @param {number} options.multiplier - Multiplier to scale the spacing (default: 1)
 * @returns {string} Responsive spacing value as a string with "px" suffix
 *
 * @example
 * // Basic usage for default spacing
 * const padding = calculateEdgeSpacing(24);
 *
 * @example
 * // Create double spacing with notch adjustment
 * const largeMargin = calculateEdgeSpacing(24, { multiplier: 2 });
 *
 * @example
 * // Create spacing with no notch adjustment
 * const fixedSpacing = calculateEdgeSpacing(16, { toNumber: true });
 */
export const calculateEdgeSpacing = (
  baseSpacing: number,
  options?: { multiplier?: number; toNumber?: boolean },
): string | number => {
  const { multiplier = 1, toNumber = false } = options || {};
  const scaledBaseSpacing = baseSpacing * multiplier;
  const notchAdjustment = !hasNotch ? DEFAULT_PADDING : 0;

  return toNumber
    ? pxValue(scaledBaseSpacing + notchAdjustment)
    : px(scaledBaseSpacing + notchAdjustment);
};

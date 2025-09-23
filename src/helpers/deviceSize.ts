import { useWindowDimensions } from "react-native";

/**
 * Device size breakpoints matching NativeWind's responsive breakpoints
 */
export const DEVICE_SIZE_BREAKPOINTS = {
  xs: 375, // max-xs breakpoint - very small devices
  sm: 480, // max-sm breakpoint - small phones
  md: 640, // max-md breakpoint - medium phones and small tablets
  lg: 768, // max-lg breakpoint - large phones and tablets
  xl: 1024, // max-xl breakpoint - large tablets and desktops
} as const;

/**
 * Device size categories
 */
export enum DeviceSize {
  XS = "xs",
  SM = "sm",
  MD = "md",
  LG = "lg",
  XL = "xl",
}

/**
 * Hook to get the current device size based on screen width
 *
 * @returns {DeviceSize} The current device size category
 *
 * @example
 * // Basic usage
 * const deviceSize = useDeviceSize();
 * const isSmallScreen = deviceSize === DeviceSize.XS;
 *
 * @example
 * // Multiple breakpoint checks
 * const deviceSize = useDeviceSize();
 * const isLargeScreen = deviceSize === DeviceSize.LG || deviceSize === DeviceSize.XL;
 * const isMediumOrSmaller = deviceSize === DeviceSize.XS || deviceSize === DeviceSize.SM || deviceSize === DeviceSize.MD;
 *
 * @example
 * // Responsive Display sizing
 * const deviceSize = useDeviceSize();
 * const displaySize = deviceSize === DeviceSize.XS ? { lg: true } : { xl: true };
 *
 * @example
 * // Responsive Button sizing
 * const deviceSize = useDeviceSize();
 * const buttonSize = deviceSize === DeviceSize.XS ? "sm" : "md";
 */
export const useDeviceSize = (): DeviceSize => {
  const { width } = useWindowDimensions();
  if (width <= DEVICE_SIZE_BREAKPOINTS.xs) {
    return DeviceSize.XS;
  }
  if (width < DEVICE_SIZE_BREAKPOINTS.sm) {
    return DeviceSize.SM;
  }
  if (width < DEVICE_SIZE_BREAKPOINTS.md) {
    return DeviceSize.MD;
  }
  if (width < DEVICE_SIZE_BREAKPOINTS.lg) {
    return DeviceSize.LG;
  }
  return DeviceSize.XL;
};

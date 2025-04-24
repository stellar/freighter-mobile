import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";

/**
 * Boolean flag indicating whether the current device is running iOS
 * Useful for platform-specific code and conditionals
 *
 * @example
 * // Conditionally apply styles or behavior based on platform
 * const styles = {
 *   container: {
 *     marginTop: isIOS ? 50 : 20,
 *   }
 * };
 */
export const isIOS = Platform.OS === "ios";

/**
 * Boolean flag indicating whether the current device is running Android
 * Useful for platform-specific code and conditionals
 *
 * @example
 * // Conditionally apply styles or behavior based on platform
 * const styles = {
 *   container: {
 *     marginTop: isAndroid ? 20 : 50,
 *   }
 * };
 */
export const isAndroid = Platform.OS === "android";

/**
 * Boolean flag indicating whether the current device has a notch
 * Useful for conditionals and platform-specific code
 *
 * @example
 * // Conditionally apply styles or behavior based on device notch
 * const styles = {
 *   container: {
 *     marginTop: hasNotch ? 50 : 20,
 *   }
 * };
 */
export const hasNotch = DeviceInfo.hasNotch();

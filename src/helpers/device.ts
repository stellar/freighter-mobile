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
 * The Android API level the app runs on, or 0 off Android. Some styles only
 * take effect from a given level, as `filter: blur` does from 31 (Android
 * 12).
 */
export const androidApiLevel = isAndroid ? Number(Platform.Version) : 0;

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

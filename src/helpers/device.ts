import { Platform } from "react-native";

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

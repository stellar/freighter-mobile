import Clipboard from "@react-native-clipboard/clipboard";
import { logger } from "config/logger";
import { NativeModules, Platform } from "react-native";
// Import local types
import type { SecureClipboardNative } from "types/SecureClipboardNative";

// Get the native module directly
const { SecureClipboard } = NativeModules;
const SecureClipboardModule = SecureClipboard as SecureClipboardNative;

/**
 * Service for handling secure clipboard operations with platform-specific enhancements
 *
 * Platform-specific security features:
 * - Android: Uses ClipDescription.EXTRA_IS_SENSITIVE flag to prevent clipboard previews (Android 13+)
 *   Expiration is handled via native Handler for delayed clearing with content verification
 *   On older Android versions (7.0-12), falls back to standard clipboard behavior
 * - iOS: Uses manual expiration with content verification to prevent overwriting user data (iOS 15.1+)
 * - Both platforms: Graceful fallback to standard clipboard if native modules fail
 * - Safety: Only clears clipboard if content hasn't been overwritten by other applications
 */
export class SecureClipboardService {
  /**
   * Copy text to clipboard with security enhancements
   * All data copied through this service is treated as sensitive for maximum security
   * @param text - The text to copy
   * @param expirationMs - Expiration time in milliseconds (0 = no expiration)
   */
  static async copyToClipboard(
    text: string,
    expirationMs: number = 0,
  ): Promise<void> {
    try {
      if (Platform.OS === "android" || Platform.OS === "ios") {
        // Always use sensitive flag for secure clipboard service
        await SecureClipboardModule.setString(text, expirationMs);
      } else {
        // Fallback to standard clipboard for other platforms
        Clipboard.setString(text);
      }
    } catch (error) {
      // Fallback to standard clipboard if native module fails
      logger.warn(
        "SecureClipboardService.copyToClipboard",
        "Native module failed, falling back to standard clipboard",
        error,
      );
      Clipboard.setString(text);
    }
  }

  /**
   * Clear the clipboard
   */
  static async clearClipboard(): Promise<void> {
    try {
      if (Platform.OS === "android" || Platform.OS === "ios") {
        await SecureClipboardModule.clearString();
      } else {
        Clipboard.setString("");
      }
    } catch (error) {
      // Fallback to standard clipboard if native module fails
      logger.warn(
        "SecureClipboardService.clearClipboard",
        "Native clear failed, falling back to standard clipboard",
        error,
      );
      Clipboard.setString("");
    }
  }

  /**
   * Get text from clipboard
   */
  static async getClipboardText(): Promise<string> {
    try {
      if (Platform.OS === "android" || Platform.OS === "ios") {
        return await SecureClipboardModule.getString();
      }
      return await Clipboard.getString();
    } catch (error) {
      // Fallback to standard clipboard if native module fails
      logger.warn(
        "SecureClipboardService.getClipboardText",
        "Native getString failed, falling back to standard clipboard",
        error,
      );
      return Clipboard.getString();
    }
  }
}

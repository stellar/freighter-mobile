/**
 * TypeScript definitions for SecureClipboard native module
 *
 * This module provides secure clipboard functionality with platform-specific enhancements:
 * - Android: Uses ClipDescription.EXTRA_IS_SENSITIVE flag and native Handler for expiration (Android 13+)
 * - iOS: Uses manual expiration with content verification to prevent overwriting user data
 * - Both platforms: All data is treated as sensitive for maximum security
 * - Safety: Only clears clipboard if content hasn't been overwritten by other applications
 */

export interface SecureClipboardNative {
  /**
   * Copy text to clipboard with security enhancements
   * All data copied through this service is treated as sensitive for maximum security
   * @param text - The text to copy to clipboard
   * @param expirationMs - Expiration time in milliseconds (0 = no expiration)
   * @returns Promise that resolves when the text is copied
   */
  setString(text: string, expirationMs: number): Promise<void>;

  /**
   * Get text from clipboard
   * @returns Promise that resolves with the clipboard text
   */
  getString(): Promise<string>;

  /**
   * Clear the clipboard
   * @returns Promise that resolves when the clipboard is cleared
   */
  clearString(): Promise<void>;
}

declare const SecureClipboard: SecureClipboardNative;

export default SecureClipboard;

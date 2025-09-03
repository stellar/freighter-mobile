import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useCallback } from "react";
import { SecureClipboardService } from "services/SecureClipboardService";

interface SecureCopyToClipboardOptions {
  /** Whether to hide the toast notification (default: false) */
  hideNotification?: boolean;
  /** Custom message for the toast notification */
  notificationMessage?: string;
  /** Custom toast variant (default: "success") */
  toastVariant?: "primary" | "secondary" | "success" | "error" | "warning";
  /** Auto-clear timeout in milliseconds (default: 30000 = 30 seconds) */
  autoClearTimeout?: number;
}

interface UseSecureClipboardResult {
  /** Copy text to clipboard with security enhancements and optional toast notification */
  copyToClipboard: (
    text: string,
    options?: SecureCopyToClipboardOptions,
  ) => void;
  /** Get text from clipboard */
  getClipboardText: () => Promise<string>;
  /** Manually clear the clipboard */
  clearClipboard: () => Promise<void>;
}

/**
 * Hook for securely copying text to clipboard with enhanced security features:
 * - Native expiration handling (no JavaScript timers needed)
 * - Platform-specific sensitive data flagging (Android 13+ only)
 * - Optional toast notification
 *
 * All data copied through this hook is treated as sensitive for maximum security.
 * On Android 13+, uses EXTRA_IS_SENSITIVE flag and native Handler for expiration.
 * On iOS 15.1+, uses UIPasteboard expiration for automatic clearing.
 * On older versions, falls back to standard clipboard behavior.
 * Use the regular useClipboard hook for non-sensitive data.
 *
 * @returns Object containing secure clipboard functions
 *
 * @example
 * const { copyToClipboard } = useSecureClipboard();
 *
 * // Basic usage with default 30-second auto-clear
 * copyToClipboard("sensitive data");
 *
 * // With custom options
 * copyToClipboard("recovery phrase", {
 *   autoClearTimeout: 15000, // 15 seconds
 *   notificationMessage: "Recovery phrase copied securely"
 * });
 */
export const useSecureClipboard = (): UseSecureClipboardResult => {
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  const clearClipboard = useCallback(async () => {
    try {
      await SecureClipboardService.clearClipboard();
    } catch (error) {
      // Silently fail - clearing clipboard is best effort
    }
  }, []);

  const copyToClipboard = useCallback(
    (text: string, options: SecureCopyToClipboardOptions = {}) => {
      try {
        // Copy to clipboard with security enhancements and native expiration
        const expirationMs = options.autoClearTimeout ?? 30000; // Default 30 seconds
        SecureClipboardService.copyToClipboard(text, expirationMs);

        // Show notification if not hidden
        if (!options.hideNotification) {
          showToast({
            title: options.notificationMessage || t("common.copied"),
            variant: options.toastVariant || "success",
            toastId: "secure-copy-toast",
          });
        }

        // Platform-specific sensitive data handling and expiration is now handled by SecureClipboardService
        // All data copied through this hook is treated as sensitive
      } catch (error) {
        showToast({
          title: t("clipboard.failed"),
          variant: "error",
          toastId: "secure-copy-error-toast",
        });
      }
    },
    [showToast, t],
  );

  const getClipboardText = useCallback(
    () => SecureClipboardService.getClipboardText(),
    [],
  );

  return { copyToClipboard, getClipboardText, clearClipboard };
};

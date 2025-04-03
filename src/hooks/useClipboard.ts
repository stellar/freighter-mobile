import Clipboard from "@react-native-clipboard/clipboard";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useCallback } from "react";

interface CopyToClipboardOptions {
  /** Whether to show a toast notification (default: true) */
  showNotification?: boolean;
  /** Custom message for the toast notification */
  notificationMessage?: string;
  /** Custom toast variant (default: "success") */
  toastVariant?: "primary" | "secondary" | "success" | "error" | "warning";
}

interface UseClipboardResult {
  /** Copy text to clipboard and optionally show a toast notification */
  copyToClipboard: (text: string, options?: CopyToClipboardOptions) => void;
}

/**
 * Hook for copying text to clipboard with optional toast notification
 *
 * @returns Object containing copyToClipboard function
 *
 * @example
 * const { copyToClipboard } = useClipboard();
 *
 * // Basic usage
 * copyToClipboard("Hello World");
 *
 * // With custom options
 * copyToClipboard("Hello World", {
 *   showNotification: true,
 *   notificationMessage: "Custom message",
 *   toastVariant: "success"
 * });
 */
export const useClipboard = (): UseClipboardResult => {
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  const copyToClipboard = useCallback(
    (text: string, options: CopyToClipboardOptions = {}) => {
      try {
        Clipboard.setString(text);

        if (options.showNotification !== false) {
          showToast({
            title: options.notificationMessage || t("clipboard.copied"),
            variant: options.toastVariant || "success",
          });
        }
      } catch (error) {
        showToast({
          title: t("clipboard.failed"),
          variant: "error",
        });
      }
    },
    [showToast, t],
  );

  return { copyToClipboard };
};

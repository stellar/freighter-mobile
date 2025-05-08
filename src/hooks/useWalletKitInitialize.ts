import { createWalletKit, ERROR_TOAST_DURATION } from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useCallback, useEffect, useState } from "react";

/**
 * Hook for initializing the WalletKit instance.
 * Handles the initialization process and error handling.
 *
 * @returns {boolean} A boolean indicating whether WalletKit has been initialized
 *
 * @example
 * ```tsx
 * const initialized = useWalletKitInitialize();
 * if (initialized) {
 *   // WalletKit is ready to use
 * }
 * ```
 */
export const useWalletKitInitialize = () => {
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  const [initialized, setInitialized] = useState(false);

  const onInitialize = useCallback(async () => {
    try {
      await createWalletKit();
      setInitialized(true);
    } catch (error) {
      showToast({
        title: t("walletKit.errorInitializing"),
        message: t("common.error", {
          errorMessage:
            error instanceof Error ? error.message : t("common.unknownError"),
        }),
        variant: "error",
        duration: ERROR_TOAST_DURATION,
      });
    }
  }, [t, showToast]);

  useEffect(() => {
    if (!initialized) {
      onInitialize();
    }
  }, [initialized, onInitialize]);

  return initialized;
};

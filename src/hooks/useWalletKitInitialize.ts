import { createWalletKit, ERROR_TOAST_DURATION } from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useCallback, useEffect, useState } from "react";

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

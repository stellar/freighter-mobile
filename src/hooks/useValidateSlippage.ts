import { MAX_SLIPPAGE, MIN_SLIPPAGE } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { useEffect, useState } from "react";

/**
 * Hook to validate slippage percentage
 * Returns error message if invalid
 */
export const useValidateSlippage = (slippage: string) => {
  const { t } = useAppTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slippage) {
      setError(t("transactionSettings.errors.slippage.customRequired"));
      return;
    }

    const numValue = parseFloat(slippage);

    if (Number.isNaN(numValue)) {
      setError(t("transactionSettings.errors.slippage.invalidNumber"));
      return;
    }

    if (numValue < MIN_SLIPPAGE) {
      setError(
        t("transactionSettings.errors.slippage.minSlippage", {
          min: MIN_SLIPPAGE,
        }),
      );
      return;
    }

    if (numValue > MAX_SLIPPAGE) {
      setError(
        t("transactionSettings.errors.slippage.maxSlippage", {
          max: MAX_SLIPPAGE,
        }),
      );
      return;
    }

    setError(null);
  }, [slippage, t]);

  return { error };
};

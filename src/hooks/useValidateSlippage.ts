import { MAX_SLIPPAGE, MIN_SLIPPAGE } from "config/constants";
import { parseDisplayNumber } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { useEffect, useState } from "react";

/**
 * Hook to validate slippage percentage
 * Accepts locale-formatted input (e.g., "1,5" or "1.5")
 * Returns error message if invalid
 */
export const useValidateSlippage = (slippage: string) => {
  const { t } = useAppTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slippage || slippage.trim() === "") {
      setError(t("transactionSettings.errors.slippage.customRequired"));
      return;
    }

    try {
      const numValue = parseFloat(parseDisplayNumber(slippage).toString());

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
    } catch (parseError) {
      setError(t("transactionSettings.errors.slippage.invalidNumber"));
    }
  }, [slippage, t]);

  return { error };
};

import { MIN_TRANSACTION_TIMEOUT } from "config/constants";
import { parseDisplayNumber } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { useEffect, useState } from "react";

/**
 * Hook to validate a transaction timeout
 * Accepts locale-formatted input (e.g., "30" or "30,5")
 * Returns error message if invalid
 */
export const useValidateTransactionTimeout = (timeout: string) => {
  const { t } = useAppTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!timeout || timeout.trim() === "") {
      setError(t("transactionSettings.errors.timeout.required"));
      return;
    }

    try {
      const timeoutValue = Number(parseDisplayNumber(timeout).toString());

      if (Number.isNaN(timeoutValue)) {
        setError(t("transactionSettings.errors.timeout.invalid"));
        return;
      }

      if (timeoutValue < MIN_TRANSACTION_TIMEOUT) {
        setError(t("transactionSettings.errors.timeout.greaterThanZero"));
        return;
      }

      setError(null);
    } catch (parseError) {
      setError(t("transactionSettings.errors.timeout.invalid"));
    }
  }, [timeout, t]);

  return { error };
};

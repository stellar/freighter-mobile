import { MIN_TRANSACTION_TIMEOUT } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { useEffect, useState } from "react";

/**
 * Hook to validate a transaction timeout
 * Returns error message if invalid
 */
export const useValidateTransactionTimeout = (timeout: string) => {
  const { t } = useAppTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!timeout) {
      setError(t("transactionTimeoutScreen.errors.required"));
      return;
    }

    const timeoutValue = Number(timeout);

    if (Number.isNaN(timeoutValue)) {
      setError(t("transactionTimeoutScreen.errors.invalid"));
      return;
    }

    if (timeoutValue < MIN_TRANSACTION_TIMEOUT) {
      setError(t("transactionTimeoutScreen.errors.greaterThanZero"));
      return;
    }

    setError(null);
  }, [timeout, t]);

  return { error };
};

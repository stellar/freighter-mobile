import BigNumber from "bignumber.js";
import { MIN_TRANSACTION_FEE } from "config/constants";
import {
  formatNumberForDisplay,
  parseDisplayNumber,
} from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { useEffect, useState } from "react";

/**
 * Hook to validate a transaction fee (the TOTAL across all operations).
 * Accepts locale-formatted input (e.g., "0,00001" or "0.00001").
 * The minimum scales with `operationCount` because each operation needs at
 * least MIN_TRANSACTION_FEE (Stellar's 100-stroop per-op minimum) — so a 2-op
 * swap can't total less than 2 × that. Returns error message if invalid.
 */
export const useValidateTransactionFee = (fee: string, operationCount = 1) => {
  const { t } = useAppTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fee || fee.trim() === "") {
      setError(t("transactionSettings.errors.fee.required"));
      return;
    }

    try {
      const feeValue = new BigNumber(parseDisplayNumber(fee));
      const minFee = new BigNumber(MIN_TRANSACTION_FEE).times(operationCount);

      if (feeValue.isNaN()) {
        setError(t("transactionSettings.errors.fee.invalid"));
        return;
      }

      if (feeValue.isLessThan(minFee)) {
        setError(
          t("transactionSettings.errors.fee.tooLow", {
            min: formatNumberForDisplay(minFee.toString()),
          }),
        );
        return;
      }

      setError(null);
    } catch (parseError) {
      setError(t("transactionSettings.errors.fee.invalid"));
    }
  }, [fee, t, operationCount]);

  return { error };
};

import BigNumber from "bignumber.js";
import { MIN_TRANSACTION_FEE } from "config/constants";
import {
  formatNumberForDisplay,
  parseDisplayNumber,
} from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { useEffect, useState } from "react";

/**
 * Hook to validate a transaction fee
 * Accepts locale-formatted input (e.g., "0,00001" or "0.00001")
 * Returns error message if invalid
 */
export const useValidateTransactionFee = (fee: string) => {
  const { t } = useAppTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fee || fee.trim() === "") {
      setError(t("transactionSettings.errors.fee.required"));
      return;
    }

    try {
      const feeValue = new BigNumber(parseDisplayNumber(fee));
      const minFee = new BigNumber(MIN_TRANSACTION_FEE);

      if (feeValue.isNaN()) {
        setError(t("transactionSettings.errors.fee.invalid"));
        return;
      }

      if (feeValue.isLessThan(minFee)) {
        setError(
          t("transactionSettings.errors.fee.tooLow", {
            min: formatNumberForDisplay(MIN_TRANSACTION_FEE),
          }),
        );
        return;
      }

      setError(null);
    } catch (parseError) {
      setError(t("transactionSettings.errors.fee.invalid"));
    }
  }, [fee, t]);

  return { error };
};

import BigNumber from "bignumber.js";
import { MIN_TRANSACTION_FEE } from "config/constants";
import {
  formatNumberForLocale,
  parseLocaleNumberToBigNumber,
} from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import { useEffect, useState } from "react";

/**
 * Hook to validate a transaction fee
 * Returns error message if invalid
 */
export const useValidateTransactionFee = (fee: string) => {
  const { t } = useAppTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fee) {
      setError(t("transactionSettings.errors.fee.required"));
      return;
    }

    const feeValue = parseLocaleNumberToBigNumber(fee);
    const minFee = new BigNumber(MIN_TRANSACTION_FEE);

    if (feeValue.isNaN()) {
      setError(t("transactionSettings.errors.fee.invalid"));
      return;
    }

    if (feeValue.isLessThan(minFee)) {
      setError(
        t("transactionSettings.errors.fee.tooLow", {
          min: formatNumberForLocale(MIN_TRANSACTION_FEE),
        }),
      );
      return;
    }

    setError(null);
  }, [fee, t]);

  return { error };
};

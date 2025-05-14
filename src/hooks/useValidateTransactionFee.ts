import BigNumber from "bignumber.js";
import { MIN_TRANSACTION_FEE } from "config/constants";
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
      setError(t("transactionFeeScreen.errors.required"));
      return;
    }

    const feeValue = new BigNumber(fee);
    const minFee = new BigNumber(MIN_TRANSACTION_FEE);

    if (feeValue.isNaN()) {
      setError(t("transactionFeeScreen.errors.invalid"));
      return;
    }

    if (feeValue.isLessThan(minFee)) {
      setError(
        t("transactionFeeScreen.errors.tooLow", { min: MIN_TRANSACTION_FEE }),
      );
      return;
    }

    setError(null);
  }, [fee, t]);

  return { error };
};

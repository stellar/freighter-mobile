import { PricedBalance } from "config/types";
import { calculateSpendableAmount, isAmountSpendable } from "helpers/balances";
import { useEffect, useState } from "react";

interface SwapAmountValidationParams {
  swapAmount: string;
  swapFromTokenBalance: PricedBalance | undefined;
  subentryCount: number | undefined;
  swapFee: string;
  fromTokenSymbol: string;
}

export const useSwapAmountValidation = ({
  swapAmount,
  swapFromTokenBalance,
  subentryCount,
  swapFee,
  fromTokenSymbol,
}: SwapAmountValidationParams) => {
  const [amountError, setAmountError] = useState<string | null>(null);

  useEffect(() => {
    if (!swapFromTokenBalance || !swapAmount || swapAmount === "0") {
      setAmountError(null);
      return;
    }

    if (
      !isAmountSpendable(
        swapAmount,
        swapFromTokenBalance,
        subentryCount,
        swapFee,
      )
    ) {
      const spendableAmount = calculateSpendableAmount(
        swapFromTokenBalance,
        subentryCount || 0,
        swapFee,
      );
      setAmountError(
        `Insufficient balance. Maximum spendable: ${spendableAmount.toFixed()} ${fromTokenSymbol}`,
      );
    } else {
      setAmountError(null);
    }
  }, [swapAmount, swapFromTokenBalance, subentryCount, fromTokenSymbol, swapFee]);

  return { amountError };
}; 
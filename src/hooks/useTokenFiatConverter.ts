import { BigNumber } from "bignumber.js";
import { PricedBalance } from "config/types";
import { formatNumericInput } from "helpers/numericInput";
import { useMemo, useState, useEffect } from "react";

interface UseTokenFiatConverterProps {
  selectedBalance: PricedBalance | undefined;
}

interface UseTokenFiatConverterResult {
  tokenAmount: string;
  fiatAmount: string;
  showFiatAmount: boolean;
  setShowFiatAmount: (show: boolean) => void;
  handleAmountChange: (key: string) => void;
  setTokenAmount: (amount: string) => void;
  setFiatAmount: (amount: string) => void;
  handlePercentagePress: (percentage: number) => void;
}

/**
 * Custom hook for handling token/fiat conversion and input
 *
 * This hook manages the state and logic for converting between token and fiat values,
 * handling numeric input, and maintaining proper decimal formatting.
 *
 * @param {UseTokenFiatConverterProps} props - The hook props
 * @returns {UseTokenFiatConverterResult} The hook result
 */
export const useTokenFiatConverter = ({
  selectedBalance,
}: UseTokenFiatConverterProps): UseTokenFiatConverterResult => {
  const [tokenAmount, setTokenAmount] = useState("0.00");
  const [fiatAmount, setFiatAmount] = useState("0.00");
  const [showFiatAmount, setShowFiatAmount] = useState(false);

  // Memoize token price to prevent unnecessary recalculations
  const tokenPrice = useMemo(
    () => selectedBalance?.currentPrice || new BigNumber(0),
    [selectedBalance?.currentPrice],
  );

  // Update fiat amount when token amount changes
  useEffect(() => {
    if (!showFiatAmount) {
      const newFiatAmount = tokenPrice.multipliedBy(new BigNumber(tokenAmount));
      setFiatAmount(newFiatAmount.toFixed(2));
    }
  }, [tokenAmount, tokenPrice, showFiatAmount]);

  // Update token amount when fiat amount changes
  useEffect(() => {
    if (showFiatAmount) {
      const newTokenAmount = tokenPrice.isZero()
        ? new BigNumber(0)
        : new BigNumber(fiatAmount).dividedBy(tokenPrice);
      setTokenAmount(newTokenAmount.toFixed(2));
    }
  }, [fiatAmount, tokenPrice, showFiatAmount]);

  /**
   * Handles numeric input and deletion
   *
   * @param {string} key - The key pressed (number or empty string for delete)
   */
  const handleAmountChange = (key: string) => {
    if (showFiatAmount) {
      setFiatAmount((prev) => formatNumericInput(prev, key));
    } else {
      setTokenAmount((prev) => formatNumericInput(prev, key));
    }
  };

  /**
   * Handles percentage button presses
   *
   * @param {number} percentage - The percentage to calculate (25, 50, 75, or 100)
   */
  const handlePercentagePress = (percentage: number) => {
    if (!selectedBalance) return;

    const totalBalance = new BigNumber(selectedBalance.total);
    const percentageValue = totalBalance.multipliedBy(percentage / 100);

    // Format the value to 2 decimal places
    const formattedValue = percentageValue.toFixed(2);

    // Update the value based on the current display mode
    if (showFiatAmount) {
      const calculatedFiatAmount = percentageValue.multipliedBy(tokenPrice);
      const formattedFiatAmount = calculatedFiatAmount.toFixed(2);
      setFiatAmount(formattedFiatAmount);
    } else {
      setTokenAmount(formattedValue);
    }
  };

  return {
    tokenAmount,
    fiatAmount,
    showFiatAmount,
    setShowFiatAmount,
    handleAmountChange,
    setTokenAmount,
    setFiatAmount,
    handlePercentagePress,
  };
};

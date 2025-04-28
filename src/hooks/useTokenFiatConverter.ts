import { BigNumber } from "bignumber.js";
import { PricedBalance } from "config/types";
import { formatNumericInput } from "helpers/numericInput";
import { useMemo, useState, useEffect } from "react";

interface UseTokenFiatConverterProps {
  selectedBalance: PricedBalance | undefined;
}

interface UseTokenFiatConverterResult {
  tokenValue: string;
  fiatValue: string;
  showDollarValue: boolean;
  setShowDollarValue: (show: boolean) => void;
  handleValueChange: (key: string) => void;
  setTokenValue: (value: string) => void;
  setFiatValue: (value: string) => void;
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
  const [tokenValue, setTokenValue] = useState("0.00");
  const [fiatValue, setFiatValue] = useState("0.00");
  const [showDollarValue, setShowDollarValue] = useState(false);

  // Memoize token price to prevent unnecessary recalculations
  const tokenPrice = useMemo(
    () => selectedBalance?.currentPrice || new BigNumber(0),
    [selectedBalance?.currentPrice],
  );

  // Update fiat value when token value changes
  useEffect(() => {
    if (!showDollarValue) {
      const newFiatValue = tokenPrice.multipliedBy(new BigNumber(tokenValue));
      setFiatValue(newFiatValue.toFixed(2));
    }
  }, [tokenValue, tokenPrice, showDollarValue]);

  // Update token value when fiat value changes
  useEffect(() => {
    if (showDollarValue) {
      const newTokenValue = tokenPrice.isZero()
        ? new BigNumber(0)
        : new BigNumber(fiatValue).dividedBy(tokenPrice);
      setTokenValue(newTokenValue.toFixed(2));
    }
  }, [fiatValue, tokenPrice, showDollarValue]);

  /**
   * Handles numeric input and deletion
   *
   * @param {string} key - The key pressed (number or empty string for delete)
   */
  const handleValueChange = (key: string) => {
    if (showDollarValue) {
      setFiatValue((prev) => formatNumericInput(prev, key));
    } else {
      setTokenValue((prev) => formatNumericInput(prev, key));
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
    if (showDollarValue) {
      const calculatedFiatValue = percentageValue.multipliedBy(tokenPrice);
      const formattedFiatValue = calculatedFiatValue.toFixed(2);
      setFiatValue(formattedFiatValue);
    } else {
      setTokenValue(formattedValue);
    }
  };

  return {
    tokenValue,
    fiatValue,
    showDollarValue,
    setShowDollarValue,
    handleValueChange,
    setTokenValue,
    setFiatValue,
    handlePercentagePress,
  };
};

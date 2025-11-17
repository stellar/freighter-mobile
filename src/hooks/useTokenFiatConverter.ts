import BigNumber from "bignumber.js";
import { DEFAULT_DECIMALS, FIAT_DECIMALS } from "config/constants";
import { PricedBalance } from "config/types";
import { hasDecimals } from "helpers/balances";
import {
  formatBigNumberForDisplay,
  parseDisplayNumber,
} from "helpers/formatAmount";
import { formatNumericInput } from "helpers/numericInput";
import { useMemo, useState, useEffect } from "react";

interface UseTokenFiatConverterProps {
  selectedBalance: PricedBalance | undefined;
}

interface UseTokenFiatConverterResult {
  tokenAmount: string; // Internal value (dot notation)
  tokenAmountDisplay: string; // Display value (locale-formatted)
  fiatAmount: string;
  showFiatAmount: boolean;
  setShowFiatAmount: (show: boolean) => void;
  handleDisplayAmountChange: (key: string) => void;
  setTokenAmount: (amount: string) => void;
  setFiatAmount: (amount: string) => void;
}

/**
 * Custom hook for handling token/fiat conversion and input
 *
 * This hook manages the state and logic for converting between token and fiat values,
 * handling numeric input, and maintaining proper decimal formatting. It focuses solely
 * on conversion logic and does not include business logic like spendable amounts.
 *
 * @param {UseTokenFiatConverterProps} props - The hook props
 * @returns {UseTokenFiatConverterResult} The hook result
 */
export const useTokenFiatConverter = ({
  selectedBalance,
}: UseTokenFiatConverterProps): UseTokenFiatConverterResult => {
  const [tokenAmount, setTokenAmount] = useState("0");
  const [tokenAmountDisplay, setTokenAmountDisplay] = useState("0");
  const [fiatAmount, setFiatAmount] = useState("0");
  const [showFiatAmount, setShowFiatAmount] = useState(false);

  // Memoize token price to prevent unnecessary recalculations
  const tokenPrice = useMemo(
    () => selectedBalance?.currentPrice || new BigNumber(0),
    [selectedBalance?.currentPrice],
  );

  // Get decimals from selected balance, defaulting to DEFAULT_DECIMALS
  const decimals = useMemo(
    () =>
      selectedBalance && hasDecimals(selectedBalance)
        ? selectedBalance.decimals
        : DEFAULT_DECIMALS,
    [selectedBalance],
  );

  // Update display value when internal value changes
  useEffect(() => {
    setTokenAmountDisplay(
      formatBigNumberForDisplay(new BigNumber(tokenAmount), {
        decimalPlaces: decimals,
        useGrouping: false,
      }),
    );
  }, [tokenAmount, decimals]);

  // Update fiat amount when token amount changes
  useEffect(() => {
    if (!showFiatAmount) {
      const bnTokenAmount = new BigNumber(tokenAmount);
      if (bnTokenAmount.isFinite()) {
        const newFiatAmount = tokenPrice.multipliedBy(bnTokenAmount);
        setFiatAmount(newFiatAmount.toFixed(FIAT_DECIMALS));
      } else {
        setFiatAmount("0");
      }
    }
  }, [tokenAmount, tokenPrice, showFiatAmount]);

  // Update token amount when fiat amount changes
  useEffect(() => {
    if (showFiatAmount) {
      const bnFiatAmount = new BigNumber(fiatAmount);
      if (bnFiatAmount.isFinite()) {
        const newTokenAmount = tokenPrice.isZero()
          ? new BigNumber(0)
          : bnFiatAmount.dividedBy(tokenPrice);
        setTokenAmount(newTokenAmount.toFixed(decimals));
      } else {
        setTokenAmount("0");
      }
    }
  }, [fiatAmount, tokenPrice, showFiatAmount, decimals]);

  /**
   * Handles numeric input and deletion for display-formatted values
   *
   * @param {string} key - The key pressed (number or empty string for delete)
   */
  const handleDisplayAmountChange = (key: string) => {
    if (showFiatAmount) {
      const newAmount = formatNumericInput(fiatAmount, key, FIAT_DECIMALS);
      // Update display value immediately to preserve formatting

      setFiatAmount(parseDisplayNumber(newAmount, FIAT_DECIMALS));
    } else {
      const newAmount = formatNumericInput(tokenAmountDisplay, key, decimals);
      // Update display value immediately to preserve formatting
      setTokenAmountDisplay(newAmount);
      const internalAmount = parseDisplayNumber(newAmount, decimals);
      setTokenAmount(internalAmount);
    }

    // Reset typing flag after a short delay
  };

  return {
    tokenAmount,
    tokenAmountDisplay,
    fiatAmount,
    showFiatAmount,
    setShowFiatAmount,
    handleDisplayAmountChange,
    setTokenAmount,
    setFiatAmount,
  };
};

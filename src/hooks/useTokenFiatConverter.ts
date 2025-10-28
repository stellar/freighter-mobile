import BigNumber from "bignumber.js";
import { DEFAULT_DECIMALS, FIAT_DECIMALS } from "config/constants";
import { PricedBalance } from "config/types";
import {
  formatBigNumberForDisplay,
  parseDisplayNumber,
} from "helpers/formatAmount";
import { formatNumericInput } from "helpers/numericInput";
import { useMemo, useState, useEffect } from "react";

interface UseTokenFiatConverterProps {
  selectedBalance: PricedBalance | undefined;
  spendableBalance: BigNumber;
}

interface UseTokenFiatConverterResult {
  tokenAmount: string; // Internal value (dot notation)
  tokenAmountDisplay: string; // Display value (locale-formatted)
  fiatAmount: string; // Internal value (dot notation)
  fiatAmountDisplay: string; // Display value (locale-formatted)
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
  spendableBalance,
}: UseTokenFiatConverterProps): UseTokenFiatConverterResult => {
  const [tokenAmount, setTokenAmount] = useState("0");
  const [tokenAmountDisplay, setTokenAmountDisplay] = useState("0");
  const [fiatAmount, setFiatAmount] = useState("0");
  const [fiatAmountDisplay, setFiatAmountDisplay] = useState("0.00");
  const [showFiatAmount, setShowFiatAmount] = useState(false);

  // Memoize token price to prevent unnecessary recalculations
  const tokenPrice = useMemo(
    () => selectedBalance?.currentPrice || new BigNumber(0),
    [selectedBalance?.currentPrice],
  );

  // Update display value when internal value changes
  useEffect(() => {
    setTokenAmountDisplay(
      formatBigNumberForDisplay(new BigNumber(tokenAmount), {
        decimalPlaces: DEFAULT_DECIMALS,
        useGrouping: false,
      }),
    );
  }, [tokenAmount]);

  // Update fiat amount when token amount changes
  useEffect(() => {
    if (!showFiatAmount && tokenPrice) {
      const bnTokenAmount = new BigNumber(tokenAmount);
      if (bnTokenAmount.isFinite() && !bnTokenAmount.isZero()) {
        const newFiatAmount = tokenPrice.multipliedBy(bnTokenAmount);
        setFiatAmount(newFiatAmount.toFixed(FIAT_DECIMALS));
      } else {
        setFiatAmount("0");
      }
    }
  }, [tokenAmount, tokenPrice, showFiatAmount]);

  // Update token amount when fiat amount changes
  useEffect(() => {
    if (showFiatAmount && tokenPrice) {
      const bnFiatAmount = new BigNumber(fiatAmount);
      if (bnFiatAmount.isFinite()) {
        const newTokenAmount = tokenPrice.isZero()
          ? new BigNumber(0)
          : bnFiatAmount.dividedBy(tokenPrice);
        setTokenAmount(newTokenAmount.toFixed(DEFAULT_DECIMALS));
      } else {
        setTokenAmount("0");
      }
    }
  }, [fiatAmount, tokenPrice, showFiatAmount]);

  /**
   * Validates if the input amount exceeds the maximum spendable amount
   *
   * @param {string} amount - The amount to validate
   * @param {boolean} isFiat - Whether this is a fiat amount
   * @returns {boolean} True if amount is valid, false if it exceeds max
   */
  const validateAmount = (amount: string, isFiat: boolean): boolean => {
    const amountBN = new BigNumber(amount);
    if (!amountBN.isFinite() || amountBN.isLessThanOrEqualTo(0)) {
      return true; // Allow zero or invalid amounts
    }

    if (isFiat) {
      // For fiat amounts, validate that the converted token amount doesn't exceed spendable balance
      if (!tokenPrice || tokenPrice.isZero()) {
        return true; // Allow if no price available
      }
      const convertedTokenAmount = amountBN.dividedBy(tokenPrice);
      return convertedTokenAmount.isLessThanOrEqualTo(spendableBalance);
    }
    return amountBN.isLessThanOrEqualTo(spendableBalance);
  };

  /**
   * Handles numeric input and deletion for display-formatted values
   *
   * @param {string} key - The key pressed (number or empty string for delete)
   */
  const handleDisplayAmountChange = (key: string) => {
    if (showFiatAmount) {
      const newAmount = formatNumericInput(
        fiatAmountDisplay,
        key,
        FIAT_DECIMALS,
      );

      // Check if the new amount exceeds max spendable
      const internalAmount = parseDisplayNumber(newAmount, FIAT_DECIMALS);
      if (!validateAmount(internalAmount, true)) {
        return; // Don't update if it exceeds max spendable
      }

      // Update display value immediately to preserve formatting
      setFiatAmountDisplay(newAmount);
      setFiatAmount(internalAmount);
    } else {
      const newAmount = formatNumericInput(
        tokenAmountDisplay,
        key,
        DEFAULT_DECIMALS,
      );

      // Check if the new amount exceeds max spendable
      const internalAmount = parseDisplayNumber(newAmount, DEFAULT_DECIMALS);
      if (!validateAmount(internalAmount, false)) {
        return; // Don't update if it exceeds max spendable
      }

      // Update display value immediately to preserve formatting
      setTokenAmountDisplay(newAmount);
      setTokenAmount(internalAmount);
    }
  };

  return {
    tokenAmount,
    tokenAmountDisplay,
    fiatAmount,
    fiatAmountDisplay,
    showFiatAmount,
    setShowFiatAmount,
    handleDisplayAmountChange,
    setTokenAmount,
    setFiatAmount,
  };
};

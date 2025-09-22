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
        setTokenAmount(newTokenAmount.toFixed(DEFAULT_DECIMALS));
      } else {
        setTokenAmount("0");
      }
    }
  }, [fiatAmount, tokenPrice, showFiatAmount]);

  /**
   * Handles numeric input and deletion for display-formatted values
   *
   * @param {string} key - The key pressed (number or empty string for delete)
   */
  const handleDisplayAmountChange = (key: string) => {
    if (showFiatAmount) {
      const newAmount = formatNumericInput(fiatAmount, key, FIAT_DECIMALS);
      // Convert locale-formatted input to internal dot notation
      const internalAmount =
        parseDisplayNumber(newAmount).toFixed(FIAT_DECIMALS);
      setFiatAmount(internalAmount);
    } else {
      const newAmount = formatNumericInput(
        tokenAmountDisplay,
        key,
        DEFAULT_DECIMALS,
      );
      // Convert locale-formatted input to internal dot notation
      const internalAmount =
        parseDisplayNumber(newAmount).toFixed(DEFAULT_DECIMALS);
      setTokenAmount(internalAmount);
    }
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

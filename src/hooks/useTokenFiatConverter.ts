import BigNumber from "bignumber.js";
import { DEFAULT_DECIMALS, FIAT_DECIMALS } from "config/constants";
import { PricedBalance } from "config/types";
import {
  formatBigNumberForDisplay,
  parseDisplayNumber,
} from "helpers/formatAmount";
import { formatNumericInput } from "helpers/numericInput";
import { useMemo, useState, useEffect } from "react";
import { getNumberFormatSettings } from "react-native-localize";

interface UseTokenFiatConverterProps {
  selectedBalance: PricedBalance | undefined;
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
  updateFiatDisplay: (amount: string) => void;
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
  const [fiatAmountDisplay, setFiatAmountDisplay] = useState("0");
  const [useFiatAmountInput, setUseFiatAmountInput] = useState(false);

  const formatFiatInputTemplate = (prevValue: string, key: string): string => {
    // Handle delete key - only remove last character, don't reformat
    if (key === "") {
      const newValue = prevValue.slice(0, -1);

      // If the deleted character was a decimal separator, also remove the digit before it
      if (prevValue.endsWith(".") || prevValue.endsWith(",")) {
        return newValue.slice(0, -1);
      }

      return newValue === "" ? "0" : newValue;
    }

    // Handle decimal separator - preserve user's input (comma or dot)
    if (key === "." || key === ",") {
      // Allow only one decimal separator
      if (prevValue.includes(".") || prevValue.includes(",")) {
        return prevValue;
      }
      // Add separator to the value
      return `${prevValue}${key}`;
    }

    // Handle digit keys ("0" - "9")
    if (/^[0-9]$/.test(key)) {
      // Handle leading zero replacement
      if (prevValue === "0") {
        return key; // Replace "0" with the new digit
      }

      // Check if we have a decimal separator and limit decimal places
      const decimalIndex = Math.max(
        prevValue.lastIndexOf("."),
        prevValue.lastIndexOf(","),
      );
      if (decimalIndex !== -1) {
        const decimalPartLength = prevValue.length - decimalIndex - 1;
        if (decimalPartLength >= FIAT_DECIMALS) {
          return prevValue;
        }
      }

      if (prevValue.length >= 20) {
        return prevValue;
      }

      return prevValue + key;
    }

    return prevValue;
  };

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
    if (!useFiatAmountInput && tokenPrice) {
      const bnTokenAmount = new BigNumber(tokenAmount);
      if (bnTokenAmount.isFinite() && !bnTokenAmount.isZero()) {
        const newFiatAmount = tokenPrice.multipliedBy(bnTokenAmount);
        setFiatAmount(newFiatAmount.toFixed(FIAT_DECIMALS));
      } else {
        setFiatAmount("0");
      }
    }
  }, [tokenAmount, tokenPrice, useFiatAmountInput]);

  // Update fiatAmountDisplay when fiatAmount changes in token mode
  useEffect(() => {
    if (!useFiatAmountInput) {
      const { decimalSeparator } = getNumberFormatSettings();
      const displayAmount = fiatAmount.replace(".", decimalSeparator);
      setFiatAmountDisplay(displayAmount);
    }
  }, [fiatAmount, useFiatAmountInput]);

  // Update token amount when fiat amount changes
  useEffect(() => {
    if (useFiatAmountInput && tokenPrice) {
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
  }, [fiatAmount, tokenPrice, useFiatAmountInput]);

  /**
   * Handles numeric input and deletion for display-formatted values
   *
   * @param {string} key - The key pressed (number or empty string for delete)
   */
  const handleDisplayAmountChange = (key: string) => {
    if (useFiatAmountInput) {
      const newAmount = formatFiatInputTemplate(fiatAmountDisplay, key);

      // Check if the new amount exceeds max spendable
      // For fiat input, we need to parse it differently since it's raw input, not locale-formatted
      let internalAmount = newAmount.replace(",", ".");
      // Remove trailing decimal separator for internal value
      if (internalAmount.endsWith(".")) {
        internalAmount = internalAmount.slice(0, -1);
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

      const internalAmount = parseDisplayNumber(newAmount, DEFAULT_DECIMALS);

      // Update display value immediately to preserve formatting
      setTokenAmountDisplay(newAmount);
      setTokenAmount(internalAmount);
    }
  };

  const updateFiatDisplay = (amount: string) => {
    setFiatAmount(amount);
    const { decimalSeparator } = getNumberFormatSettings();
    const displayAmount = amount.replace(".", decimalSeparator);
    setFiatAmountDisplay(displayAmount);
  };

  return {
    tokenAmount,
    tokenAmountDisplay,
    fiatAmount,
    fiatAmountDisplay,
    showFiatAmount: useFiatAmountInput,
    setShowFiatAmount: setUseFiatAmountInput,
    handleDisplayAmountChange,
    setTokenAmount,
    setFiatAmount,
    updateFiatDisplay,
  };
};

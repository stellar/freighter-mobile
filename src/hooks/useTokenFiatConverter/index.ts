import BigNumber from "bignumber.js";
import { DEFAULT_DECIMALS } from "config/constants";
import { PricedBalance } from "config/types";
import { hasDecimals } from "helpers/balances";
import { formatBigNumberForDisplay } from "helpers/formatAmount";
import {
  createTokenFiatConverterReducer,
  initialState,
  TokenFiatConverterActionType,
} from "hooks/useTokenFiatConverter/reducer";
import { useMemo, useReducer, useCallback } from "react";
import { getNumberFormatSettings } from "react-native-localize";

interface UseTokenFiatConverterProps {
  selectedBalance: PricedBalance | undefined;
}

interface UseTokenFiatConverterResult {
  tokenAmount: string; // Internal value (dot notation)
  tokenAmountDisplay: string; // Display value (locale-formatted, derived)
  fiatAmount: string; // Internal value (dot notation)
  fiatAmountDisplay: string; // Display value (locale-formatted, derived or raw input)
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
 * The hook uses useReducer for atomic state updates:
 * - All related state changes happen atomically in a single reducer
 * - Conversions happen synchronously during state updates
 * - Display values are derived via useMemo for performance
 * - Raw input is preserved only when user is actively typing
 *
 * @param {UseTokenFiatConverterProps} props - The hook props
 * @returns {UseTokenFiatConverterResult} The hook result
 */
export const useTokenFiatConverter = ({
  selectedBalance,
}: UseTokenFiatConverterProps): UseTokenFiatConverterResult => {
  const tokenPrice = useMemo(
    () => selectedBalance?.currentPrice || new BigNumber(0),
    [selectedBalance?.currentPrice],
  );

  const decimals = useMemo(
    () =>
      selectedBalance && hasDecimals(selectedBalance)
        ? selectedBalance.decimals
        : DEFAULT_DECIMALS,
    [selectedBalance],
  );

  const reducer = useMemo(
    () => createTokenFiatConverterReducer(tokenPrice, decimals),
    [tokenPrice, decimals],
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  const tokenAmountDisplayDerived = useMemo(
    () =>
      formatBigNumberForDisplay(new BigNumber(state.tokenAmount), {
        decimalPlaces: decimals,
        useGrouping: false,
      }),
    [state.tokenAmount, decimals],
  );

  // Use raw input when user is typing in token mode, otherwise use derived value
  const tokenAmountDisplay =
    !state.showFiatAmount && state.tokenAmountDisplayRaw !== null
      ? state.tokenAmountDisplayRaw
      : tokenAmountDisplayDerived;

  const fiatAmountDisplayDerived = useMemo(() => {
    const { decimalSeparator } = getNumberFormatSettings();
    return state.fiatAmount.replace(".", decimalSeparator);
  }, [state.fiatAmount]);

  // Format fiat display, handling edge cases to always show "0,00" when appropriate
  const formatFiatDisplay = useCallback((rawValue: string | null): string => {
    const { decimalSeparator } = getNumberFormatSettings();
    const zeroFormatted = `0${decimalSeparator}00`;

    // If no raw value, show "0,00"
    if (rawValue === null || rawValue === "") {
      return zeroFormatted;
    }

    // If just "0", show "0,00" to maintain 2 decimal format
    if (rawValue === "0") {
      return zeroFormatted;
    }

    // If just a decimal separator (comma or dot), show "0,00"
    if (rawValue === "," || rawValue === ".") {
      return zeroFormatted;
    }

    // If ",0" or ".0" or "{decimalSeparator}0", show "0,00"
    if (
      rawValue === ",0" ||
      rawValue === ".0" ||
      rawValue === `${decimalSeparator}0`
    ) {
      return zeroFormatted;
    }

    // If "0," or "0." (zero followed by separator), show "0,00"
    if (rawValue === "0," || rawValue === "0.") {
      return zeroFormatted;
    }

    // If "0,0" or "0.0" (zero followed by separator and zero), show "0,00"
    if (rawValue === "0,0" || rawValue === "0.0") {
      return zeroFormatted;
    }

    // Otherwise return the raw value as is (preserve user input like "55,")
    return rawValue;
  }, []);

  const fiatAmountDisplay = useMemo(() => {
    if (state.showFiatAmount && state.fiatAmountDisplayRaw !== null) {
      return formatFiatDisplay(state.fiatAmountDisplayRaw);
    }
    return fiatAmountDisplayDerived;
  }, [
    state.showFiatAmount,
    state.fiatAmountDisplayRaw,
    fiatAmountDisplayDerived,
    formatFiatDisplay,
  ]);

  const handleDisplayAmountChange = useCallback(
    (key: string) => {
      if (state.showFiatAmount) {
        const currentDisplay =
          state.fiatAmountDisplayRaw !== null
            ? state.fiatAmountDisplayRaw
            : fiatAmountDisplayDerived;
        dispatch({
          type: TokenFiatConverterActionType.HANDLE_FIAT_INPUT,
          payload: { key, currentDisplay },
        });
      } else {
        const currentDisplay =
          state.tokenAmountDisplayRaw !== null
            ? state.tokenAmountDisplayRaw
            : tokenAmountDisplayDerived;
        dispatch({
          type: TokenFiatConverterActionType.HANDLE_TOKEN_INPUT,
          payload: { key, currentDisplay },
        });
      }
    },
    [
      state.showFiatAmount,
      state.fiatAmountDisplayRaw,
      state.tokenAmountDisplayRaw,
      fiatAmountDisplayDerived,
      tokenAmountDisplayDerived,
    ],
  );

  const updateFiatDisplay = useCallback((amount: string) => {
    dispatch({
      type: TokenFiatConverterActionType.UPDATE_FIAT_DISPLAY,
      payload: amount,
    });
  }, []);

  const handleSetTokenAmount = useCallback((amount: string) => {
    dispatch({
      type: TokenFiatConverterActionType.SET_TOKEN_AMOUNT,
      payload: amount,
    });
  }, []);

  const handleSetFiatAmount = useCallback((amount: string) => {
    dispatch({
      type: TokenFiatConverterActionType.SET_FIAT_AMOUNT,
      payload: amount,
    });
  }, []);

  const setShowFiatAmount = useCallback((show: boolean) => {
    dispatch({
      type: TokenFiatConverterActionType.SET_SHOW_FIAT_AMOUNT,
      payload: show,
    });
  }, []);

  return {
    tokenAmount: state.tokenAmount,
    tokenAmountDisplay,
    fiatAmount: state.fiatAmount,
    fiatAmountDisplay,
    showFiatAmount: state.showFiatAmount,
    setShowFiatAmount,
    handleDisplayAmountChange,
    setTokenAmount: handleSetTokenAmount,
    setFiatAmount: handleSetFiatAmount,
    updateFiatDisplay,
  };
};

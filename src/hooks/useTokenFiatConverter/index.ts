import BigNumber from "bignumber.js";
import { CLASSIC_TOKEN_MAX_AMOUNT, DEFAULT_DECIMALS } from "config/constants";
import { PricedBalance } from "config/types";
import { hasDecimals } from "helpers/balances";
import { formatBigNumberForDisplay } from "helpers/formatAmount";
import {
  createTokenFiatConverterReducer,
  initialState,
  TokenFiatConverterActionType,
  formatTokenAmountForDisplay,
} from "hooks/useTokenFiatConverter/reducer";
import { useMemo, useReducer, useCallback, useEffect, useRef } from "react";
import { getNumberFormatSettings } from "react-native-localize";

interface UseTokenFiatConverterProps {
  selectedBalance: PricedBalance | undefined;
  tokenDecimals?: number;
}

export interface UseTokenFiatConverterResult {
  tokenAmount: string; // Internal value (dot notation)
  tokenAmountDisplay: string; // Display value (locale-formatted, derived)
  tokenAmountDisplayRaw: string | null; // Raw input when typing
  fiatAmount: string; // Internal value (dot notation)
  fiatAmountDisplay: string; // Display value (locale-formatted, derived or raw input)
  fiatAmountDisplayRaw: string | null; // Raw input when typing
  showFiatAmount: boolean;
  setShowFiatAmount: (show: boolean) => void;
  /** Per-key input from the custom keyboard (Send flow). */
  handleDisplayAmountChange: (key: string) => void;
  setTokenAmount: (amount: string) => void;
  setFiatAmount: (amount: string) => void;
  updateFiatDisplay: (amount: string) => void;
  /** Full-text input from system TextInput.onChangeText (Swap flow). */
  setDisplayAmountFromText: (text: string) => void;
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
  tokenDecimals = DEFAULT_DECIMALS,
}: UseTokenFiatConverterProps): UseTokenFiatConverterResult => {
  const tokenPrice = useMemo(
    () => selectedBalance?.currentPrice || new BigNumber(0),
    [selectedBalance?.currentPrice],
  );

  const decimals = useMemo(
    () =>
      selectedBalance && hasDecimals(selectedBalance)
        ? selectedBalance.decimals
        : tokenDecimals,
    [selectedBalance, tokenDecimals],
  );

  // Classic Stellar tokens have a fixed protocol cap; Soroban / custom
  // tokens (the ones that carry their own `decimals`) don't.
  const maxTokenAmount = useMemo(() => {
    if (selectedBalance && !hasDecimals(selectedBalance)) {
      return new BigNumber(CLASSIC_TOKEN_MAX_AMOUNT);
    }
    return undefined;
  }, [selectedBalance]);

  const reducer = useMemo(
    () => createTokenFiatConverterReducer(tokenPrice, decimals, maxTokenAmount),
    [tokenPrice, decimals, maxTokenAmount],
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  // Track previous token code to detect token changes
  const previousTokenCodeRef = useRef<string | undefined>(
    selectedBalance?.tokenCode,
  );

  // Reset both amounts when the selected token changes. The new token may
  // carry tighter decimal / magnitude constraints than the previous one
  // (e.g. switching from a 7-decimal classic asset to a 3-decimal Soroban
  // token), so preserving the typed value would risk leaving the input in a
  // state the new token's validation would reject. The showFiatAmount mode
  // flag is intentionally preserved.
  useEffect(() => {
    const currentTokenCode = selectedBalance?.tokenCode;
    if (previousTokenCodeRef.current !== currentTokenCode) {
      previousTokenCodeRef.current = currentTokenCode;
      dispatch({ type: TokenFiatConverterActionType.RESET_AMOUNTS });
    }
  }, [selectedBalance]);

  // Fiat mode is meaningless without a price (conversions would divide by
  // zero) and the "$ / token" toggle is hidden for unpriced tokens. If we
  // ever end up in fiat mode without a price — e.g. switching from a priced
  // to an unpriced token, since RESET_AMOUNTS intentionally preserves the
  // mode flag — snap back to token mode so the input doesn't get stuck
  // showing a "$" prefix with no toggle to switch back.
  useEffect(() => {
    if (state.showFiatAmount && tokenPrice.isZero()) {
      dispatch({
        type: TokenFiatConverterActionType.SET_SHOW_FIAT_AMOUNT,
        payload: false,
      });
    }
  }, [state.showFiatAmount, tokenPrice]);

  // Format token amount display: trim trailing zeros and use locale separator when NOT in fiat mode
  const tokenAmountDisplayDerived = useMemo(() => {
    if (state.showFiatAmount) {
      // In fiat mode, use full precision formatting
      return formatBigNumberForDisplay(new BigNumber(state.tokenAmount), {
        decimalPlaces: decimals,
        useGrouping: false,
      });
    }
    // In token mode, trim trailing zeros and use locale separator
    return formatTokenAmountForDisplay(state.tokenAmount);
  }, [state.tokenAmount, state.showFiatAmount, decimals]);

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
      if (key.length > 1) {
        dispatch({
          type: state.showFiatAmount
            ? TokenFiatConverterActionType.SET_FIAT_DISPLAY_FROM_TEXT
            : TokenFiatConverterActionType.SET_TOKEN_DISPLAY_FROM_TEXT,
          payload: key,
        });
        return;
      }

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

  const setDisplayAmountFromText = useCallback((text: string) => {
    dispatch({
      type: TokenFiatConverterActionType.SET_DISPLAY_AMOUNT_FROM_TEXT,
      payload: { text },
    });
  }, []);

  return {
    tokenAmount: state.tokenAmount,
    tokenAmountDisplay,
    tokenAmountDisplayRaw: state.tokenAmountDisplayRaw,
    fiatAmount: state.fiatAmount,
    fiatAmountDisplay,
    fiatAmountDisplayRaw: state.fiatAmountDisplayRaw,
    showFiatAmount: state.showFiatAmount,
    setShowFiatAmount,
    handleDisplayAmountChange,
    setTokenAmount: handleSetTokenAmount,
    setFiatAmount: handleSetFiatAmount,
    updateFiatDisplay,
    setDisplayAmountFromText,
  };
};

import BigNumber from "bignumber.js";
import { DEFAULT_DECIMALS, FIAT_DECIMALS } from "config/constants";
import { parseDisplayNumber } from "helpers/formatAmount";
import { formatNumericInput } from "helpers/numericInput";
import { getNumberFormatSettings } from "react-native-localize";

export interface TokenFiatConverterState {
  tokenAmount: string; // Internal value (dot notation)
  fiatAmount: string; // Internal value (dot notation)
  showFiatAmount: boolean;
  tokenAmountDisplayRaw: string | null; // Raw input when typing
  fiatAmountDisplayRaw: string | null; // Raw input when typing
}

export enum TokenFiatConverterActionType {
  SET_TOKEN_AMOUNT = "SET_TOKEN_AMOUNT",
  SET_FIAT_AMOUNT = "SET_FIAT_AMOUNT",
  SET_SHOW_FIAT_AMOUNT = "SET_SHOW_FIAT_AMOUNT",
  HANDLE_TOKEN_INPUT = "HANDLE_TOKEN_INPUT",
  HANDLE_FIAT_INPUT = "HANDLE_FIAT_INPUT",
  UPDATE_FIAT_DISPLAY = "UPDATE_FIAT_DISPLAY",
  CONVERT_TOKEN_TO_FIAT = "CONVERT_TOKEN_TO_FIAT",
  CONVERT_FIAT_TO_TOKEN = "CONVERT_FIAT_TO_TOKEN",
}

export interface SetTokenAmountAction {
  type: TokenFiatConverterActionType.SET_TOKEN_AMOUNT;
  payload: string;
}

export interface SetFiatAmountAction {
  type: TokenFiatConverterActionType.SET_FIAT_AMOUNT;
  payload: string;
}

export interface SetShowFiatAmountAction {
  type: TokenFiatConverterActionType.SET_SHOW_FIAT_AMOUNT;
  payload: boolean;
}

export interface HandleTokenInputAction {
  type: TokenFiatConverterActionType.HANDLE_TOKEN_INPUT;
  payload: { key: string; currentDisplay: string };
}

export interface HandleFiatInputAction {
  type: TokenFiatConverterActionType.HANDLE_FIAT_INPUT;
  payload: { key: string; currentDisplay: string };
}

export interface UpdateFiatDisplayAction {
  type: TokenFiatConverterActionType.UPDATE_FIAT_DISPLAY;
  payload: string;
}

export interface ConvertTokenToFiatAction {
  type: TokenFiatConverterActionType.CONVERT_TOKEN_TO_FIAT;
  payload: { tokenAmount: string; tokenPrice: BigNumber };
}

export interface ConvertFiatToTokenAction {
  type: TokenFiatConverterActionType.CONVERT_FIAT_TO_TOKEN;
  payload: { fiatAmount: string; tokenPrice: BigNumber };
}

export type TokenFiatConverterAction =
  | SetTokenAmountAction
  | SetFiatAmountAction
  | SetShowFiatAmountAction
  | HandleTokenInputAction
  | HandleFiatInputAction
  | UpdateFiatDisplayAction
  | ConvertTokenToFiatAction
  | ConvertFiatToTokenAction;

export const initialState: TokenFiatConverterState = {
  tokenAmount: "0",
  fiatAmount: "0",
  showFiatAmount: false,
  tokenAmountDisplayRaw: null,
  fiatAmountDisplayRaw: null,
};

/**
 * Normalizes a display value that represents zero to "0" for input handling.
 * Handles various zero formats like "0,00", "0.00", "0,", "0.", "0,0", "0.0", etc.
 * Preserves partial decimal inputs like "0." or "0," to allow decimal entry.
 * Also preserves values like "0,0" and "0,00" that are part of active decimal input
 * (when user is typing digits after the decimal separator).
 *
 * @param {string} displayValue - The display value to normalize
 * @returns {string} "0" if the value represents zero, otherwise the original value
 * @internal - Exported for testing purposes
 */
export const normalizeZeroDisplay = (displayValue: string): string => {
  // Don't normalize if it's a partial decimal input (ends with separator)
  // This allows users to type "0." or "." and then add digits
  if (displayValue.endsWith(".") || displayValue.endsWith(",")) {
    return displayValue;
  }

  // Don't normalize if it's just a decimal separator (user is starting with ".")
  if (displayValue === "." || displayValue === ",") {
    return displayValue;
  }

  // Preserve values like "0,0", "0,00", "0.0", "0.00" etc. that are part of active decimal input
  // These patterns indicate the user is actively typing a decimal value
  // Pattern: starts with "0" followed by separator and one or more zeros (e.g., "0,0", "0,00")
  // OR starts with "0" followed by separator and at least one non-zero digit (e.g., "0,01", "0,1")
  if (/^0[,.]0+$/.test(displayValue) || /^0[,.]0*[1-9]/.test(displayValue)) {
    return displayValue;
  }

  const { decimalSeparator } = getNumberFormatSettings();
  const normalizedForComparison = displayValue
    .replace(",", ".")
    .replace(decimalSeparator, ".");
  const numericValue = new BigNumber(normalizedForComparison || "0");

  // If the numeric value is zero, normalize to "0" for input handling
  return numericValue.isZero() ? "0" : displayValue;
};

/**
 * Calculates token amount from fiat amount.
 *
 * @param {string} fiatAmount - The fiat amount (internal format with dot)
 * @param {BigNumber} tokenPrice - The token price
 * @param {number} tokenDecimals - The number of decimal places for the token
 * @returns {string} The calculated token amount
 * @internal - Exported for testing purposes
 */
export const recalculateTokenAmountFromFiat = (
  fiatAmount: string,
  tokenPrice: BigNumber,
  tokenDecimals: number,
): string => {
  const bnFiatAmount = new BigNumber(fiatAmount || "0");
  if (!bnFiatAmount.isFinite()) {
    return new BigNumber(0).toFixed(tokenDecimals);
  }

  if (tokenPrice.isZero()) {
    return new BigNumber(0).toFixed(tokenDecimals);
  }

  return bnFiatAmount.dividedBy(tokenPrice).toFixed(tokenDecimals);
};

/**
 * Calculates fiat amount from token amount.
 *
 * @param {string} tokenAmount - The token amount
 * @param {BigNumber} tokenPrice - The token price
 * @returns {string} The calculated fiat amount
 * @internal - Exported for testing purposes
 */
export const recalculateFiatAmountFromToken = (
  tokenAmount: string,
  tokenPrice: BigNumber,
): string => {
  const bnTokenAmount = new BigNumber(tokenAmount || "0");
  if (
    !bnTokenAmount.isFinite() ||
    bnTokenAmount.isZero() ||
    tokenPrice.isZero()
  ) {
    return new BigNumber(0).toFixed(FIAT_DECIMALS);
  }

  return tokenPrice.multipliedBy(bnTokenAmount).toFixed(FIAT_DECIMALS);
};

/**
 * Normalizes a display amount to internal amount format.
 * Converts comma to dot and removes trailing decimal separator.
 *
 * @param {string} displayAmount - The display amount (may contain comma or dot)
 * @returns {string} The internal amount (dot notation, no trailing separator)
 * @internal - Exported for testing purposes
 */
export const normalizeInternalAmount = (displayAmount: string): string => {
  let internalAmount = displayAmount.replace(",", ".");
  // Remove trailing decimal separator for internal value
  if (internalAmount.endsWith(".") || internalAmount.endsWith(",")) {
    internalAmount = internalAmount.slice(0, -1);
  }
  return internalAmount;
};

/**
 * Compares two numeric values to determine if they are equal.
 *
 * @param {string} value1 - First value to compare
 * @param {string} value2 - Second value to compare
 * @returns {boolean} True if the numeric values are equal
 * @internal - Exported for testing purposes
 */
export const areNumericValuesEqual = (
  value1: string,
  value2: string,
): boolean => {
  const bn1 = new BigNumber(value1 || "0");
  const bn2 = new BigNumber(value2 || "0");
  return bn1.isEqualTo(bn2);
};

/**
 * Checks if a value contains a decimal separator (comma or dot).
 *
 * @param {string} value - The value to check
 * @returns {boolean} True if the value contains a decimal separator
 * @internal - Exported for testing purposes
 */
export const hasDecimalSeparator = (value: string): boolean =>
  value.includes(".") || value.includes(",");

/**
 * Finds the index of the last decimal separator in a value.
 *
 * @param {string} value - The value to search
 * @returns {number} The index of the last decimal separator, or -1 if not found
 * @internal - Exported for testing purposes
 */
export const getDecimalSeparatorIndex = (value: string): number =>
  Math.max(value.lastIndexOf("."), value.lastIndexOf(","));

/**
 * Calculates the number of decimal places after the decimal separator.
 *
 * @param {string} value - The value to check
 * @returns {number} The number of decimal places
 * @internal - Exported for testing purposes
 */
export const getDecimalPlacesCount = (value: string): number => {
  const decimalIndex = getDecimalSeparatorIndex(value);
  if (decimalIndex === -1) {
    return 0;
  }
  return value.length - decimalIndex - 1;
};

/**
 * Handles delete key input for fiat amounts.
 *
 * @param {string} prevValue - The previous display value
 * @returns {string} The new display value after deletion
 * @internal - Exported for testing purposes
 */
export const handleFiatDeleteKey = (prevValue: string): string => {
  const newValue = prevValue.slice(0, -1);

  // If the deleted character was a decimal separator, also remove the digit before it
  if (prevValue.endsWith(".") || prevValue.endsWith(",")) {
    const result = newValue.slice(0, -1);
    // If result is empty after removing comma/dot and preceding digit, return "0"
    return result === "" ? "0" : result;
  }

  return newValue === "" ? "0" : newValue;
};

/**
 * Handles decimal separator input for fiat amounts.
 *
 * @param {string} prevValue - The previous display value
 * @param {string} key - The decimal separator key ("," or ".")
 * @returns {string} The new display value with separator added, or prevValue if separator already exists
 * @internal - Exported for testing purposes
 */
export const handleFiatDecimalSeparator = (
  prevValue: string,
  key: string,
): string => {
  // Allow only one decimal separator
  if (hasDecimalSeparator(prevValue)) {
    return prevValue;
  }
  // Add separator to the value
  return `${prevValue}${key}`;
};

/**
 * Handles digit key input for fiat amounts.
 *
 * @param {string} prevValue - The previous display value
 * @param {string} key - The digit key ("0" - "9")
 * @returns {string} The new display value with digit added
 * @internal - Exported for testing purposes
 */
export const handleFiatDigitKey = (prevValue: string, key: string): string => {
  // Handle leading zero replacement
  if (prevValue === "0") {
    return key; // Replace "0" with the new digit
  }

  // Check if we have a decimal separator and limit decimal places
  const decimalPlaces = getDecimalPlacesCount(prevValue);
  if (decimalPlaces >= FIAT_DECIMALS) {
    return prevValue; // Max decimal places reached
  }

  // Limit total length
  if (prevValue.length >= 20) {
    return prevValue;
  }

  return prevValue + key;
};

/**
 * Formats fiat input template, handling user input for fiat amounts.
 * Preserves incomplete input like "100," or "100." that can't be parsed yet.
 *
 * @param {string} prevValue - The previous display value
 * @param {string} key - The key pressed (number, decimal separator, or empty string for delete)
 * @returns {string} The new display value
 */
export const formatFiatInputTemplate = (
  prevValue: string,
  key: string,
): string => {
  // Handle delete key - only remove last character, don't reformat
  if (key === "") {
    return handleFiatDeleteKey(prevValue);
  }

  // Handle decimal separator - preserve user's input (comma or dot)
  if (key === "." || key === ",") {
    return handleFiatDecimalSeparator(prevValue, key);
  }

  // Handle digit keys ("0" - "9")
  if (/^[0-9]$/.test(key)) {
    return handleFiatDigitKey(prevValue, key);
  }

  return prevValue;
};

/**
 * Formats token amount to ensure consistent formatting.
 *
 * @param {string} tokenAmount - The token amount to format
 * @param {number} tokenDecimals - The number of decimal places for the token
 * @returns {string} The formatted token amount
 * @internal - Exported for testing purposes
 */
export const formatTokenAmount = (
  tokenAmount: string,
  tokenDecimals: number,
): string => {
  const bnTokenAmount = new BigNumber(tokenAmount);
  return bnTokenAmount.isFinite()
    ? bnTokenAmount.toFixed(tokenDecimals)
    : new BigNumber(0).toFixed(tokenDecimals);
};

/**
 * Determines the fiat amount display raw value when switching to fiat mode.
 * Normalizes display for easier editing (e.g., "2.00" -> "2").
 *
 * @param {string} calculatedFiat - The calculated fiat amount
 * @returns {{ fiatAmount: string; fiatAmountDisplayRaw: string | null }} Object with fiat amount and display raw value
 * @internal - Exported for testing purposes
 */
export const determineFiatDisplayRaw = (
  calculatedFiat: string,
): { fiatAmount: string; fiatAmountDisplayRaw: string | null } => {
  const bnFiat = new BigNumber(calculatedFiat);
  let fiatAmount = calculatedFiat;
  let fiatAmountDisplayRaw: string | null = null;

  if (bnFiat.isInteger() && !bnFiat.isZero()) {
    // If it's a whole number, set display to integer part for easier editing
    fiatAmountDisplayRaw = bnFiat.toFixed(0);
  } else if (bnFiat.isZero()) {
    // If token amount is 0, set fiat to "0" (not "0.00") to allow fresh input
    fiatAmount = "0";
    // Set fiatAmountDisplayRaw to "0" so user can start typing fresh
    fiatAmountDisplayRaw = "0";
  }

  return { fiatAmount, fiatAmountDisplayRaw };
};

/**
 * Creates a reducer function for token/fiat converter state management.
 * All state changes happen atomically in a single reducer.
 *
 * @param {BigNumber} tokenPrice - The current token price for conversions
 * @param {number} tokenDecimals - The number of decimal places for the token
 * @returns {Function} The reducer function
 */
export const createTokenFiatConverterReducer =
  (tokenPrice: BigNumber, tokenDecimals: number = DEFAULT_DECIMALS) =>
  (
    state: TokenFiatConverterState,
    action: TokenFiatConverterAction,
  ): TokenFiatConverterState => {
    switch (action.type) {
      case TokenFiatConverterActionType.SET_TOKEN_AMOUNT: {
        const tokenAmount = action.payload;
        // Convert to fiat if in token mode
        let { fiatAmount } = state;
        if (!state.showFiatAmount && tokenPrice) {
          fiatAmount = recalculateFiatAmountFromToken(tokenAmount, tokenPrice);
        }
        return {
          ...state,
          tokenAmount,
          fiatAmount,
          tokenAmountDisplayRaw: null, // Clear raw input when programmatically setting
        };
      }

      case TokenFiatConverterActionType.SET_FIAT_AMOUNT: {
        const fiatAmount = action.payload;
        // Convert to token if in fiat mode
        let { tokenAmount } = state;
        if (state.showFiatAmount && tokenPrice) {
          tokenAmount = recalculateTokenAmountFromFiat(
            fiatAmount,
            tokenPrice,
            tokenDecimals,
          );
        }
        return {
          ...state,
          tokenAmount,
          fiatAmount,
          fiatAmountDisplayRaw: null, // Clear raw input when programmatically setting
        };
      }

      case TokenFiatConverterActionType.SET_SHOW_FIAT_AMOUNT: {
        const showFiatAmount = action.payload;
        let { tokenAmount } = state;
        let { fiatAmount } = state;
        let fiatAmountDisplayRaw: string | null = null;

        if (showFiatAmount) {
          // Format tokenAmount when switching to fiat mode to ensure consistent formatting
          tokenAmount = formatTokenAmount(state.tokenAmount, tokenDecimals);

          // Convert token amount to fiat
          const calculatedFiat = recalculateFiatAmountFromToken(
            tokenAmount,
            tokenPrice,
          );

          // Determine fiat display raw value (normalize for easier editing)
          const displayResult = determineFiatDisplayRaw(calculatedFiat);
          fiatAmount = displayResult.fiatAmount;
          fiatAmountDisplayRaw = displayResult.fiatAmountDisplayRaw;
        } else {
          // Convert tokenAmount to fiat when switching back to token mode
          fiatAmount = recalculateFiatAmountFromToken(
            state.tokenAmount,
            tokenPrice,
          );
        }

        // Determine final fiatAmountDisplayRaw value
        const finalFiatAmountDisplayRaw: string | null = showFiatAmount
          ? (fiatAmountDisplayRaw ?? state.fiatAmountDisplayRaw)
          : null;

        return {
          ...state,
          showFiatAmount,
          tokenAmount,
          fiatAmount,
          // Clear raw inputs when switching modes
          tokenAmountDisplayRaw: showFiatAmount
            ? null
            : state.tokenAmountDisplayRaw,
          fiatAmountDisplayRaw: finalFiatAmountDisplayRaw,
        };
      }

      case TokenFiatConverterActionType.HANDLE_TOKEN_INPUT: {
        const { key, currentDisplay } = action.payload;
        const newDisplay = formatNumericInput(
          currentDisplay,
          key,
          tokenDecimals,
        );
        const internalAmount = parseDisplayNumber(newDisplay, tokenDecimals);

        // Convert to fiat if in token mode
        let { fiatAmount } = state;
        if (!state.showFiatAmount && tokenPrice && !tokenPrice.isZero()) {
          const bnTokenAmount = new BigNumber(internalAmount);
          if (bnTokenAmount.isFinite() && !bnTokenAmount.isZero()) {
            fiatAmount = recalculateFiatAmountFromToken(
              internalAmount,
              tokenPrice,
            );
          } else {
            fiatAmount = "0";
          }
        }

        return {
          ...state,
          tokenAmount: internalAmount,
          tokenAmountDisplayRaw: newDisplay, // Preserve raw input like "100."
          fiatAmount,
        };
      }

      case TokenFiatConverterActionType.HANDLE_FIAT_INPUT: {
        const { key, currentDisplay } = action.payload;

        // Normalize currentDisplay: if it represents zero (formatted or partial),
        // use "0" as the base for input handling so typing replaces it correctly
        const normalizedDisplay = normalizeZeroDisplay(currentDisplay);
        const newDisplay = formatFiatInputTemplate(normalizedDisplay, key);

        // If the display value didn't change (e.g., max decimals already reached),
        // don't recalculate token amount - return current state
        if (newDisplay === normalizedDisplay && key !== "") {
          return state;
        }

        const internalAmount = normalizeInternalAmount(newDisplay);

        // Compare numeric values to avoid recalculation when only display format changes
        // (e.g., "0.50" -> "0.5" should not recalculate)
        if (areNumericValuesEqual(internalAmount, state.fiatAmount)) {
          return {
            ...state,
            fiatAmount: internalAmount,
            fiatAmountDisplayRaw: newDisplay, // Preserve raw input like "100,"
            // Don't update tokenAmount - keep existing value
          };
        }

        // Convert to token if in fiat mode
        let { tokenAmount } = state;
        if (state.showFiatAmount && tokenPrice) {
          tokenAmount = recalculateTokenAmountFromFiat(
            internalAmount,
            tokenPrice,
            tokenDecimals,
          );
        }

        return {
          ...state,
          fiatAmount: internalAmount,
          fiatAmountDisplayRaw: newDisplay, // Preserve raw input like "100,"
          tokenAmount,
        };
      }

      case TokenFiatConverterActionType.UPDATE_FIAT_DISPLAY: {
        const fiatAmount = action.payload;
        const { decimalSeparator } = getNumberFormatSettings();
        const displayAmount = fiatAmount.replace(".", decimalSeparator);

        // Convert to token if in fiat mode
        let { tokenAmount } = state;
        if (state.showFiatAmount && tokenPrice) {
          tokenAmount = recalculateTokenAmountFromFiat(
            fiatAmount,
            tokenPrice,
            tokenDecimals,
          );
        }

        return {
          ...state,
          fiatAmount,
          fiatAmountDisplayRaw: displayAmount,
          tokenAmount,
        };
      }

      case TokenFiatConverterActionType.CONVERT_TOKEN_TO_FIAT: {
        const { tokenAmount, tokenPrice: price } = action.payload;
        const fiatAmount = recalculateFiatAmountFromToken(tokenAmount, price);

        return {
          ...state,
          tokenAmount,
          fiatAmount,
          tokenAmountDisplayRaw: null,
        };
      }

      case TokenFiatConverterActionType.CONVERT_FIAT_TO_TOKEN: {
        const { fiatAmount, tokenPrice: price } = action.payload;
        const tokenAmount = recalculateTokenAmountFromFiat(
          fiatAmount,
          price,
          tokenDecimals,
        );

        return {
          ...state,
          fiatAmount,
          tokenAmount,
          fiatAmountDisplayRaw: null,
        };
      }

      default:
        return state;
    }
  };

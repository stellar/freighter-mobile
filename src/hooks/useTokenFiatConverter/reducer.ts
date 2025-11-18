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
    const newValue = prevValue.slice(0, -1);

    // If the deleted character was a decimal separator, also remove the digit before it
    if (prevValue.endsWith(".") || prevValue.endsWith(",")) {
      const result = newValue.slice(0, -1);
      // If result is empty after removing comma/dot and preceding digit, return "0"
      return result === "" ? "0" : result;
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
          const bnTokenAmount = new BigNumber(tokenAmount);
          if (
            bnTokenAmount.isFinite() &&
            !bnTokenAmount.isZero() &&
            !tokenPrice.isZero()
          ) {
            fiatAmount = tokenPrice
              .multipliedBy(bnTokenAmount)
              .toFixed(FIAT_DECIMALS);
          } else {
            fiatAmount = new BigNumber(0).toFixed(FIAT_DECIMALS);
          }
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
          const bnFiatAmount = new BigNumber(fiatAmount);
          if (bnFiatAmount.isFinite()) {
            if (tokenPrice.isZero()) {
              tokenAmount = new BigNumber(0).toFixed(tokenDecimals);
            } else {
              tokenAmount = bnFiatAmount
                .dividedBy(tokenPrice)
                .toFixed(tokenDecimals);
            }
          } else {
            tokenAmount = new BigNumber(0).toFixed(tokenDecimals);
          }
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

        if (showFiatAmount) {
          // Format tokenAmount when switching to fiat mode to ensure consistent formatting
          const bnTokenAmount = new BigNumber(state.tokenAmount);
          tokenAmount = bnTokenAmount.isFinite()
            ? bnTokenAmount.toFixed(tokenDecimals)
            : new BigNumber(0).toFixed(tokenDecimals);
        } else {
          // Convert tokenAmount to fiat when switching back to token mode
          const bnTokenAmount = new BigNumber(state.tokenAmount);
          if (
            bnTokenAmount.isFinite() &&
            !bnTokenAmount.isZero() &&
            !tokenPrice.isZero()
          ) {
            fiatAmount = tokenPrice
              .multipliedBy(bnTokenAmount)
              .toFixed(FIAT_DECIMALS);
          } else {
            fiatAmount = new BigNumber(0).toFixed(FIAT_DECIMALS);
          }
        }

        return {
          ...state,
          showFiatAmount,
          tokenAmount,
          fiatAmount,
          // Clear raw inputs when switching modes
          tokenAmountDisplayRaw: showFiatAmount
            ? null
            : state.tokenAmountDisplayRaw,
          fiatAmountDisplayRaw: showFiatAmount
            ? state.fiatAmountDisplayRaw
            : null,
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
            fiatAmount = tokenPrice
              .multipliedBy(bnTokenAmount)
              .toFixed(FIAT_DECIMALS);
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
        const newDisplay = formatFiatInputTemplate(currentDisplay, key);

        let internalAmount = newDisplay.replace(",", ".");
        // Remove trailing decimal separator for internal value
        if (internalAmount.endsWith(".")) {
          internalAmount = internalAmount.slice(0, -1);
        }

        // Convert to token if in fiat mode
        let { tokenAmount } = state;
        if (state.showFiatAmount && tokenPrice) {
          const bnFiatAmount = new BigNumber(internalAmount);
          if (bnFiatAmount.isFinite()) {
            if (tokenPrice.isZero()) {
              tokenAmount = new BigNumber(0).toFixed(tokenDecimals);
            } else {
              tokenAmount = bnFiatAmount
                .dividedBy(tokenPrice)
                .toFixed(tokenDecimals);
            }
          } else {
            tokenAmount = new BigNumber(0).toFixed(tokenDecimals);
          }
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
          const bnFiatAmount = new BigNumber(fiatAmount);
          if (bnFiatAmount.isFinite()) {
            if (tokenPrice.isZero()) {
              tokenAmount = new BigNumber(0).toFixed(tokenDecimals);
            } else {
              tokenAmount = bnFiatAmount
                .dividedBy(tokenPrice)
                .toFixed(tokenDecimals);
            }
          } else {
            tokenAmount = new BigNumber(0).toFixed(tokenDecimals);
          }
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
        const bnTokenAmount = new BigNumber(tokenAmount);
        const fiatAmount =
          bnTokenAmount.isFinite() && !bnTokenAmount.isZero()
            ? price.multipliedBy(bnTokenAmount).toFixed(FIAT_DECIMALS)
            : "0";

        return {
          ...state,
          tokenAmount,
          fiatAmount,
          tokenAmountDisplayRaw: null,
        };
      }

      case TokenFiatConverterActionType.CONVERT_FIAT_TO_TOKEN: {
        const { fiatAmount, tokenPrice: price } = action.payload;
        const bnFiatAmount = new BigNumber(fiatAmount);
        const tokenAmount = bnFiatAmount.isFinite()
          ? (price.isZero()
              ? new BigNumber(0)
              : bnFiatAmount.dividedBy(price)
            ).toFixed(tokenDecimals)
          : "0";

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

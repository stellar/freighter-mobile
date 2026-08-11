import BigNumber from "bignumber.js";

/**
 * Scales a smallest-unit integer amount by a token's decimals.
 *
 * Copied from the browser extension's popup/helpers/soroban.ts so the v2
 * pipeline produces byte-identical amount strings across the two clients.
 * Mobile's formatAmount helpers all assume 7 decimals, which is wrong for
 * SEP-41 tokens.
 *
 * Adopted from ethers.js fixednumber.ts.
 */
export const formatTokenAmount = (amount: BigNumber, decimals: number) => {
  let formatted = amount.toString();

  if (decimals > 0) {
    formatted = amount.shiftedBy(-decimals).toFixed(decimals).toString();

    // Trim trailing zeros
    while (formatted[formatted.length - 1] === "0") {
      formatted = formatted.substring(0, formatted.length - 1);
    }

    if (formatted.endsWith(".")) {
      formatted = formatted.substring(0, formatted.length - 1);
    }
  }

  return formatted;
};

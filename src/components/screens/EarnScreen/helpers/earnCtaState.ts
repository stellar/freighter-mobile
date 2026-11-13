import BigNumber from "bignumber.js";

/**
 * Pure CTA state machine for the deposit amount screen. Precedence matters:
 * each guard short-circuits, so the label reflects the most specific blocker.
 */
export type EarnCtaLabelKey = "enter" | "insufficient" | "review";

export interface EarnCtaInputs {
  /** Spendable balance of the deposit asset, net of reserve and fee. */
  availableBalanceIsZero: boolean;
  amountIsZero: boolean;
  isAmountTooHigh: boolean;
}

export const getEarnCtaState = ({
  availableBalanceIsZero,
  amountIsZero,
  isAmountTooHigh,
}: EarnCtaInputs): { disabled: boolean; labelKey: EarnCtaLabelKey } => {
  // Nothing enterable is valid with zero spendable balance, so surface the
  // blocker directly rather than inviting an amount that cannot work.
  if (availableBalanceIsZero) {
    return { disabled: true, labelKey: "insufficient" };
  }
  if (amountIsZero) {
    return { disabled: true, labelKey: "enter" };
  }
  if (isAmountTooHigh) {
    return { disabled: true, labelKey: "insufficient" };
  }
  return { disabled: false, labelKey: "review" };
};

/**
 * Does the account lack the XLM to pay this transaction's fee?
 *
 * A Soroban invoke's fee is XLM-only and no trustline is involved, so this is
 * simply "spendable XLM < fee".
 *
 * Order this AFTER the CTA's insufficient-funds check: when the deposit asset
 * IS XLM, an unaffordable amount should read as insufficient funds on the
 * button, and this sheet should only fire for an otherwise-affordable amount
 * that leaves no fee headroom.
 */
export const needsXlmForFee = ({
  spendableXlm,
  fee,
}: {
  spendableXlm: string;
  fee: string;
}) => new BigNumber(spendableXlm).lt(new BigNumber(fee));

/**
 * How much XLM a deposit is short of its own network fee, or "0" if it fits.
 *
 * A Blend `submit` is dominated by its resource fee — ~0.0546 XLM against the
 * live pool, roughly 5,000x the inclusion fee — and that figure is only known
 * once simulation returns. Rather than hold a guessed buffer back from the
 * balance (which locks XLM the user may well want to deposit), the deposit
 * screen offers the whole spendable balance and checks the *measured* fee
 * here, after simulation and before the review sheet.
 *
 * `spendableXlm` is expected to come from `calculateSpendableAmount`, which
 * already nets out the base reserve and the inclusion fee, so only the
 * resource fee is left to cover.
 *
 * Only XLM deposits can be short this way: for any other asset the fee comes
 * out of an untouched XLM balance.
 */
export const getXlmFeeShortfall = ({
  spendableXlm,
  amount,
  resourceFee,
}: {
  spendableXlm: string;
  /** Cleaned deposit amount — no group separators. */
  amount: string;
  /** Measured resource fee from simulation, in XLM. */
  resourceFee: string;
}): string => {
  const remaining = new BigNumber(spendableXlm).minus(new BigNumber(amount));
  const shortfall = new BigNumber(resourceFee).minus(remaining);
  return BigNumber.max(shortfall, new BigNumber(0)).toFixed();
};

/**
 * Fallback fee fed to `getXlmFeeShortfall` when simulation did not report a
 * measured resource fee (`sorobanResourceFeeXlm === null` — the backend
 * omitted or returned an unparsable `minResourceFee`).
 *
 * `null` means UNKNOWN, not zero. Feeding "0" in that case would make
 * `getXlmFeeShortfall` report "0" any time `amount <= spendableXlm` — which,
 * given the CTA's own `isAmountTooHigh` guard, is every single time it would
 * be called — silently disabling the shortfall check entirely rather than
 * skipping it visibly. This floor is a stand-in fee, not a stand-in "no fee":
 * it sits comfortably above the ~0.0546 XLM resource fee measured against the
 * live pool, so an unreported fee still gets caught here instead of passing
 * through undetected.
 *
 * This is NOT the removed Max-deposit buffer come back. That buffer applied
 * unconditionally and reduced the amount Max/the percentage buttons offered.
 * This floor applies only on the rare unknown-fee branch of the
 * post-simulation shortfall check — it never changes what amount is
 * enterable.
 */
export const UNKNOWN_RESOURCE_FEE_FLOOR_XLM = "0.1";

/**
 * Does a failed simulation read as "this account cannot cover the transfer"?
 *
 * Deliberately narrow: the Stellar Asset Contract's BalanceError (contract
 * error #10) and the classic insufficient-balance result code are the only
 * signals that mean the amount itself is the problem. Everything else —
 * supply caps, a frozen pool, a stale oracle — must keep surfacing the pool's
 * own message.
 */
export const isInsufficientBalanceFailure = (message: string): boolean =>
  /Error\(Contract, #10\)|insufficient[ _]balance/i.test(message);

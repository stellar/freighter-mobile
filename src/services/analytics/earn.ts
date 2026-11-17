import { AnalyticsEvent } from "config/analyticsConfig";
import { scrubStrKeys } from "helpers/stellarStrKey";
import { track } from "services/analytics/core";

/**
 * Earn (Blend deposit) funnel events. Names and properties match the
 * extension's (`popup/metrics/earn.ts`), so both platforms land in the same
 * Amplitude funnel. Like the deposit events in `transactions.ts`, none carries
 * an amount or a fiat value.
 */

/** How the user chose to get a token they don't hold enough of. */
export type EarnFundingAction = "buy" | "swap" | "transfer";

/**
 * Why the deposit stopped for the XLM fee: no spendable XLM at all, before
 * simulating, or less than the fee simulation measured.
 */
export type EarnXlmFeeReason = "no_xlm" | "fee_not_covered";

/** A held token was picked to deposit. */
export const trackEarnTokenSelected = ({
  assetCode,
  poolId,
  apy,
}: {
  assetCode: string;
  poolId: string;
  apy: number | null;
}): void => {
  track(AnalyticsEvent.EARN_TOKEN_SELECTED, {
    asset_code: assetCode,
    pool_id: poolId,
    apy,
  });
};

/**
 * The "Not enough" sheet opened for a token the user doesn't hold.
 * `variant` names the buttons it shows ("buy-swap-or-transfer" and so on).
 */
export const trackEarnBalanceInsufficientShown = ({
  assetCode,
  variant,
}: {
  assetCode: string;
  variant: string;
}): void => {
  track(AnalyticsEvent.EARN_BALANCE_INSUFFICIENT_SHOWN, {
    asset_code: assetCode,
    variant,
  });
};

/** A button on the "Not enough" sheet was tapped. Receive is "transfer". */
export const trackEarnFundingActionSelected = ({
  assetCode,
  action,
}: {
  assetCode: string;
  action: EarnFundingAction;
}): void => {
  track(AnalyticsEvent.EARN_FUNDING_ACTION_SELECTED, {
    asset_code: assetCode,
    action,
  });
};

/** A swap started from Earn finished successfully. */
export const trackEarnSwapCompleted = ({
  fromAssetCode,
  toAssetCode,
}: {
  fromAssetCode: string;
  toAssetCode: string;
}): void => {
  track(AnalyticsEvent.EARN_SWAP_COMPLETED, {
    from_asset_code: fromAssetCode,
    to_asset_code: toAssetCode,
  });
};

export const trackEarnPoolDetailsOpened = ({
  poolId,
}: {
  poolId: string;
}): void => {
  track(AnalyticsEvent.EARN_POOL_DETAILS_OPENED, { pool_id: poolId });
};

/** Max was tapped on the amount screen; 25% and 50% aren't reported. */
export const trackEarnMaxAmountSelected = ({
  assetCode,
}: {
  assetCode: string;
}): void => {
  track(AnalyticsEvent.EARN_MAX_AMOUNT_SELECTED, {
    asset_code: assetCode,
    percent: 100,
  });
};

export const trackEarnXlmFeeInsufficientShown = ({
  assetCode,
  reason,
}: {
  assetCode: string;
  reason: EarnXlmFeeReason;
}): void => {
  track(AnalyticsEvent.EARN_XLM_FEE_INSUFFICIENT_SHOWN, {
    asset_code: assetCode,
    reason,
  });
};

/**
 * Simulating the deposit failed. As in the extension, `reason_code` is the
 * failure's own message with any Stellar address masked, since a simulation
 * has no result codes to report.
 */
export const trackEarnSimulationFailed = ({
  assetCode,
  message,
}: {
  assetCode: string;
  message: string;
}): void => {
  track(AnalyticsEvent.EARN_SIMULATION_FAILED, {
    asset_code: assetCode,
    reason_code: scrubStrKeys(message) || "unknown",
  });
};

/** The processing screen was closed before the deposit settled. */
export const trackEarnDepositDismissed = ({
  assetCode,
  poolId,
}: {
  assetCode: string;
  poolId: string;
}): void => {
  track(AnalyticsEvent.EARN_DEPOSIT_DISMISSED, {
    asset_code: assetCode,
    pool_id: poolId,
  });
};

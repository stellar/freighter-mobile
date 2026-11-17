import { AnalyticsEvent } from "config/analyticsConfig";
import {
  trackEarnBalanceInsufficientShown,
  trackEarnDepositDismissed,
  trackEarnFundingActionSelected,
  trackEarnMaxAmountSelected,
  trackEarnPoolDetailsOpened,
  trackEarnSimulationFailed,
  trackEarnSwapCompleted,
  trackEarnTokenSelected,
  trackEarnXlmFeeInsufficientShown,
} from "services/analytics/earn";
import { trackEarnDepositSuccess } from "services/analytics/transactions";

jest.mock("services/analytics/core", () => ({
  track: jest.fn(),
}));

const { track } = jest.requireMock("services/analytics/core");

const POOL_ID = "CBAKAZUEJBAFA2DCGBRS2WKJT3FNIMJBHTFL76AY7XMAVEINQNNIQWAO";

// The payloads are the extension's, property for property, so both
// platforms land in one funnel.
describe("Earn funnel events", () => {
  beforeEach(() => {
    track.mockClear();
  });

  it("names every event as the extension does", () => {
    expect({
      tokenSelected: AnalyticsEvent.EARN_TOKEN_SELECTED,
      balanceInsufficientShown: AnalyticsEvent.EARN_BALANCE_INSUFFICIENT_SHOWN,
      fundingActionSelected: AnalyticsEvent.EARN_FUNDING_ACTION_SELECTED,
      swapCompleted: AnalyticsEvent.EARN_SWAP_COMPLETED,
      poolDetailsOpened: AnalyticsEvent.EARN_POOL_DETAILS_OPENED,
      maxAmountSelected: AnalyticsEvent.EARN_MAX_AMOUNT_SELECTED,
      xlmFeeInsufficientShown: AnalyticsEvent.EARN_XLM_FEE_INSUFFICIENT_SHOWN,
      simulationFailed: AnalyticsEvent.EARN_SIMULATION_FAILED,
      depositDismissed: AnalyticsEvent.EARN_DEPOSIT_DISMISSED,
      swapScreen: AnalyticsEvent.VIEW_EARN_SWAP,
    }).toEqual({
      tokenSelected: "earn.token_selected",
      balanceInsufficientShown: "earn.balance_insufficient_shown",
      fundingActionSelected: "earn.funding_action_selected",
      swapCompleted: "earn.swap_completed",
      poolDetailsOpened: "earn.pool_details_opened",
      maxAmountSelected: "earn.max_amount_selected",
      xlmFeeInsufficientShown: "earn.xlm_fee_insufficient_shown",
      simulationFailed: "earn.simulation_failed",
      depositDismissed: "earn.deposit_processing_dismissed",
      swapScreen: "earn_swap_amount",
    });
  });

  it("earn.token_selected", () => {
    trackEarnTokenSelected({ assetCode: "USDC", poolId: POOL_ID, apy: 0.0257 });
    expect(track).toHaveBeenCalledWith("earn.token_selected", {
      asset_code: "USDC",
      pool_id: POOL_ID,
      apy: 0.0257,
    });
  });

  it("earn.balance_insufficient_shown", () => {
    trackEarnBalanceInsufficientShown({
      assetCode: "EURC",
      variant: "swap-or-transfer",
    });
    expect(track).toHaveBeenCalledWith("earn.balance_insufficient_shown", {
      asset_code: "EURC",
      variant: "swap-or-transfer",
    });
  });

  it("earn.funding_action_selected", () => {
    trackEarnFundingActionSelected({ assetCode: "USDC", action: "transfer" });
    expect(track).toHaveBeenCalledWith("earn.funding_action_selected", {
      asset_code: "USDC",
      action: "transfer",
    });
  });

  it("earn.swap_completed", () => {
    trackEarnSwapCompleted({ fromAssetCode: "XLM", toAssetCode: "USDC" });
    expect(track).toHaveBeenCalledWith("earn.swap_completed", {
      from_asset_code: "XLM",
      to_asset_code: "USDC",
    });
  });

  it("earn.pool_details_opened", () => {
    trackEarnPoolDetailsOpened({ poolId: POOL_ID });
    expect(track).toHaveBeenCalledWith("earn.pool_details_opened", {
      pool_id: POOL_ID,
    });
  });

  it("earn.max_amount_selected always reports 100 percent", () => {
    trackEarnMaxAmountSelected({ assetCode: "XLM" });
    expect(track).toHaveBeenCalledWith("earn.max_amount_selected", {
      asset_code: "XLM",
      percent: 100,
    });
  });

  it("earn.xlm_fee_insufficient_shown", () => {
    trackEarnXlmFeeInsufficientShown({
      assetCode: "USDC",
      reason: "fee_not_covered",
    });
    expect(track).toHaveBeenCalledWith("earn.xlm_fee_insufficient_shown", {
      asset_code: "USDC",
      reason: "fee_not_covered",
    });
  });

  it("earn.simulation_failed masks any address in the reason", () => {
    trackEarnSimulationFailed({
      assetCode: "USDC",
      message: `pool ${POOL_ID} is frozen`,
    });
    expect(track).toHaveBeenCalledWith("earn.simulation_failed", {
      asset_code: "USDC",
      reason_code: "pool C*** is frozen",
    });
  });

  it("earn.simulation_failed falls back to unknown without a message", () => {
    trackEarnSimulationFailed({ assetCode: "USDC", message: "" });
    expect(track).toHaveBeenCalledWith("earn.simulation_failed", {
      asset_code: "USDC",
      reason_code: "unknown",
    });
  });

  it("earn.deposit_processing_dismissed", () => {
    trackEarnDepositDismissed({ assetCode: "USDC", poolId: POOL_ID });
    expect(track).toHaveBeenCalledWith("earn.deposit_processing_dismissed", {
      asset_code: "USDC",
      pool_id: POOL_ID,
    });
  });

  it("earn.deposit_completed says whether a swap came first", () => {
    trackEarnDepositSuccess({
      assetCode: "USDC",
      poolId: POOL_ID,
      apy: 0.0257,
      viaSwap: true,
    });
    expect(track).toHaveBeenCalledWith("earn.deposit_completed", {
      asset_code: "USDC",
      pool_id: POOL_ID,
      apy: 0.0257,
      via_swap: true,
    });
  });
});

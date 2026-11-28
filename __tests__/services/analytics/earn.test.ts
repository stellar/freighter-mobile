import BigNumber from "bignumber.js";
import { AnalyticsEvent } from "config/analyticsConfig";
import { PriceFreshness, PriceSource } from "helpers/confirmationPriceSnapshot";
import { AssetKind, deriveLegUsd, FailureCategory } from "helpers/usdVolume";
import {
  trackEarnBalanceInsufficientShown,
  trackEarnDepositDismissed,
  trackEarnFundingActionSelected,
  trackEarnMaxAmountSelected,
  trackEarnPoolDetailsOpened,
  trackEarnSimulationFailed,
  trackEarnTokenSelected,
  trackEarnXlmFeeInsufficientShown,
} from "services/analytics/earn";
import {
  trackEarnDepositFail,
  trackEarnDepositSuccess,
} from "services/analytics/transactions";

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
      poolDetailsOpened: AnalyticsEvent.EARN_POOL_DETAILS_OPENED,
      maxAmountSelected: AnalyticsEvent.EARN_MAX_AMOUNT_SELECTED,
      xlmFeeInsufficientShown: AnalyticsEvent.EARN_XLM_FEE_INSUFFICIENT_SHOWN,
      simulationFailed: AnalyticsEvent.EARN_SIMULATION_FAILED,
      depositDismissed: AnalyticsEvent.EARN_DEPOSIT_DISMISSED,
    }).toEqual({
      tokenSelected: "earn.token_selected",
      balanceInsufficientShown: "earn.balance_insufficient_shown",
      fundingActionSelected: "earn.funding_action_selected",
      poolDetailsOpened: "earn.pool_details_opened",
      maxAmountSelected: "earn.max_amount_selected",
      xlmFeeInsufficientShown: "earn.xlm_fee_insufficient_shown",
      simulationFailed: "earn.simulation_failed",
      depositDismissed: "earn.deposit_processing_dismissed",
    });
  });

  it("earn.token_selected", () => {
    trackEarnTokenSelected({ assetCode: "USDC", poolId: POOL_ID, apy: 0.0257 });
    expect(track).toHaveBeenCalledWith("earn.token_selected", {
      protocol: "blend",
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
      protocol: "blend",
      asset_code: "EURC",
      variant: "swap-or-transfer",
    });
  });

  it("earn.funding_action_selected", () => {
    trackEarnFundingActionSelected({ assetCode: "USDC", action: "transfer" });
    expect(track).toHaveBeenCalledWith("earn.funding_action_selected", {
      protocol: "blend",
      asset_code: "USDC",
      action: "transfer",
    });
  });

  it("earn.pool_details_opened", () => {
    trackEarnPoolDetailsOpened({ poolId: POOL_ID, source: "earn_amount" });
    expect(track).toHaveBeenCalledWith("earn.pool_details_opened", {
      protocol: "blend",
      pool_id: POOL_ID,
      source: "earn_amount",
    });
  });

  it("earn.max_amount_selected always reports 100 percent", () => {
    trackEarnMaxAmountSelected({ assetCode: "XLM" });
    expect(track).toHaveBeenCalledWith("earn.max_amount_selected", {
      protocol: "blend",
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
      protocol: "blend",
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
      protocol: "blend",
      asset_code: "USDC",
      reason_code: "pool C*** is frozen",
    });
  });

  it("earn.simulation_failed falls back to unknown without a message", () => {
    trackEarnSimulationFailed({ assetCode: "USDC", message: "" });
    expect(track).toHaveBeenCalledWith("earn.simulation_failed", {
      protocol: "blend",
      asset_code: "USDC",
      reason_code: "unknown",
    });
  });

  it("earn.deposit_processing_dismissed", () => {
    trackEarnDepositDismissed({ assetCode: "USDC", poolId: POOL_ID });
    expect(track).toHaveBeenCalledWith("earn.deposit_processing_dismissed", {
      protocol: "blend",
      asset_code: "USDC",
      pool_id: POOL_ID,
    });
  });

  // The token, the pool and why; no APY, as in the extension.
  it("earn.deposit_failed", () => {
    trackEarnDepositFail({
      assetCode: "USDC",
      poolId: POOL_ID,
      source: "position_row",
      errorCode: "op_underfunded",
    });
    expect(track).toHaveBeenCalledWith("earn.deposit_failed", {
      protocol: "blend",
      asset_code: "USDC",
      pool_id: POOL_ID,
      source: "position_row",
      reason_code: "op_underfunded",
    });
    expect(track.mock.calls[0][1]).not.toHaveProperty("apy");
  });

  it("earn.deposit_completed says whether a swap came first", () => {
    trackEarnDepositSuccess({
      assetCode: "USDC",
      poolId: POOL_ID,
      source: "home",
      apy: 0.0257,
      viaSwap: true,
    });
    expect(track).toHaveBeenCalledWith("earn.deposit_completed", {
      protocol: "blend",
      asset_code: "USDC",
      pool_id: POOL_ID,
      source: "home",
      apy: 0.0257,
      via_swap: true,
    });
  });
});

// A deposit that reached the network carries its USD volume under
// payment.completed's names, so one SUM(amount_usd) covers deposits too.
describe("Earn deposit volume", () => {
  const USDC_ISSUER = `G${"A".repeat(55)}`;
  const volume = {
    identity: { code: "USDC", issuer: USDC_ISSUER, type: AssetKind.CLASSIC },
    amount: 10,
    sourceLeg: deriveLegUsd("10", new BigNumber("2")),
    priceSource: PriceSource.TOKEN_PRICES_V2,
    priceFreshness: PriceFreshness.CONFIRMATION_FETCH,
  };

  beforeEach(() => {
    track.mockClear();
  });

  it("earn.deposit_completed carries the token's issuer and type, the amount and its USD value", () => {
    trackEarnDepositSuccess({
      assetCode: "USDC",
      poolId: POOL_ID,
      source: "home",
      apy: 0.0257,
      viaSwap: false,
      volume,
    });

    expect(track).toHaveBeenCalledWith("earn.deposit_completed", {
      protocol: "blend",
      asset_code: "USDC",
      asset_issuer: USDC_ISSUER,
      asset_type: "classic",
      pool_id: POOL_ID,
      source: "home",
      apy: 0.0257,
      via_swap: false,
      amount: 10,
      amount_usd: 20,
      amount_usd_status: "ok",
      amount_usd_rate: 2,
      amount_usd_source: "token_prices_v2",
      amount_usd_price_freshness: "confirmation_fetch",
    });
  });

  it("earn.deposit_failed adds the failure category", () => {
    trackEarnDepositFail({
      assetCode: "USDC",
      poolId: POOL_ID,
      source: "home",
      errorCode: "op_underfunded",
      volume: {
        ...volume,
        reasonCode: "op_underfunded",
        failureCategory: FailureCategory.BALANCE,
      },
    });

    expect(track).toHaveBeenCalledWith("earn.deposit_failed", {
      protocol: "blend",
      asset_code: "USDC",
      asset_issuer: USDC_ISSUER,
      asset_type: "classic",
      pool_id: POOL_ID,
      source: "home",
      reason_code: "op_underfunded",
      failure_category: "balance",
      amount: 10,
      amount_usd: 20,
      amount_usd_status: "ok",
      amount_usd_rate: 2,
      amount_usd_source: "token_prices_v2",
      amount_usd_price_freshness: "confirmation_fetch",
    });
  });

  it("reports an unpriced deposit's status, never a USD figure of 0", () => {
    trackEarnDepositSuccess({
      assetCode: "USDC",
      poolId: POOL_ID,
      source: "home",
      apy: 0.0257,
      viaSwap: false,
      volume: { ...volume, sourceLeg: deriveLegUsd("10", null) },
    });

    const props = track.mock.calls[0][1];
    expect(props.amount_usd_status).toBe("no_price");
    expect(props.amount).toBe(10);
    expect(props).not.toHaveProperty("amount_usd");
    expect(props).not.toHaveProperty("amount_usd_rate");
  });

  it("leaves the issuer off an XLM deposit", () => {
    trackEarnDepositSuccess({
      assetCode: "XLM",
      poolId: POOL_ID,
      source: "home",
      apy: 0.0257,
      viaSwap: false,
      volume: { ...volume, identity: { code: "XLM", type: AssetKind.NATIVE } },
    });

    const props = track.mock.calls[0][1];
    expect(props.asset_code).toBe("XLM");
    expect(props.asset_type).toBe("native");
    expect(props).not.toHaveProperty("asset_issuer");
  });
});

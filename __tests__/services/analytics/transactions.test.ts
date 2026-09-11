import BigNumber from "bignumber.js";
import { AnalyticsEvent } from "config/analyticsConfig";
import { PriceFreshness, PriceSource } from "helpers/confirmationPriceSnapshot";
import {
  AssetKind,
  deriveLegUsd,
  FailureCategory,
  LegUsdStatus,
} from "helpers/usdVolume";
import {
  trackInternalSignedTransaction,
  trackInternalSignedTransactionError,
  trackInternalSignedTransactionRejected,
  trackSendPaymentSuccess,
  trackSignedTransaction,
  trackSignedTransactionError,
  trackSignedAuthEntryError,
  trackSignedMessageError,
  trackSwapSuccess,
  trackTransactionError,
} from "services/analytics/transactions";
import { TransactionOperationType } from "services/analytics/types";

jest.mock("services/analytics/core", () => ({
  track: jest.fn(),
}));

const { track } = jest.requireMock("services/analytics/core");

const USDC_ISSUER = `G${"A".repeat(55)}`;
const EURC_ISSUER = `G${"B".repeat(55)}`;

/** A priced source leg: 10 units at $2 => $20.00, status ok. */
const pricedLeg = () => deriveLegUsd("10", new BigNumber("2"));

const classicIdentity = (code: string, issuer: string) => ({
  code,
  issuer,
  type: AssetKind.CLASSIC,
});

const nativeIdentity = () => ({ code: "XLM", type: AssetKind.NATIVE });

const snapshotMeta = {
  priceSource: PriceSource.TOKEN_PRICES_V2,
  priceFreshness: PriceFreshness.CONFIRMATION_FETCH,
};

describe("trackTransactionError reason_code (D1 cross-platform parity)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses the Horizon result code as reason_code when present", () => {
    trackTransactionError({
      error: "GADEADBEEF... op failed: some free text",
      errorCode: "op_underfunded",
      isSwap: true,
      sourceToken: "XLM",
      destToken: "USDC",
    });

    expect(track).toHaveBeenCalledWith(
      AnalyticsEvent.SWAP_FAIL,
      expect.objectContaining({ reason_code: "op_underfunded" }),
    );
  });

  it("falls back to unknown — NOT the free-text message — when no result code is present", () => {
    // Matches the extension's `resultCodes... || "unknown"`. The free-text
    // message (which could carry a StrKey and blows up cardinality) must never
    // become reason_code.
    const freeText = "Signing failed for GABC12345... unexpected error";

    trackTransactionError({
      error: freeText,
      operationType: TransactionOperationType.Payment,
    });

    expect(track).toHaveBeenCalledWith(
      AnalyticsEvent.SEND_PAYMENT_FAIL,
      expect.objectContaining({
        reason_code: "unknown",
        payment_type: "payment",
      }),
    );
    // Explicitly assert the free-text never leaks into reason_code.
    const props = track.mock.calls[0][1];
    expect(props.reason_code).not.toContain(freeText);
  });
});

describe("volume property flattening (Amplitude wire contract)", () => {
  beforeEach(() => jest.clearAllMocks());

  // These assert the exact snake_case property names Amplitude receives.
  // The screen-level tests stop at the `analytics.*` mock boundary and see
  // only the camelCase domain object, so a rename below them would otherwise
  // reach production silently.

  it("payment.completed carries the asset's code, issuer and type together", () => {
    trackSendPaymentSuccess({
      sourceToken: "USDC",
      volume: {
        identity: classicIdentity("USDC", USDC_ISSUER),
        amount: 10,
        sourceLeg: pricedLeg(),
        ...snapshotMeta,
      },
    });

    expect(track).toHaveBeenCalledWith(AnalyticsEvent.SEND_PAYMENT_SUCCESS, {
      payment_type: "payment",
      asset_code: "USDC",
      asset_issuer: USDC_ISSUER,
      asset_type: "classic",
      amount: 10,
      amount_usd: 20,
      amount_usd_status: "ok",
      amount_usd_rate: 2,
      amount_usd_source: "token_prices_v2",
      amount_usd_price_freshness: "confirmation_fetch",
    });
  });

  it("payment.failed carries asset_code even though the call site passes no sourceToken", () => {
    // Regression: the post-submit failure call site supplies only `volume`.
    // asset_code has to come off the classified identity, or the event ships
    // with an issuer and a type but no code.
    trackTransactionError({
      error: "Transaction failed",
      errorCode: "op_underfunded",
      operationType: TransactionOperationType.Payment,
      volume: {
        identity: classicIdentity("USDC", USDC_ISSUER),
        amount: 10,
        sourceLeg: pricedLeg(),
        ...snapshotMeta,
        reasonCode: "op_underfunded",
        failureCategory: FailureCategory.BALANCE,
      },
    });

    expect(track).toHaveBeenCalledWith(AnalyticsEvent.SEND_PAYMENT_FAIL, {
      payment_type: "payment",
      reason_code: "op_underfunded",
      asset_code: "USDC",
      asset_issuer: USDC_ISSUER,
      asset_type: "classic",
      amount: 10,
      failure_category: "balance",
      amount_usd: 20,
      amount_usd_status: "ok",
      amount_usd_rate: 2,
      amount_usd_source: "token_prices_v2",
      amount_usd_price_freshness: "confirmation_fetch",
    });
  });

  it("omits asset_issuer but still emits asset_code for native XLM", () => {
    trackTransactionError({
      error: "Transaction failed",
      operationType: TransactionOperationType.Payment,
      volume: {
        identity: nativeIdentity(),
        amount: 10,
        sourceLeg: pricedLeg(),
        ...snapshotMeta,
        reasonCode: "op_underfunded",
        failureCategory: FailureCategory.BALANCE,
      },
    });

    const props = track.mock.calls[0][1];
    expect(props.asset_code).toBe("XLM");
    expect(props.asset_type).toBe("native");
    expect(props).not.toHaveProperty("asset_issuer");
  });

  it("swap.completed carries both legs, the settled amount and both slippage figures", () => {
    const sourceLeg = pricedLeg();
    trackSwapSuccess({
      sourceToken: "USDC",
      destToken: "EURC",
      isSwap: true,
      volume: {
        identity: classicIdentity("USDC", USDC_ISSUER),
        toIdentity: classicIdentity("EURC", EURC_ISSUER),
        amount: 10,
        sourceLeg,
        ...snapshotMeta,
        toAmount: 9.5,
        toAmountQuoted: 9.6,
        toAmountUsdStatus: LegUsdStatus.OK,
        toAmountUsd: 19.4,
        toAmountUsdRate: 2.042,
        usdSlippagePct: -3,
        executionSlippagePct: -1.04,
      },
    });

    expect(track).toHaveBeenCalledWith(AnalyticsEvent.SWAP_SUCCESS, {
      from_asset_code: "USDC",
      from_asset_issuer: USDC_ISSUER,
      from_asset_type: "classic",
      to_asset_code: "EURC",
      to_asset_issuer: EURC_ISSUER,
      to_asset_type: "classic",
      from_amount: 10,
      to_amount: 9.5,
      to_amount_quoted: 9.6,
      to_amount_usd_status: "ok",
      to_amount_usd: 19.4,
      to_amount_usd_rate: 2.042,
      usd_slippage_pct: -3,
      execution_slippage_pct: -1.04,
      amount_usd: 20,
      amount_usd_status: "ok",
      amount_usd_rate: 2,
      amount_usd_source: "token_prices_v2",
      amount_usd_price_freshness: "confirmation_fetch",
    });
  });

  it("omits the destination USD properties when the destination leg is not ok", () => {
    trackSwapSuccess({
      sourceToken: "USDC",
      destToken: "XYZ",
      isSwap: true,
      volume: {
        identity: classicIdentity("USDC", USDC_ISSUER),
        toIdentity: classicIdentity("XYZ", EURC_ISSUER),
        amount: 10,
        sourceLeg: pricedLeg(),
        ...snapshotMeta,
        toAmount: 9.5,
        toAmountUsdStatus: LegUsdStatus.NO_PRICE,
      },
    });

    const props = track.mock.calls[0][1];
    expect(props.to_amount_usd_status).toBe("no_price");
    expect(props.to_amount).toBe(9.5);
    expect(props).not.toHaveProperty("to_amount_usd");
    expect(props).not.toHaveProperty("to_amount_usd_rate");
    expect(props).not.toHaveProperty("usd_slippage_pct");
    expect(props).not.toHaveProperty("execution_slippage_pct");
  });

  it("swap.failed carries the source leg and both identities but no destination measurement", () => {
    trackTransactionError({
      error: "Swap failed",
      errorCode: "op_under_dest_min",
      isSwap: true,
      sourceToken: "USDC",
      destToken: "EURC",
      volume: {
        identity: classicIdentity("USDC", USDC_ISSUER),
        toIdentity: classicIdentity("EURC", EURC_ISSUER),
        amount: 10,
        sourceLeg: pricedLeg(),
        ...snapshotMeta,
        reasonCode: "op_under_dest_min",
        failureCategory: FailureCategory.SLIPPAGE,
      },
    });

    const props = track.mock.calls[0][1];
    expect(props).toMatchObject({
      from_asset_code: "USDC",
      to_asset_code: "EURC",
      to_asset_type: "classic",
      from_amount: 10,
      reason_code: "op_under_dest_min",
      failure_category: "slippage",
      amount_usd: 20,
    });
    // Nothing settled, so there is nothing to measure on the destination.
    expect(props).not.toHaveProperty("to_amount");
    expect(props).not.toHaveProperty("to_amount_usd");
    expect(props).not.toHaveProperty("to_amount_usd_status");
    expect(props).not.toHaveProperty("to_amount_quoted");
  });

  it("emits the status but no USD figure when the source leg has no price", () => {
    trackSendPaymentSuccess({
      sourceToken: "XYZ",
      volume: {
        identity: classicIdentity("XYZ", USDC_ISSUER),
        amount: 10,
        sourceLeg: deriveLegUsd("10", null),
        ...snapshotMeta,
      },
    });

    const props = track.mock.calls[0][1];
    expect(props.amount_usd_status).toBe("no_price");
    expect(props.amount).toBe(10);
    // Never 0 — a zero would be indistinguishable from a real zero-value
    // transfer in a SUM.
    expect(props).not.toHaveProperty("amount_usd");
    expect(props).not.toHaveProperty("amount_usd_rate");
    expect(props).not.toHaveProperty("amount_usd_source");
    expect(props).not.toHaveProperty("amount_usd_price_freshness");
  });
});

describe("signing-failure reason_code scrubbing (D2 security hygiene)", () => {
  beforeEach(() => jest.clearAllMocks());

  // A 56-char G-StrKey (G + 55 base32 chars) that scrubStrKeys must redact
  // before reason_code reaches Amplitude (a third-party sink).
  const STRKEY = `G${"A".repeat(55)}`;

  it("scrubs StrKeys from signing.message_failed reason_code", () => {
    trackSignedMessageError({ error: `signMessage failed for ${STRKEY}` });

    const props = track.mock.calls[0][1];
    expect(props.reason_code).toBe("signMessage failed for G***");
    expect(props.reason_code).not.toContain(STRKEY);
  });

  it("scrubs StrKeys from signing.auth_entry_failed reason_code", () => {
    trackSignedAuthEntryError({ error: `signAuthEntry failed for ${STRKEY}` });

    const props = track.mock.calls[0][1];
    expect(props.reason_code).toBe("signAuthEntry failed for G***");
    expect(props.reason_code).not.toContain(STRKEY);
  });
});

describe("internal signing events", () => {
  // Internal transactions report signing with the same events a dApp request
  // uses; `source` separates the two. Without these, a wallet-composed
  // transaction reported nothing for the signing action.
  beforeEach(() => {
    (track as jest.Mock).mockClear();
  });

  it("reports an approval with no origin", () => {
    // An internal transaction has no dApp, so `origin` stays off the payload.
    trackInternalSignedTransaction();

    expect(track).toHaveBeenCalledWith(
      AnalyticsEvent.SIGN_TRANSACTION_SUCCESS,
      {
        source: "internal",
      },
    );
  });

  it("reports a rejection with no reason_code", () => {
    // A rejection is a user decision, so nothing went wrong to report.
    trackInternalSignedTransactionRejected();

    expect(track).toHaveBeenCalledWith(AnalyticsEvent.SIGN_TRANSACTION_FAIL, {
      source: "internal",
    });
  });

  it("reports a failure with a reason_code", () => {
    trackInternalSignedTransactionError("Failed to sign transaction");

    expect(track).toHaveBeenCalledWith(AnalyticsEvent.SIGN_TRANSACTION_FAILED, {
      source: "internal",
      reason_code: "Failed to sign transaction",
    });
  });

  it("scrubs Stellar StrKeys out of the failure reason_code", () => {
    // Amplitude is a third-party sink, and a signing error can echo the
    // account it tried to sign as.
    trackInternalSignedTransactionError(`cannot sign as ${USDC_ISSUER}`);

    expect(track).toHaveBeenCalledWith(AnalyticsEvent.SIGN_TRANSACTION_FAILED, {
      source: "internal",
      reason_code: "cannot sign as G***",
    });
  });

  it("falls back to unknown when the failure has no message", () => {
    trackInternalSignedTransactionError(null);

    expect(track).toHaveBeenCalledWith(AnalyticsEvent.SIGN_TRANSACTION_FAILED, {
      source: "internal",
      reason_code: "unknown",
    });
  });

  it("reports a dApp signing failure with a scrubbed reason", () => {
    // A website request can fail to sign for the same reasons a wallet-composed
    // one can. Without this the failure outcome existed for internal
    // transactions only.
    trackSignedTransactionError({
      error: `cannot sign as ${USDC_ISSUER}`,
      dappDomain: "https://example.com/app",
    });

    expect(track).toHaveBeenCalledWith(AnalyticsEvent.SIGN_TRANSACTION_FAILED, {
      source: "dapp_api",
      reason_code: "cannot sign as G***",
      origin: "example.com",
    });
  });

  it("marks a dApp approval with the dapp_api source", () => {
    // Both origins carry `source`, so the two payload shapes stay identical.
    trackSignedTransaction({ dappDomain: "https://example.com/app" });

    expect(track).toHaveBeenCalledWith(
      AnalyticsEvent.SIGN_TRANSACTION_SUCCESS,
      {
        source: "dapp_api",
        origin: "example.com",
      },
    );
  });
});

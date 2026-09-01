import { Asset as SdkToken } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { NATIVE_TOKEN_CODE, NetworkDetails } from "config/constants";
import { Balance, TokenIdentifier } from "config/types";
import { PriceFreshness, PriceSource } from "helpers/confirmationPriceSnapshot";
import { getBalanceByKey, isContractId } from "helpers/soroban";

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------

/**
 * Rounds to 2 decimal places, half-up, in decimal space before converting to
 * a number. Never `Math.round(x * 100) / 100` — that reintroduces binary
 * floating-point error at the half-cent boundary. Mobile's existing
 * `BigNumber#toFixed(2)` already rounds half-up (BigNumber's default mode);
 * its only defect for telemetry is the string return type, which this fixes.
 */
export const roundHalfUp2dp = (value: BigNumber.Value): number =>
  new BigNumber(value).decimalPlaces(2, BigNumber.ROUND_HALF_UP).toNumber();

// ---------------------------------------------------------------------------
// Per-leg USD derivation
// ---------------------------------------------------------------------------

export enum LegUsdStatus {
  OK = "ok",
  NO_PRICE = "no_price",
  ERROR = "error",
}

interface LegUsdOk {
  status: LegUsdStatus.OK;
  /** Rounded to 2dp. */
  value: number;
  /** Unrounded value, used for slippage math — never emitted directly. */
  unrounded: BigNumber;
  /** Snapshot price per unit actually used. */
  rate: number;
}

interface LegUsdUnpriced {
  status: Exclude<LegUsdStatus, LegUsdStatus.OK>;
}

/**
 * Discriminated on `status` so `value`/`unrounded`/`rate` are only reachable
 * once a caller has narrowed to `OK` — an unpriced leg has no partial figure
 * to read by accident.
 */
export type LegUsdResult = LegUsdOk | LegUsdUnpriced;

/**
 * Derives a leg's USD value from its token amount and the snapshot price for
 * its canonical id. A missing price is `no_price`; a price that produces a
 * non-finite result is `error`. Never emits 0 for a missing price — that
 * status is `no_price`/`error`, not a value of 0.
 */
export const deriveLegUsd = (
  tokenAmount: BigNumber.Value | undefined,
  pricePerUnit: BigNumber | null | undefined,
): LegUsdResult => {
  if (pricePerUnit === undefined || pricePerUnit === null) {
    return { status: LegUsdStatus.NO_PRICE };
  }
  try {
    const amount = new BigNumber(tokenAmount ?? NaN);
    const price = new BigNumber(pricePerUnit);
    const unrounded = amount.multipliedBy(price);
    if (!unrounded.isFinite() || !price.isFinite()) {
      return { status: LegUsdStatus.ERROR };
    }
    return {
      status: LegUsdStatus.OK,
      value: roundHalfUp2dp(unrounded),
      unrounded,
      rate: price.toNumber(),
    };
  } catch {
    return { status: LegUsdStatus.ERROR };
  }
};

/**
 * Amplitude props for the source leg, shared by all four terminal events —
 * `amount_usd`-family properties are named identically across events so
 * `SUM(amount_usd)` works regardless of event name.
 */
export const buildSourceLegUsdProps = (
  leg: LegUsdResult,
  source: PriceSource,
  freshness: PriceFreshness,
): Record<string, unknown> => ({
  amount_usd_status: leg.status,
  ...(leg.status === LegUsdStatus.OK
    ? {
        amount_usd: leg.value,
        amount_usd_rate: leg.rate,
        amount_usd_source: source,
        amount_usd_price_freshness: freshness,
      }
    : {}),
});

// ---------------------------------------------------------------------------
// Slippage
// ---------------------------------------------------------------------------

/**
 * `(destUsd - sourceUsd) / sourceUsd * 100`, from unrounded leg values,
 * rounded only at the end. Negative when the user received less USD value
 * than they gave up. `undefined` when the source value is zero (no ratio) —
 * callers additionally gate this on both legs pricing `ok`.
 */
export const computeUsdSlippagePct = (
  sourceUnrounded: BigNumber,
  destUnrounded: BigNumber,
): number | undefined => {
  if (sourceUnrounded.isZero() || !sourceUnrounded.isFinite()) {
    return undefined;
  }
  const pct = destUnrounded
    .minus(sourceUnrounded)
    .dividedBy(sourceUnrounded)
    .times(100);
  return pct.isFinite() ? roundHalfUp2dp(pct) : undefined;
};

/**
 * `(settled - quoted) / quoted * 100`, token-denominated and price-independent.
 * `undefined` when no quote amount was captured or it was zero.
 */
export const computeExecutionSlippagePct = (
  quotedAmount: BigNumber.Value | undefined,
  settledAmount: BigNumber.Value | undefined,
): number | undefined => {
  if (quotedAmount === undefined || settledAmount === undefined) {
    return undefined;
  }
  const quoted = new BigNumber(quotedAmount);
  if (quoted.isZero() || !quoted.isFinite()) {
    return undefined;
  }
  const settled = new BigNumber(settledAmount);
  if (!settled.isFinite()) {
    return undefined;
  }
  const pct = settled.minus(quoted).dividedBy(quoted).times(100);
  return pct.isFinite() ? roundHalfUp2dp(pct) : undefined;
};

// ---------------------------------------------------------------------------
// Asset identity + SAC collapse
// ---------------------------------------------------------------------------

export enum AssetKind {
  NATIVE = "native",
  CLASSIC = "classic",
  SOROBAN = "soroban",
}

export interface AssetIdentity {
  code: string;
  /** `G…` classic issuer or `C…` Soroban-native contract. Omitted for native XLM. */
  issuer?: string;
  type: AssetKind;
}

/**
 * Classifies an asset for telemetry, collapsing a classic asset moved via its
 * SAC back to its classic identity. A wrapper over `getBalanceByKey` — the
 * same SAC-derivation loop the balance pickers already use to match a `C…`
 * address back to a held classic (or native) balance — rather than a fresh
 * copy, so a future fix to SAC matching only needs to land in one place.
 *
 * Classification is by derivation, not heuristic: `getBalanceByKey` derives
 * each candidate classic balance's SAC address and compares it to the
 * contract in hand. A genuine Soroban/SEP-41 holding is not misclassified —
 * its `token.issuer.key` is itself a contract id (see `mapSep41` in
 * `mapAccountBalancesV2.ts`), so it never satisfies `!isContractId(...)`.
 *
 * Correctness depends on the caller only ever passing a `C…` address for an
 * asset the account actually holds (so its classic form is findable in
 * `balances`), or on `balances` being fresh — a SAC-wrapped classic asset the
 * account does NOT hold, passed as a raw `C…` issuer, is misreported as
 * `soroban` with no signal that anything went wrong. Today's callers satisfy
 * this: the source leg is always drawn from a held-balance picker, and the
 * swap destination leg is always pre-normalized to a classic `G…` issuer
 * before it reaches this function (the destination picker's classic-only
 * filter).
 */
export const classifyAssetIdentity = (
  code: string,
  issuer: string | undefined,
  networkDetails: NetworkDetails,
  balances?: Balance[],
): AssetIdentity => {
  if (!issuer) {
    return { code, type: AssetKind.NATIVE };
  }

  if (!isContractId(issuer)) {
    return { code, issuer, type: AssetKind.CLASSIC };
  }

  try {
    // Checked independently of `balances`: XLM moved via the native SAC must
    // collapse to native even when the queried balance list doesn't happen
    // to include a native entry (getBalanceByKey's own native check only
    // fires when iterating an actual native balance).
    if (
      SdkToken.native().contractId(networkDetails.networkPassphrase) === issuer
    ) {
      return { code, type: AssetKind.NATIVE };
    }

    const match = getBalanceByKey(issuer, balances ?? [], networkDetails);
    if (match && "token" in match) {
      if (match.token.code === NATIVE_TOKEN_CODE) {
        return { code, type: AssetKind.NATIVE };
      }
      if ("issuer" in match.token && !isContractId(match.token.issuer.key)) {
        return {
          code,
          issuer: match.token.issuer.key,
          type: AssetKind.CLASSIC,
        };
      }
    }
  } catch {
    // Derivation failed (e.g. an invalid code) — fall through and report the
    // contract as Soroban-native rather than throwing out of a telemetry path.
  }

  return { code, issuer, type: AssetKind.SOROBAN };
};

/** The canonical id used to key a `TokenPricesMap` lookup for an identity. */
export const canonicalIdFromIdentity = (
  identity: AssetIdentity,
): TokenIdentifier =>
  identity.issuer ? `${identity.code}:${identity.issuer}` : NATIVE_TOKEN_CODE;

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

export enum FailureCategory {
  SLIPPAGE = "slippage",
  FEE = "fee",
  BALANCE = "balance",
  TRUSTLINE = "trustline",
  DESTINATION = "destination",
  SEQUENCE = "sequence",
  AUTH = "auth",
  TRANSPORT = "transport",
  PROTOCOL_OTHER = "protocol_other",
  UNKNOWN = "unknown",
}

const REASON_CODE_TO_FAILURE_CATEGORY: Record<string, FailureCategory> = {
  op_under_dest_min: FailureCategory.SLIPPAGE,
  op_too_few_offers: FailureCategory.SLIPPAGE,
  tx_insufficient_fee: FailureCategory.FEE,
  op_underfunded: FailureCategory.BALANCE,
  tx_insufficient_balance: FailureCategory.BALANCE,
  op_low_reserve: FailureCategory.BALANCE,
  op_no_trust: FailureCategory.TRUSTLINE,
  op_src_no_trust: FailureCategory.TRUSTLINE,
  op_line_full: FailureCategory.TRUSTLINE,
  op_not_authorized: FailureCategory.TRUSTLINE,
  op_src_not_authorized: FailureCategory.TRUSTLINE,
  op_no_issuer: FailureCategory.TRUSTLINE,
  op_invalid_limit: FailureCategory.TRUSTLINE,
  op_no_destination: FailureCategory.DESTINATION,
  tx_bad_seq: FailureCategory.SEQUENCE,
  tx_too_late: FailureCategory.SEQUENCE,
  tx_too_early: FailureCategory.SEQUENCE,
  tx_bad_auth: FailureCategory.AUTH,
  tx_bad_auth_extra: FailureCategory.AUTH,
  tx_no_source_account: FailureCategory.AUTH,
};

/**
 * True for an HTTP status that never judges the transaction itself: the
 * outcome is undetermined (5xx — the submission may still have been
 * ingested; 408 — timed out) or the request was turned away before Horizon
 * evaluated it (429 rate limit, 403 proxy rejection). These are `transport`,
 * not `unknown`: a body arrived, but no verdict did.
 */
const isNoVerdictHttpStatus = (status: number): boolean =>
  status >= 500 || status === 408 || status === 429 || status === 403;

/**
 * Maps a Horizon `reason_code` to a bounded `failure_category`. Mirrors the
 * extension's `getFailureCategory`, adapted to the primitives
 * `transactionBuilder`'s submit catch block actually exposes —
 * `isProtocolAnswer` (did a genuine Horizon problem+json body come back, as
 * opposed to a network/fetch exception with no response at all) and the raw
 * HTTP status — rather than the caught error object itself, since the store
 * only keeps serializable state.
 *
 * Bucket assignment prioritizes `transport` (submission never got a verdict
 * on the transaction) over the reason-code table: a `reasonCode` of
 * `"unknown"` is ambiguous between "Horizon rejected it with something we
 * don't recognize" and "we never got a verdict at all". `transport` covers
 * both no-answer and answered-without-a-verdict (5xx/408/429/403 with no
 * `result_codes`); `unknown` is reserved for a definitive 4xx rejection that
 * carried no result codes.
 */
export const getFailureCategory = (
  isProtocolAnswer: boolean,
  httpStatus: number | null,
  reasonCode: string,
): FailureCategory => {
  if (!isProtocolAnswer) {
    return FailureCategory.TRANSPORT;
  }
  if (reasonCode === "unknown") {
    if (httpStatus !== null && isNoVerdictHttpStatus(httpStatus)) {
      return FailureCategory.TRANSPORT;
    }
    return FailureCategory.UNKNOWN;
  }
  return (
    REASON_CODE_TO_FAILURE_CATEGORY[reasonCode] ??
    FailureCategory.PROTOCOL_OTHER
  );
};

/**
 * Picks the reason code that actually explains a failure out of a Horizon
 * result-codes payload. A swap prepending a `changeTrust` operation reports
 * one code per operation (e.g. `["op_success", "op_under_dest_min"]`) — the
 * first code that isn't a no-op success/skip marker isn't always index 0.
 */
export const pickReasonCode = (
  resultCodes:
    | { transaction?: string; operations?: string[] }
    | null
    | undefined,
): string =>
  resultCodes?.operations?.find(
    (op) => op !== "op_success" && op !== "op_not_attempted",
  ) ||
  resultCodes?.transaction ||
  "unknown";

import BigNumber from "bignumber.js";
import { NATIVE_TOKEN_CODE } from "config/constants";
import {
  Balance,
  BalanceMap,
  ClassicBalance,
  LiquidityPoolBalance,
  NativeBalance,
  SorobanBalance,
} from "config/types";

// ---------------------------------------------------------------------------
// freighter-backend-v2 `POST /accounts/balances` wire types.
// All keys are snake_case — this mirrors the REST response types in
// freighter-backend-v2 internal/types/account_balances.go verbatim. `total`
// is the on-ledger amount and `available` is the server-computed spendable
// portion (total minus the reserved amount for native/classic; equal to
// total for contract tokens and pool shares). `key` and `token` are the
// server-derived v1 balance-map key and token identity, so clients index
// balances without re-deriving them.
// ---------------------------------------------------------------------------

export type V2TokenType =
  | "NATIVE"
  | "CLASSIC"
  | "SAC"
  | "SEP41"
  | "LIQUIDITY_POOL";

export interface V2TokenIssuer {
  key: string;
}

// v1-pattern token identity. `type` is omitted for SEP-41 tokens and `issuer`
// is omitted for the native asset, matching the v1 shapes.
export interface V2Token {
  type?: string;
  code: string;
  issuer?: V2TokenIssuer;
}

export interface V2BalanceBase {
  // v1-format balance-map key: "native" / "CODE:ISSUER" /
  // "SYMBOL:CONTRACT_ID" / "POOLID:lp".
  key: string;
  // Present on every variant except LIQUIDITY_POOL (LP shares carry no token
  // in v1). Each variant below narrows it to what the server guarantees.
  token?: V2Token;
  total: string;
  available: string;
  token_id: string;
  token_type: V2TokenType;
}

export interface V2NativeBalance extends V2BalanceBase {
  token_type: "NATIVE";
  token: { type: "native"; code: "XLM" };
  // Base reserve requirement (excludes liabilities):
  // (2 + numSubentries + numSponsoring - numSponsored) * baseReserve.
  minimum_balance: string;
  buying_liabilities: string;
  selling_liabilities: string;
  last_modified_ledger?: number;
}

export interface V2ClassicBalance extends V2BalanceBase {
  token_type: "CLASSIC";
  // `type` is the trustline's asset type verbatim (e.g. credit_alphanum4).
  token: { type: string; code: string; issuer: V2TokenIssuer };
  code?: string;
  issuer?: string;
  type: string;
  limit: string;
  buying_liabilities: string;
  selling_liabilities: string;
  last_modified_ledger?: number;
  is_authorized: boolean;
  is_authorized_to_maintain_liabilities: boolean;
}

export interface V2SacBalance extends V2BalanceBase {
  token_type: "SAC";
  // `type` is derived server-side from the code length (credit_alphanum4/12).
  token: { type: string; code: string; issuer: V2TokenIssuer };
  code: string;
  issuer: string;
  decimals: number;
  is_authorized?: boolean;
  is_clawback_enabled?: boolean;
}

// `total` is the raw i128 amount as a decimal string, NOT scaled by
// `decimals` — display logic scales it.
export interface V2Sep41Balance extends V2BalanceBase {
  token_type: "SEP41";
  // A pure SEP-41 token has no classic asset type; `issuer.key` is the
  // contract id.
  token: { code: string; issuer: V2TokenIssuer };
  name?: string;
  symbol?: string;
  decimals: number;
  last_modified_ledger?: number;
}

export interface V2LiquidityPoolReserve {
  asset: string;
  amount: string;
}

export interface V2LiquidityPoolBalance extends V2BalanceBase {
  token_type: "LIQUIDITY_POOL";
  token?: undefined;
  liquidity_pool_id: string;
  reserves: V2LiquidityPoolReserve[];
  last_modified_ledger?: number;
}

export type V2Balance =
  | V2NativeBalance
  | V2ClassicBalance
  | V2SacBalance
  | V2Sep41Balance
  | V2LiquidityPoolBalance;

export interface V2AccountBalances {
  address: string;
  is_funded: boolean;
  subentry_count: number;
  balances: V2Balance[];
}

export interface MappedAccountBalances {
  balances: BalanceMap;
  isFunded: boolean;
  subentryCount: number;
}

/**
 * Normalizes a freighter-backend-v2 `/accounts/balances` per-account result
 * into the `BalanceMap` shape the app consumes everywhere. Keeping the output
 * identical to what `fetchBalances` (the v1 path) returns means the balances
 * store, priced-balance pipeline, and every screen need no changes.
 *
 * This is a MINIMAL adapter: it bridges every rename/reshape and leaves the
 * truly backend-dependent fields at safe defaults until the v2 API provides
 * them:
 *   - `blockaidData` → undefined (stamped client-side by
 *     `addBlockaidScanResults`, mirroring what the v1 backend does
 *     server-side)
 *
 * `total` and `available` are both server-provided and converted to BigNumber
 * here, matching the `bigize` pass on the v1 path.
 *
 * The balance-map `key` and the `token` identity are server-provided (v1
 * conventions: `"native"` / `"<code>:<issuer>"` / `"<symbol>:<contractId>"` /
 * `"<liquidityPoolId>:lp"` — the formats `sortBalances`,
 * `getTokenIdentifier`, and the priced-balances pipeline rely on) and pass
 * through verbatim, with one exception: the native entry is re-keyed from the
 * server's `"native"` to `"XLM"`, the app convention — the same rename
 * `fetchBalances` applies on the v1 path.
 */

interface MappedEntry {
  key: string;
  value: Balance;
}

const mapNative = (b: V2NativeBalance): MappedEntry => ({
  // The server keys native `"native"` (v1 convention); the app keys it "XLM".
  key: NATIVE_TOKEN_CODE,
  value: {
    token: b.token,
    total: new BigNumber(b.total),
    available: new BigNumber(b.available),
    minimumBalance: new BigNumber(b.minimum_balance),
    buyingLiabilities: b.buying_liabilities,
    sellingLiabilities: b.selling_liabilities,
  } as NativeBalance,
});

const mapClassic = (b: V2ClassicBalance): MappedEntry => ({
  key: b.key,
  value: {
    token: b.token,
    total: new BigNumber(b.total),
    available: new BigNumber(b.available),
    limit: new BigNumber(b.limit || "0"),
    buyingLiabilities: b.buying_liabilities,
    sellingLiabilities: b.selling_liabilities,
  } as ClassicBalance,
});

// A SAC balance is a classic asset (code + G-address issuer) held via
// contract. The server pre-formats `total` as decimal (like classic), so we
// map it to a classic-shaped balance rather than the Soroban shape — the
// Soroban display path re-scales by `decimals`, which would double-scale an
// already-formatted SAC amount. No trustline exists on a SAC (available =
// total server-side, and there is no limit — emit "0" like an absent v2
// limit; no consumer reads it).
const mapSac = (b: V2SacBalance): MappedEntry => ({
  key: b.key,
  value: {
    token: b.token,
    total: new BigNumber(b.total),
    available: new BigNumber(b.available),
    limit: new BigNumber("0"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
  } as ClassicBalance,
});

// A pure SEP-41 token maps to the Soroban shape: `total` is a raw i128 that
// display logic scales by `decimals`. `token.issuer.key` is the contract id,
// matching the v1 custom-token convention.
const mapSep41 = (b: V2Sep41Balance): MappedEntry => ({
  key: b.key,
  value: {
    token: b.token,
    contractId: b.token_id,
    total: new BigNumber(b.total),
    available: new BigNumber(b.available),
    symbol: b.symbol || "",
    name: b.name || "",
    decimals: b.decimals,
  } as SorobanBalance,
});

// LP shares map to the legacy `<poolId>:lp` entry: no token identity, just
// the share total plus the pool's constituent reserves ({asset, amount}[]),
// which is the same shape as Horizon's Reserve[] that `getLPShareCode` reads.
// v2 carries no pool-share limit; emit 0 — no consumer reads it.
const mapLiquidityPool = (b: V2LiquidityPoolBalance): MappedEntry => ({
  key: b.key,
  value: {
    liquidityPoolId: b.liquidity_pool_id,
    total: new BigNumber(b.total),
    available: new BigNumber(b.available),
    limit: new BigNumber("0"),
    reserves: b.reserves,
  } as LiquidityPoolBalance,
});

export const mapAccountBalancesV2 = (
  account: V2AccountBalances,
): MappedAccountBalances => {
  const balances = {} as BalanceMap;
  const v2Balances = account.balances || [];

  v2Balances.forEach((balance) => {
    let entry: MappedEntry | null = null;
    switch (balance.token_type) {
      case "NATIVE":
        entry = mapNative(balance);
        break;
      case "CLASSIC":
        entry = mapClassic(balance);
        break;
      case "SAC":
        entry = mapSac(balance);
        break;
      case "SEP41":
        entry = mapSep41(balance);
        break;
      case "LIQUIDITY_POOL":
        entry = mapLiquidityPool(balance);
        break;
      default:
        // Unknown token type — skip rather than emit a malformed entry.
        entry = null;
    }
    if (entry) {
      balances[entry.key] = entry.value;
    }
  });

  return {
    balances,
    // Envelope fields come straight from the v2 response. The backend
    // guarantees an entry per requested address (unfunded accounts arrive as
    // is_funded: false), and the caller rejects responses missing the
    // requested account before mapping.
    isFunded: account.is_funded,
    subentryCount: account.subentry_count,
  };
};

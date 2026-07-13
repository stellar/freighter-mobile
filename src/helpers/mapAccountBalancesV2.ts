import { AssetType as SdkAssetType } from "@stellar/stellar-sdk";
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
// freighter-backend-v2 internal/types/account_balances.go verbatim. `balance`
// is the on-ledger amount and `available` is the server-computed spendable
// portion (balance minus the reserved amount for native/classic; equal to
// balance for contract tokens and pool shares).
// ---------------------------------------------------------------------------

export type V2TokenType =
  | "NATIVE"
  | "CLASSIC"
  | "SAC"
  | "SEP41"
  | "LIQUIDITY_POOL";

export interface V2BalanceBase {
  balance: string;
  available: string;
  token_id: string;
  token_type: V2TokenType;
}

export interface V2NativeBalance extends V2BalanceBase {
  token_type: "NATIVE";
  // Base reserve requirement (excludes liabilities):
  // (2 + numSubentries + numSponsoring - numSponsored) * baseReserve.
  minimum_balance: string;
  buying_liabilities: string;
  selling_liabilities: string;
  last_modified_ledger?: number;
}

export interface V2ClassicBalance extends V2BalanceBase {
  token_type: "CLASSIC";
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
  code: string;
  issuer: string;
  decimals: number;
  is_authorized?: boolean;
  is_clawback_enabled?: boolean;
}

// `balance` is the raw i128 amount as a decimal string, NOT scaled by
// `decimals` — display logic scales it.
export interface V2Sep41Balance extends V2BalanceBase {
  token_type: "SEP41";
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
 * `total` and `available` are both server-provided (`balance`/`available`)
 * and converted to BigNumber here, matching the `bigize` pass on the v1 path.
 *
 * Key formats match the v1 conventions that `sortBalances`,
 * `getTokenIdentifier`, and the priced-balances pipeline rely on:
 *   - native → `"XLM"` (v1 responses key it `"native"`; `fetchBalances`
 *     renames it — here we emit the app convention directly)
 *   - classic / SAC → `"<code>:<issuer>"`
 *   - SEP-41 token → `"<symbol>:<contractId>"`
 *   - liquidity-pool share → `"<liquidityPoolId>:lp"`
 */

const classicAssetType = (code: string): SdkAssetType =>
  (code.length > 4 ? "credit_alphanum12" : "credit_alphanum4") as SdkAssetType;

interface MappedEntry {
  key: string;
  value: Balance;
}

const mapNative = (b: V2NativeBalance): MappedEntry => ({
  key: NATIVE_TOKEN_CODE,
  value: {
    token: { type: "native", code: NATIVE_TOKEN_CODE },
    total: new BigNumber(b.balance),
    available: new BigNumber(b.available),
    minimumBalance: new BigNumber(b.minimum_balance),
    buyingLiabilities: b.buying_liabilities,
    sellingLiabilities: b.selling_liabilities,
  } as NativeBalance,
});

const mapClassic = (b: V2ClassicBalance): MappedEntry => {
  const code = b.code || "";
  const issuer = b.issuer || "";
  return {
    key: `${code}:${issuer}`,
    value: {
      token: {
        type: classicAssetType(code),
        code,
        issuer: { key: issuer },
      },
      total: new BigNumber(b.balance),
      available: new BigNumber(b.available),
      limit: new BigNumber(b.limit || "0"),
      buyingLiabilities: b.buying_liabilities,
      sellingLiabilities: b.selling_liabilities,
    } as ClassicBalance,
  };
};

// A SAC balance is a classic asset (code + G-address issuer) held via
// contract. The server pre-formats `balance` as decimal (like classic), so we
// map it to a classic-shaped balance rather than the Soroban shape — the
// Soroban display path re-scales by `decimals`, which would double-scale an
// already-formatted SAC amount. No trustline exists on a SAC (available =
// balance server-side, and there is no limit — emit "0" like an absent v2
// limit; no consumer reads it).
const mapSac = (b: V2SacBalance): MappedEntry => ({
  key: `${b.code}:${b.issuer}`,
  value: {
    token: {
      type: classicAssetType(b.code),
      code: b.code,
      issuer: { key: b.issuer },
    },
    total: new BigNumber(b.balance),
    available: new BigNumber(b.available),
    limit: new BigNumber("0"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
  } as ClassicBalance,
});

// A pure SEP-41 token maps to the Soroban shape: `balance` is a raw i128 that
// display logic scales by `decimals`. `issuer.key` is the contract id,
// matching the v1 custom-token convention.
const mapSep41 = (b: V2Sep41Balance): MappedEntry => {
  const symbol = b.symbol || "";
  const name = b.name || "";
  return {
    key: `${symbol}:${b.token_id}`,
    value: {
      token: { code: symbol, issuer: { key: b.token_id } },
      contractId: b.token_id,
      total: new BigNumber(b.balance),
      available: new BigNumber(b.available),
      symbol,
      name,
      decimals: b.decimals,
    } as SorobanBalance,
  };
};

// LP shares map to the legacy `<poolId>:lp` entry: no token identity, just
// the share total plus the pool's constituent reserves ({asset, amount}[]),
// which is the same shape as Horizon's Reserve[] that `getLPShareCode` reads.
// v2 carries no pool-share limit; emit 0 — no consumer reads it.
const mapLiquidityPool = (b: V2LiquidityPoolBalance): MappedEntry => ({
  key: `${b.liquidity_pool_id}:lp`,
  value: {
    liquidityPoolId: b.liquidity_pool_id,
    total: new BigNumber(b.balance),
    available: new BigNumber(b.available),
    limit: new BigNumber("0"),
    reserves: b.reserves,
  } as LiquidityPoolBalance,
});

export const mapAccountBalancesV2 = (
  account: V2AccountBalances | undefined,
): MappedAccountBalances => {
  const balances = {} as BalanceMap;
  const v2Balances = account?.balances || [];

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
    // Envelope fields come straight from the v2 response; an account missing
    // from the fan-out result reads as unfunded.
    isFunded: account?.is_funded ?? false,
    subentryCount: account?.subentry_count ?? 0,
  };
};

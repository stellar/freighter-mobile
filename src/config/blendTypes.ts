/* -------------------------------------------------------------------------- */
/* GET /protocols/blend/earn-options                                          */
/* -------------------------------------------------------------------------- */

export interface ApiBlendEarnPool {
  id: string;
  name: string | null;
  supply_apy: number | null;
  emissions_supply_apr: number | null;
  supplied_usd: number | null;
}

export interface ApiBlendEarnAssetOption {
  asset_id: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  /** Ordered by supplied USD descending (unpriced last). */
  pools: ApiBlendEarnPool[];
}

export interface ApiBlendEarnOptionsCatalog {
  options: ApiBlendEarnAssetOption[];
}

export interface BlendEarnPool {
  id: string;
  name: string | null;
  supplyApy: number | null;
  emissionsSupplyApr: number | null;
  suppliedUsd: number | null;
}

export interface BlendEarnAssetOption {
  /** The reserve's asset contract address — a SAC for every current reserve. */
  assetId: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  pools: BlendEarnPool[];
}

/* -------------------------------------------------------------------------- */
/* GET /protocols/blend/pools                                                 */
/* -------------------------------------------------------------------------- */

export interface ApiBlendCatalogReserve {
  asset_id: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  enabled: boolean;
  utilization: number | null;
  supply_apy: number | null;
  borrow_apy: number | null;
  emissions_supply_apr: number | null;
  supplied_usd: number | null;
  borrowed_usd: number | null;
  price_usd: number | null;
}

export interface ApiBlendCatalogPool {
  id: string;
  name: string | null;
  status: string | null;
  supplied_usd: number | null;
  borrowed_usd: number | null;
  interest_apy: number | null;
  net_apy: number | null;
  /**
   * Optional, unlike its siblings: the backend does not serve this field yet.
   * Absent and null both mean "unavailable" to the UI.
   */
  backstop_usd?: number | null;
  reserves: ApiBlendCatalogReserve[];
}

export interface ApiBlendPoolsCatalog {
  pools: ApiBlendCatalogPool[];
}

export interface BlendCatalogReserve {
  assetId: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  /** The reserve's own on/off flag, independent of pool status. */
  enabled: boolean;
  utilization: number | null;
  supplyApy: number | null;
  borrowApy: number | null;
  emissionsSupplyApr: number | null;
  suppliedUsd: number | null;
  borrowedUsd: number | null;
  priceUsd: number | null;
}

export interface BlendCatalogPool {
  id: string;
  name: string | null;
  /**
   * Upstream enum name: ADMIN_ACTIVE, ACTIVE, ADMIN_ON_ICE, ON_ICE,
   * ADMIN_FROZEN, FROZEN, SETUP. The first four accept deposits. Null until the
   * pool's config has been ingested.
   */
  status: string | null;
  suppliedUsd: number | null;
  borrowedUsd: number | null;
  /** Supplied-USD-weighted supply rate, interest only. */
  interestApy: number | null;
  /** As `interestApy`, plus BLND emissions. Supply-side, not netted against borrow. */
  netApy: number | null;
  /** Null while unserved or unpriceable; `0` is a real zero. */
  backstopUsd: number | null;
  reserves: BlendCatalogReserve[];
}

/* -------------------------------------------------------------------------- */
/* POST /accounts/positions                                                   */
/* -------------------------------------------------------------------------- */

export interface ApiBlendSupplyRow {
  asset_id: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  /** Plain-supply portion, collateral portion, and their sum. All raw units. */
  supplied_tokens: string;
  collateral_tokens: string;
  total_tokens: string;
  usd_value: number | null;
  apy: number | null;
  emissions_apr: number | null;
  interest_earned: string;
  interest_earned_usd: number | null;
  claimable_blnd: string;
  claimable_usd: number | null;
  price_usd: number | null;
}

export interface ApiBlendBorrowRow {
  asset_id: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  borrowed_tokens: string;
  usd_value: number | null;
  apy: number | null;
  emissions_apr: number | null;
  price_usd: number | null;
}

export interface ApiBlendPositionDetail {
  supply: ApiBlendSupplyRow[];
  borrow: ApiBlendBorrowRow[];
}

export interface ApiPoolPosition {
  protocol: string;
  /** The pool's contract address. */
  id: string;
  name: string | null;
  net_usd: number | null;
  supplied_usd: number | null;
  borrowed_usd: number | null;
  net_apy: number | null;
  blend?: ApiBlendPositionDetail;
}

export interface ApiAccountPositions {
  address: string;
  total_value_usd: number | null;
  net_apy: number | null;
  /** Always non-nil; empty for accounts with no positions or unknown upstream. */
  positions: ApiPoolPosition[];
}

/** One supplied token in a pool, as the app uses it. */
export interface BlendSupplyPosition {
  assetId: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  /**
   * Plain supply plus collateral, in raw units. Deposits use SupplyCollateral,
   * so the plain-supply bucket alone would read zero.
   */
  totalTokens: string;
  /** Null when the token has no fresh price: unknown, not zero. */
  usdValue: number | null;
  /** Supply interest rate, without emissions; null when unavailable. */
  apy: number | null;
  emissionsApr: number | null;
  /** Interest accrued on the position, in raw units. */
  interestEarned: string;
  interestEarnedUsd: number | null;
  priceUsd: number | null;
}

/** The account's position in one pool. */
export interface BlendPoolPosition {
  /** Always "blend" today. */
  protocol: string;
  /** The pool's contract address. */
  poolId: string;
  name: string | null;
  netUsd: number | null;
  suppliedUsd: number | null;
  /** As the backend reports it, BLND emissions included. */
  netApy: number | null;
  /**
   * Null when the backend sent no Blend detail for the pool: unknown, which
   * is not the same as an empty list.
   */
  supply: BlendSupplyPosition[] | null;
}

export interface BlendAccountPositions {
  totalValueUsd: number | null;
  /** Empty for an account with no positions, or one the indexer doesn't know. */
  positions: BlendPoolPosition[];
}

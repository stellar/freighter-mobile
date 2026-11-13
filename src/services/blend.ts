import {
  ApiAccountPositions,
  ApiBlendCatalogPool,
  ApiBlendCatalogReserve,
  ApiBlendEarnAssetOption,
  ApiBlendEarnOptionsCatalog,
  ApiBlendEarnPool,
  ApiBlendPoolsCatalog,
  BlendCatalogPool,
  BlendCatalogReserve,
  BlendEarnAssetOption,
  BlendEarnPool,
} from "config/blendTypes";
import { NetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { freighterBackendV2 } from "services/backend";

/**
 * Clients for freighter-backend-v2's Blend endpoints.
 *
 * `networkDetails.network` is already exactly "PUBLIC" / "TESTNET" (the NETWORKS
 * enum), which is what the handler validates against. Networks outside those two
 * are rejected with a 400 — callers should gate on `isEarnSupportedNetwork`
 * rather than relying on the error.
 */

const mapEarnPool = (pool: ApiBlendEarnPool): BlendEarnPool => ({
  id: pool.id,
  name: pool.name,
  supplyApy: pool.supply_apy,
  emissionsSupplyApr: pool.emissions_supply_apr,
  suppliedUsd: pool.supplied_usd,
});

const mapEarnAssetOption = (
  option: ApiBlendEarnAssetOption,
): BlendEarnAssetOption => ({
  assetId: option.asset_id,
  symbol: option.symbol,
  name: option.name,
  decimals: option.decimals,
  pools: (option.pools || []).map(mapEarnPool),
});

const mapCatalogReserve = (
  reserve: ApiBlendCatalogReserve,
): BlendCatalogReserve => ({
  assetId: reserve.asset_id,
  symbol: reserve.symbol,
  name: reserve.name,
  decimals: reserve.decimals,
  enabled: reserve.enabled,
  utilization: reserve.utilization,
  supplyApy: reserve.supply_apy,
  borrowApy: reserve.borrow_apy,
  emissionsSupplyApr: reserve.emissions_supply_apr,
  suppliedUsd: reserve.supplied_usd,
  borrowedUsd: reserve.borrowed_usd,
  priceUsd: reserve.price_usd,
});

const mapCatalogPool = (pool: ApiBlendCatalogPool): BlendCatalogPool => ({
  id: pool.id,
  name: pool.name,
  status: pool.status,
  suppliedUsd: pool.supplied_usd,
  borrowedUsd: pool.borrowed_usd,
  interestApy: pool.interest_apy,
  netApy: pool.net_apy,
  // Normalised to null while the backend still omits the field, so callers have
  // one "unavailable" case to render rather than two.
  backstopUsd: pool.backstop_usd ?? null,
  reserves: (pool.reserves || []).map(mapCatalogReserve),
});

/**
 * Assets that can be deposited into a Blend pool, with each pool's headline
 * rate. Already filtered by the backend's operator-curated allowlist.
 *
 * Auth-signing note: this call passes `network` via axios's `params` option
 * rather than folding it into the URL string (as the browser-extension
 * original does). That is safe with this app's interceptor —
 * `attachAuth.ts`'s `deriveServerPath` signs `instance.getUri(config)`, which
 * is axios's own baseURL+url+params join, i.e. pathname *plus* query string.
 * So the signed `methodAndPath` already includes `?network=...` by
 * construction, same as the extension; a `params` object cannot produce a
 * signature/wire-path mismatch here. (This has not been confirmed against a
 * live backend — freighter-backend-v2's Blend routes are only on its
 * `main-blend` branch, not deployed to dev/stg/prd — but it is settled from
 * reading `attachAuth.ts` + `buildAuthJwt.ts`.)
 */
export const getBlendEarnOptions = async ({
  networkDetails,
}: {
  networkDetails: NetworkDetails;
}): Promise<BlendEarnAssetOption[]> => {
  const { data } = await freighterBackendV2.get<{
    data?: ApiBlendEarnOptionsCatalog;
  }>("/protocols/blend/earn-options", {
    params: { network: networkDetails.network },
  });

  // A 200 without a `data` payload is still a failure — returning undefined
  // would violate the return contract.
  if (!data?.data) {
    logger.error("getBlendEarnOptions", "Missing data envelope", data);
    throw new Error("Failed to fetch Blend earn options");
  }

  return (data.data.options || []).map(mapEarnAssetOption);
};

/**
 * The full pool catalog — unfiltered by the earn allowlist. Powers the pool
 * details sheet's Lending Interest / Current Net APY / Supplied / Borrowed rows.
 */
export const getBlendPools = async ({
  networkDetails,
}: {
  networkDetails: NetworkDetails;
}): Promise<BlendCatalogPool[]> => {
  const { data } = await freighterBackendV2.get<{
    data?: ApiBlendPoolsCatalog;
  }>("/protocols/blend/pools", {
    params: { network: networkDetails.network },
  });

  if (!data?.data) {
    logger.error("getBlendPools", "Missing data envelope", data);
    throw new Error("Failed to fetch Blend pools");
  }

  return (data.data.pools || []).map(mapCatalogPool);
};

/**
 * The account's existing supplied balance for one (pool, asset), in raw token
 * units. This is the "before" side of the Review screen's `0.00 -> 500.00`.
 *
 * Reads `total_tokens` — the sum of the plain-supply and collateral buckets.
 * Deposits use SupplyCollateral, so the balance lands in `collateral_tokens` and
 * reading `supplied_tokens` would always report zero.
 *
 * Returns "0" for an account with no position, which is indistinguishable by
 * design from an account unknown to the indexer.
 *
 * Callers should treat a rejection as non-fatal and render the "after" value
 * alone — a stale before-value must never block a deposit.
 */
export const getBlendSuppliedTokens = async ({
  publicKey,
  poolId,
  assetId,
  networkDetails,
}: {
  publicKey: string;
  poolId: string;
  assetId: string;
  networkDetails: NetworkDetails;
}): Promise<string> => {
  const { data } = await freighterBackendV2.post<{
    data?: ApiAccountPositions[];
  }>(
    "/accounts/positions",
    { addresses: [publicKey] },
    { params: { network: networkDetails.network } },
  );

  if (!data?.data) {
    logger.error("getBlendSuppliedTokens", "Missing data envelope", data);
    throw new Error("Failed to fetch Blend positions");
  }

  // The endpoint is a batch: `data` is an array with one entry per requested
  // address, so unwrap the single element we asked for.
  const supplyRow = data.data[0]?.positions
    ?.find((position) => position.id === poolId)
    ?.blend?.supply?.find((row) => row.asset_id === assetId);

  return supplyRow?.total_tokens || "0";
};

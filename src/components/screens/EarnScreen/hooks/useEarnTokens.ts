import BigNumber from "bignumber.js";
import { getBlendPoolId } from "config/blend";
import { BlendCatalogPool, BlendEarnAssetOption } from "config/blendTypes";
import {
  DEFAULT_DECIMALS,
  mapNetworkToNetworkDetails,
  NetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import { PricedBalance, PricedBalanceMap } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useEarnStore } from "ducks/earn";
import { getBalanceByContractId } from "helpers/balances";
import { getNativeContractDetails } from "helpers/soroban";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getBlendEarnOptions, getBlendPools } from "services/blend";

/** One row in the picker. */
export interface EarnTokenOption {
  /** The reserve's asset contract address (a SAC for every current reserve). */
  assetId: string;
  code: string;
  decimals: number;
  /** Raw total in display units, "0" when the account holds none. */
  total: string;
  /**
   * Headline rate as a decimal fraction (0.1694 = 16.94%), or null when the
   * pool oracle has no fresh price and the rate is genuinely unknown.
   */
  apy: number | null;
  poolId: string;
  /**
   * The catalog's canonical asset id -- "CODE:ISSUER" for classic assets,
   * null for native XLM (and for anything the catalog leaves unnamed).
   *
   * Carried because Earn's reserves are addressed by SAC contract id, but
   * swapping into one is classic-only (`pathPaymentStrictSend` rejects
   * contract-id assets), so the swap destination has to be rebuilt from the
   * issuer. `assetId` cannot supply it -- a SAC address is not decomposable
   * back into code + issuer.
   */
  canonicalId: string | null;
  /**
   * True when this reserve's contract address is the network's native SAC.
   * Decided by comparing `assetId` to the derived native contract address —
   * NEVER by `code === "XLM"` — because any issuer can mint a classic asset
   * coded "XLM" (the same trap `getBalanceByContractId` guards against).
   * Lets `EarnTokenRow` build the right `TokenIcon` input without a held
   * balance to read the real token shape from.
   */
  isNative: boolean;
  /**
   * The held balance backing this row, when any. Carries the real Token
   * shape so the row renders the exact icon instead of reconstructing one
   * from catalog data alone. Undefined for zero-balance rows.
   */
  balance?: PricedBalance;
}

/**
 * The earn headline is supply interest plus BLND emissions.
 *
 * A null `supplyApy` means no fresh oracle price, so the whole rate is unknown.
 * A null `emissionsSupplyApr` means the stream exists but cannot be priced —
 * treated as zero here, which understates rather than blanking an otherwise
 * known rate. The screen's "*APY is an estimate" footnote covers the gap.
 */
export const headlineApy = (
  supplyApy: number | null,
  emissionsSupplyApr: number | null,
) => (supplyApy === null ? null : supplyApy + (emissionsSupplyApr ?? 0));

/**
 * Partitions the catalog into held and zero-balance rows.
 *
 * Exported and dependency-injected (`findBalance`) so the partitioning rules
 * can be tested without a React tree or a network.
 */
export const buildEarnTokenRows = ({
  options,
  poolId,
  balances,
  networkDetails,
  findBalance = getBalanceByContractId,
}: {
  options: BlendEarnAssetOption[];
  poolId: string;
  balances: PricedBalanceMap;
  networkDetails: NetworkDetails;
  findBalance?: (
    contractId: string,
    balances: PricedBalanceMap,
    networkDetails: NetworkDetails,
  ) => PricedBalance | undefined;
}) => {
  const held: EarnTokenOption[] = [];
  const supported: EarnTokenOption[] = [];

  const nativeContractId = getNativeContractDetails(
    networkDetails.network,
  ).contract;

  options.forEach((option) => {
    const offer = option.pools.find((pool) => pool.id === poolId);
    if (!offer) {
      return;
    }

    const balance = findBalance(option.assetId, balances, networkDetails);
    const total = balance?.total ? new BigNumber(balance.total) : null;

    // `symbol` is null for native XLM on the live catalog, so it cannot be the
    // only source of the display code — taking it alone renders the row with no
    // token code at all. `name` is deliberately NOT a candidate: for classic
    // assets the catalog returns the canonical there ("USDC:GA5ZSEJY…"), not a
    // friendly name.
    const balanceCode = balance && "token" in balance ? balance.token.code : "";
    const code =
      option.symbol || balanceCode || `${option.assetId.slice(0, 4)}…`;

    const row: EarnTokenOption = {
      assetId: option.assetId,
      code,
      decimals: option.decimals ?? DEFAULT_DECIMALS,
      total: total ? total.toFixed() : "0",
      apy: headlineApy(offer.supplyApy, offer.emissionsSupplyApr),
      poolId: offer.id,
      canonicalId: option.name,
      isNative: option.assetId === nativeContractId,
      balance,
    };

    if (total && total.gt(0)) {
      held.push(row);
    } else {
      supported.push(row);
    }
  });

  return { held, supported };
};

export const useEarnTokens = () => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { pricedBalances } = useBalancesStore();
  const setPool = useEarnStore((state) => state.setPool);

  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  /**
   * The fetched catalog, kept RAW.
   *
   * Rows are derived from it separately (below) rather than being built here,
   * because they also depend on `pricedBalances` -- which the balances store
   * repolls every 30s. Folding that into the fetch made `fetchData` a new
   * callback on every poll, re-running the effect, flipping `isLoading` back
   * to true, and unmounting this screen (and every bottom sheet mounted under
   * it) on a 30-second cadence. Deriving instead keeps the network call tied
   * to the account/network only.
   */
  const [catalog, setCatalog] = useState<{
    options: BlendEarnAssetOption[];
    poolId: string;
    pool: BlendCatalogPool | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [earnOptions, pools] = await Promise.all([
        getBlendEarnOptions({ networkDetails }),
        getBlendPools({ networkDetails }),
      ]);

      // The backend's allowlist should already have narrowed this to the Fixed
      // pool, but pin it to our own constant too: a drifted allowlist would
      // otherwise silently offer deposits into a pool the flow never vetted.
      const poolId = getBlendPoolId(networkDetails);
      if (!poolId) {
        // Defensive only: Home gates the Earn entry point on
        // isEarnSupportedNetwork, so this should be unreachable in practice.
        throw new Error("Earn is not supported on this network");
      }

      const resolvedPool = pools.find((p) => p.id === poolId) || null;

      setCatalog({ options: earnOptions, poolId, pool: resolvedPool });
      setPool(resolvedPool);
    } catch (err) {
      logger.error("useEarnTokens", "Failed to fetch earn tokens", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [networkDetails, setPool]);

  useEffect(() => {
    if (account?.publicKey && network) {
      fetchData();
    }
  }, [account?.publicKey, network, fetchData]);

  // Re-derived whenever balances change, so a deposit or swap moves a row
  // between sections immediately -- with no refetch and no remount.
  const { held, supported } = useMemo(() => {
    if (!catalog) {
      return { held: [], supported: [] };
    }
    return buildEarnTokenRows({
      options: catalog.options,
      poolId: catalog.poolId,
      balances: pricedBalances,
      networkDetails,
    });
  }, [catalog, pricedBalances, networkDetails]);

  return {
    isLoading,
    error,
    held,
    supported,
    pool: catalog?.pool ?? null,
    refetch: fetchData,
  };
};

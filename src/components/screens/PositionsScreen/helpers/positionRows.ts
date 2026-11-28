import { StrKey } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { parseCanonicalAsset } from "components/screens/EarnScreen/helpers/earnSwapDestination";
import { BlendPoolPosition, BlendSupplyPosition } from "config/blendTypes";
import {
  DEFAULT_DECIMALS,
  NATIVE_TOKEN_CODE,
  NetworkDetails,
} from "config/constants";
import { getNativeContractDetails, getTokenSacAddress } from "helpers/soroban";

/** One supplied token on a pool's position screen. */
export interface PositionTokenRow {
  poolId: string;
  poolName: string | null;
  protocol: string;
  assetId: string;
  code: string;
  /** A classic token's issuer, or a Soroban-only token's own contract. */
  issuer?: string;
  isNative: boolean;
  /** Null when the token's scale is unknown (see `getSupplyRowIdentity`). */
  decimals: number | null;
  /** Display units, already scaled by `decimals`; null when that is unknown. */
  suppliedTokens: string | null;
  suppliedUsd: number | null;
  /** Supply interest rate, without emissions; null when genuinely unknown. */
  apy: number | null;
}

/** Whether `assetId` is the SAC of the classic asset `canonical` names. */
const isSacOf = (
  classic: { code: string; issuer: string } | null,
  assetId: string,
  networkPassphrase: string,
) => {
  if (!classic) {
    return false;
  }
  try {
    return (
      getTokenSacAddress(classic.code, classic.issuer, networkPassphrase) ===
      assetId
    );
  } catch {
    return false;
  }
};

/**
 * A supply row's token: its code, issuer, decimals and whether it's native
 * XLM. Every Positions figure names its token through this, as the extension
 * does:
 * - native XLM arrives with a null symbol AND a null name, so it is known by
 *   its SAC, never by a code the backend might report;
 * - the code falls back through the symbol, the classic canonical's code and
 *   "XLM" for the native SAC, then the contract's first characters;
 * - a token with no classic asset behind it (SEP-41) that names itself has
 *   its own contract as issuer, as the contract tokens an account holds do;
 * - the decimals are the payload's, else 7 for a SAC or native XLM, whose
 *   contracts always use 7. A Soroban-only token can use any scale, so
 *   without the payload's it is unknown: scaling it by 7 would misstate every
 *   amount by orders of magnitude.
 */
export const getSupplyRowIdentity = (
  row: Pick<BlendSupplyPosition, "assetId" | "symbol" | "name" | "decimals">,
  networkDetails: NetworkDetails,
) => {
  const classic = parseCanonicalAsset(row.name);
  const isNative =
    row.assetId === getNativeContractDetails(networkDetails.network).contract;
  const code =
    row.symbol ||
    classic?.code ||
    (isNative ? NATIVE_TOKEN_CODE : "") ||
    `${row.assetId.slice(0, 4)}…`;
  const isContractToken =
    !classic &&
    !isNative &&
    !!row.name &&
    !!(row.symbol || classic) &&
    StrKey.isValidContract(row.assetId);
  const issuer = classic?.issuer || (isContractToken ? row.assetId : undefined);

  let decimals: number | null = row.decimals ?? null;
  if (
    decimals === null &&
    (isNative ||
      isSacOf(classic, row.assetId, networkDetails.networkPassphrase))
  ) {
    decimals = DEFAULT_DECIMALS;
  }

  return { code, issuer, decimals, isNative };
};

/**
 * An integer amount in the token's smallest unit, in display units. Null when
 * either the amount or the token's decimals are unknown.
 */
export const toDisplayTokens = (
  raw: string | null,
  decimals: number | null,
): string | null =>
  raw === null || decimals === null
    ? null
    : new BigNumber(raw).shiftedBy(-decimals).toFixed();

/** The supplied tokens of one pool, one row each, carrying the pool they're in. */
export const toPositionTokenRows = ({
  position,
  networkDetails,
}: {
  position: BlendPoolPosition;
  networkDetails: NetworkDetails;
}): PositionTokenRow[] =>
  (position.supply || []).map((row) => {
    const { code, issuer, decimals, isNative } = getSupplyRowIdentity(
      row,
      networkDetails,
    );

    return {
      poolId: position.poolId,
      poolName: position.name,
      protocol: position.protocol,
      assetId: row.assetId,
      code,
      issuer,
      isNative,
      decimals,
      suppliedTokens: toDisplayTokens(row.totalTokens, decimals),
      suppliedUsd: row.usdValue,
      // Interest only: BLND emissions are left out, as everywhere in Earn.
      apy: row.apy,
    };
  });

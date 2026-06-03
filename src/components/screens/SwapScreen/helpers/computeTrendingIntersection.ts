/* eslint-disable no-underscore-dangle */
import { formatClassicRecord } from "components/screens/SwapScreen/helpers/formatClassicRecord";
import {
  isClassicTokenType,
  isSorobanRecord,
} from "components/screens/SwapScreen/hooks/useSwapTokenLookup";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { FormattedSearchTokenRecord, SearchTokenResponse } from "config/types";
import { getTokenType } from "helpers/balances";
import { TokenListReponseItem } from "services/verified-token-lists/types";

/** Canonical CODE:ISSUER identifier used for dedupe across sources. */
const canonicalId = (tokenCode: string, issuer: string): string =>
  `${tokenCode.toLowerCase()}:${(issuer ?? "").toLowerCase()}`;

/**
 * Pure derivation: take the raw stellar.expert top-50 response plus the
 * SDF verified-tokens list and produce the classic-only intersection
 * formatted for the Swap UI.
 *
 * Steps:
 *   1. Drop Soroban records (custom contract tokens).
 *   2. Drop records that fail the classic-only filter (LP shares,
 *      malformed asset strings).
 *   3. Format each surviving record (sets hasTrustline via the callback).
 *   4. Dedupe by canonical CODE:ISSUER, preserving stellar.expert's order.
 *   5. Intersect with verified issuers (native XLM is always considered
 *      verified — matches splitVerifiedTokens' policy).
 */
export const computeTrendingIntersection = (
  topTokensResp: SearchTokenResponse,
  verifiedTokens: TokenListReponseItem[],
  hasExistingTrustline: (tokenCode: string, issuer: string) => boolean,
): FormattedSearchTokenRecord[] => {
  const verifiedIds = new Set<string>();
  verifiedTokens.forEach((vt) => {
    if (vt.issuer) verifiedIds.add(vt.issuer.toLowerCase());
    if (vt.contract) verifiedIds.add(vt.contract.toLowerCase());
  });

  const records = topTokensResp._embedded?.records ?? [];

  const classicRecords = records.filter((r) => {
    if (isSorobanRecord(r)) return false;
    const [tokenCode, issuer] = r.asset.split("-");
    if (!issuer && r.asset !== NATIVE_TOKEN_CODE) return false;
    const tokenType = getTokenType(
      issuer ? `${tokenCode}:${issuer}` : NATIVE_TOKEN_CODE,
    );
    return isClassicTokenType(tokenType);
  });

  const formatted = classicRecords.map((r) => {
    const [tokenCode, issuer] = r.asset.split("-");
    return formatClassicRecord(
      r,
      hasExistingTrustline(tokenCode, issuer ?? ""),
    );
  });

  const seen = new Set<string>();
  const deduped = formatted.filter((t) => {
    const id = canonicalId(t.tokenCode, t.issuer);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // Intersect with verified issuers + always allow native XLM.
  return deduped.filter((t) => {
    if (t.isNative || t.tokenCode === NATIVE_TOKEN_CODE) return true;
    const issuer = t.issuer?.toLowerCase();
    return !!issuer && verifiedIds.has(issuer);
  });
};

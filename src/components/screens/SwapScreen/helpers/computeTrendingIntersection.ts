/* eslint-disable no-underscore-dangle */
import { canonicalId } from "components/screens/SwapScreen/helpers/canonicalId";
import { formatSearchRecord } from "components/screens/SwapScreen/helpers/formatSearchRecord";
import { isSwappableRecord } from "components/screens/SwapScreen/helpers/recordPredicates";
import { FormattedSearchTokenRecord, SearchTokenResponse } from "config/types";
import {
  buildVerifiedTokenIds,
  isTokenInVerifiedIds,
} from "helpers/verifiedTokenIds";
import { TokenListReponseItem } from "services/verified-token-lists/types";

/**
 * Pure derivation: take the raw stellar.expert top-50 response plus the
 * SDF verified-tokens list and produce the intersection formatted for the
 * Swap UI.
 *
 * Steps:
 *   1. Drop records the picker can't list (LP shares, malformed asset
 *      strings).
 *   2. Format each surviving record (sets hasTrustline via the callback).
 *   3. Dedupe by canonical CODE:ISSUER (CODE:CONTRACT for Soroban tokens),
 *      preserving stellar.expert's order.
 *   4. Intersect with the verified lists (native XLM is always considered
 *      verified).
 */
export const computeTrendingIntersection = (
  topTokensResp: SearchTokenResponse,
  verifiedTokens: TokenListReponseItem[],
  hasExistingTrustline: (tokenCode: string, issuer: string) => boolean,
): FormattedSearchTokenRecord[] => {
  const verifiedIds = buildVerifiedTokenIds(verifiedTokens);

  const records = topTokensResp._embedded?.records ?? [];

  const formatted = records
    .filter(isSwappableRecord)
    .map((r) => formatSearchRecord(r, hasExistingTrustline));

  const seen = new Set<string>();
  const deduped = formatted.filter((t) => {
    const id = canonicalId(t.tokenCode, t.issuer);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // Intersect with verified code:issuer pairs + always allow the native record.
  return deduped.filter(
    (t) => t.isNative || isTokenInVerifiedIds(verifiedIds, t),
  );
};

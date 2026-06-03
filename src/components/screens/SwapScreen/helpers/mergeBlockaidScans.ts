import Blockaid from "@blockaid/client";
import { FormattedSearchTokenRecord } from "config/types";
import {
  assessTokenSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

/**
 * Apply a Blockaid scan map onto a list of records.
 *
 * Records keyed by `${tokenCode}-${issuer}` to match the address-list
 * format used by scanBulkWithCache. Records without a matching scan
 * get a synthesized scan-result of "unable to scan" via the existing
 * assessTokenSecurity contract — that's also what the live pipeline
 * produces today when Blockaid returns no entry for a token.
 *
 * Pure function — no I/O, no React state. Used in both phases of the
 * Trending pipeline (Phase 1 with cached scans, Phase 2 with fresh
 * scans).
 */
export const mergeBlockaidScans = (
  records: FormattedSearchTokenRecord[],
  scanMap: Record<string, Blockaid.Token.TokenScanResponse>,
): FormattedSearchTokenRecord[] =>
  records.map((token) => {
    const key = token.issuer
      ? `${token.tokenCode}-${token.issuer}`
      : token.tokenCode;
    const scan = scanMap[key];
    const securityInfo = assessTokenSecurity(scan);
    return {
      ...token,
      isSuspicious: securityInfo.isSuspicious,
      isMalicious: securityInfo.isMalicious,
      isUnableToScan: securityInfo.isUnableToScan,
      securityLevel: securityInfo.level,
      securityWarnings: extractSecurityWarnings(scan),
    };
  });

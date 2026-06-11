import Blockaid from "@blockaid/client";
import { FormattedSearchTokenRecord } from "config/types";
import { SecurityLevel } from "services/blockaid/constants";
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
 * @param debugOverride Optional dev-debug security-level override; when set,
 *   bypasses scan results to surface the override for every record. Mirrors
 *   the second arg accepted by assessTokenSecurity so the trending pipeline
 *   preserves the existing Debug-screen toggle behavior.
 */
export const mergeBlockaidScans = (
  records: FormattedSearchTokenRecord[],
  scanMap: Record<string, Blockaid.Token.TokenScanResponse>,
  debugOverride: SecurityLevel | null = null,
): FormattedSearchTokenRecord[] =>
  records.map((token) => {
    const key = token.issuer
      ? `${token.tokenCode}-${token.issuer}`
      : token.tokenCode;
    const scan = scanMap[key];
    const securityInfo = assessTokenSecurity(scan, debugOverride);
    return {
      ...token,
      isSuspicious: securityInfo.isSuspicious,
      isMalicious: securityInfo.isMalicious,
      isUnableToScan: securityInfo.isUnableToScan,
      securityLevel: securityInfo.level,
      securityWarnings: extractSecurityWarnings(scan),
    };
  });

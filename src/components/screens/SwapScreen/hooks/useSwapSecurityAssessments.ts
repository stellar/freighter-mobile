import Blockaid from "@blockaid/client";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { NATIVE_TOKEN_CODE } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { useMemo } from "react";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTokenSecurity,
  assessTokenSecurityFromLevel,
  assessTransactionSecurity,
  extractSecurityWarnings,
  SecurityWarning,
} from "services/blockaid/helper";
import { SecurityAssessment } from "services/blockaid/types";

/**
 * Owns the swap-side security cluster: three Blockaid assessments
 * (transaction + source-token + destination-token), the
 * "unable-to-scan" gates that drive the safety-net flow before
 * presenting Review, and the aggregated warnings list rendered in the
 * security-warning bottom sheet.
 *
 * Two subtleties live here:
 *
 *   1. **Non-held destination fallback.** `scanResults` only carries
 *      the bulk-scan map keyed by held-balance ids. When the user
 *      picks a destination they don't hold yet, we fall back to
 *      `synthesizeScanFromLevel(descriptor.securityLevel)` — the
 *      level surfaced by `useSwapTokenLookup`'s discovery-time bulk
 *      scan — so MALICIOUS / SUSPICIOUS signals route through the
 *      same `assessTokenSecurity` consumer as held tokens.
 *
 *   2. **Native-XLM exclusion.** `isUnableToScan` is the gate that
 *      forces the safety-net flow. XLM is the native asset and is
 *      never going to scan — so we explicitly suppress the gate when
 *      either side is XLM. Otherwise every swap involving XLM would
 *      route through the warning sheet.
 */
export const useSwapSecurityAssessments = ({
  transactionScanResult,
  overriddenBlockaidResponse,
  sourceBalance,
  destinationBalance,
  destinationTokenDescriptor,
  scanResults,
  sourceTokenId,
}: {
  transactionScanResult: Blockaid.StellarTransactionScanResponse | undefined;
  overriddenBlockaidResponse: SecurityLevel | null;
  sourceBalance: HeldBalanceItem | undefined;
  destinationBalance: HeldBalanceItem | undefined;
  destinationTokenDescriptor: DestinationTokenDescriptor | null;
  scanResults: Record<string, Blockaid.TokenScanResponse | undefined>;
  sourceTokenId: string | undefined;
}): {
  transactionSecurityAssessment: SecurityAssessment;
  sourceSecurityAssessment: SecurityAssessment;
  destinationSecurityAssessment: SecurityAssessment;
  isUnableToScan: boolean;
  /**
   * Token-only (source + destination) unable-to-scan, excluding the
   * transaction scan. Those token scans run at selection/path-finding time so
   * this is stable at CTA time, whereas the tx scan runs lazily and must be
   * read fresh (see SwapAmountScreen's gate). `isUnableToScan` is the union.
   */
  isTokenUnableToScan: boolean;
  isMalicious: boolean;
  isSuspicious: boolean;
  swapSecuritySeverity:
    | SecurityLevel.SUSPICIOUS
    | SecurityLevel.MALICIOUS
    | SecurityLevel.EXPECTED_TO_FAIL
    | SecurityLevel.UNABLE_TO_SCAN
    | undefined;
  securityWarnings: SecurityWarning[];
} => {
  const { t } = useAppTranslation();

  const transactionSecurityAssessment = useMemo(
    () =>
      assessTransactionSecurity(
        transactionScanResult,
        overriddenBlockaidResponse,
      ),
    [transactionScanResult, overriddenBlockaidResponse],
  );

  const sourceSecurityAssessment = useMemo(
    () =>
      assessTokenSecurity(
        sourceBalance
          ? scanResults[sourceBalance.id.replace(":", "-")]
          : undefined,
        overriddenBlockaidResponse,
      ),
    [sourceBalance, scanResults, overriddenBlockaidResponse],
  );

  // Held destinations have a real Blockaid scan in `scanResults`; non-held
  // destinations carry a pre-classified `securityLevel` on the descriptor
  // (set by `useSwapTokenLookup` at discovery time) — feed that through
  // `assessTokenSecurityFromLevel` directly instead of round-tripping
  // through a synthesized scan object.
  const destinationSecurityAssessment = useMemo(
    () =>
      destinationBalance
        ? assessTokenSecurity(
            scanResults[destinationBalance.id.replace(":", "-")],
            overriddenBlockaidResponse,
          )
        : assessTokenSecurityFromLevel(
            destinationTokenDescriptor?.securityLevel,
            overriddenBlockaidResponse,
          ),
    [
      destinationBalance,
      destinationTokenDescriptor?.securityLevel,
      scanResults,
      overriddenBlockaidResponse,
    ],
  );

  const showSecurityWarningForSource = useMemo(
    () =>
      sourceSecurityAssessment.isUnableToScan &&
      sourceTokenId !== NATIVE_TOKEN_CODE,
    [sourceSecurityAssessment.isUnableToScan, sourceTokenId],
  );

  const showSecurityWarningForDestination = useMemo(
    () =>
      destinationSecurityAssessment.isUnableToScan &&
      destinationTokenDescriptor?.id !== NATIVE_TOKEN_CODE,
    [destinationSecurityAssessment.isUnableToScan, destinationTokenDescriptor],
  );

  const isTokenUnableToScan =
    showSecurityWarningForSource || showSecurityWarningForDestination;

  // The transaction-level scan has no native exclusion — a failed XDR scan is
  // a failure regardless of the assets involved. Mirrors Send's safety net.
  const isUnableToScan =
    transactionSecurityAssessment.isUnableToScan || isTokenUnableToScan;

  const securityWarnings = useMemo(() => {
    const warnings: SecurityWarning[] = [];

    if (
      transactionSecurityAssessment.isMalicious ||
      transactionSecurityAssessment.isSuspicious ||
      sourceSecurityAssessment.isMalicious ||
      sourceSecurityAssessment.isSuspicious ||
      destinationSecurityAssessment.isMalicious ||
      destinationSecurityAssessment.isSuspicious
    ) {
      // Scope extraction to the actual source + destination scans (plus
      // the tx scan). The previous `Object.values(scanResults).map(...)`
      // dumped every held token's features here, which made any benign
      // feature shared across the user's portfolio appear 6+ times in
      // the "Do not proceed" sheet (XRP-GBXRPL45 bug).
      const sourceScan = sourceBalance
        ? scanResults[sourceBalance.id.replace(":", "-")]
        : undefined;
      const destScan = destinationBalance
        ? scanResults[destinationBalance.id.replace(":", "-")]
        : undefined;
      // For non-held destinations there's no PricedBalance, so the
      // scanResults map doesn't carry the destination's scan. The
      // descriptor already carries the real warnings extracted at
      // discovery time by `useSwapTokenLookup` — fall back to those so
      // the sheet's reasons list isn't empty. `synthesizeScanFromLevel`
      // only knows the top-level severity and produces zero feature rows.
      const descriptorWarnings: SecurityWarning[] =
        !destinationBalance && destinationTokenDescriptor?.securityWarnings
          ? destinationTokenDescriptor.securityWarnings
          : [];

      const extracted = [
        ...extractSecurityWarnings(transactionScanResult),
        ...extractSecurityWarnings(sourceScan),
        ...extractSecurityWarnings(destScan),
        ...descriptorWarnings,
      ];

      // Dedupe by feature_id; on collision keep the worse severity so
      // the renderer surfaces the most urgent variant.
      const byId = new Map<string, SecurityWarning>();
      extracted.forEach((w) => {
        const prev = byId.get(w.id);
        if (
          !prev ||
          (prev.severity === "warning" && w.severity === "malicious")
        ) {
          byId.set(w.id, w);
        }
      });

      warnings.push(...byId.values());
    }

    if (transactionSecurityAssessment.isUnableToScan) {
      warnings.push({
        id: "unable-to-scan-transaction",
        description: t("blockaid.unableToScan.transaction"),
        severity: "warning",
      });
    }

    if (showSecurityWarningForSource) {
      warnings.push({
        id: "unable-to-scan-source",
        description: t("blockaid.unableToScan.sourceToken"),
        severity: "warning",
      });
    }

    if (showSecurityWarningForDestination) {
      warnings.push({
        id: "unable-to-scan-destination",
        description: t("blockaid.unableToScan.destinationToken"),
        severity: "warning",
      });
    }

    return warnings;
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
    transactionSecurityAssessment.isUnableToScan,
    sourceSecurityAssessment.isMalicious,
    sourceSecurityAssessment.isSuspicious,
    destinationSecurityAssessment.isMalicious,
    destinationSecurityAssessment.isSuspicious,
    showSecurityWarningForDestination,
    showSecurityWarningForSource,
    transactionScanResult,
    sourceBalance,
    destinationBalance,
    destinationTokenDescriptor?.securityWarnings,
    scanResults,
    t,
  ]);

  const isMalicious =
    transactionSecurityAssessment.isMalicious ||
    sourceSecurityAssessment.isMalicious ||
    destinationSecurityAssessment.isMalicious;
  const isSuspicious =
    transactionSecurityAssessment.isSuspicious ||
    sourceSecurityAssessment.isSuspicious ||
    destinationSecurityAssessment.isSuspicious;

  // Worst-of-three: malicious > suspicious > unable-to-scan. Includes
  // source + destination assessments so a malicious destination paired
  // with a benign tx scan still drives the "Do not proceed" header
  // copy/colour. The SecurityDetailBottomSheet no longer defaults
  // severity, so the sheet would render in the wrong style if this
  // returned undefined here.
  const swapSecuritySeverity = useMemo(() => {
    if (isMalicious) return SecurityLevel.MALICIOUS;
    if (isSuspicious) return SecurityLevel.SUSPICIOUS;
    if (isUnableToScan) return SecurityLevel.UNABLE_TO_SCAN;
    return undefined;
  }, [isMalicious, isSuspicious, isUnableToScan]);

  return {
    transactionSecurityAssessment,
    sourceSecurityAssessment,
    destinationSecurityAssessment,
    isUnableToScan,
    isTokenUnableToScan,
    isMalicious,
    isSuspicious,
    swapSecuritySeverity,
    securityWarnings,
  };
};

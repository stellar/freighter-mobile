import Blockaid from "@blockaid/client";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { PricedBalance, TokenTypeWithCustomToken } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import { useMemo } from "react";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTokenSecurity,
  assessTransactionSecurity,
  extractSecurityWarnings,
  synthesizeScanFromLevel,
  SecurityWarning,
} from "services/blockaid/helper";
import { SecurityAssessment } from "services/blockaid/types";

type SwapBalanceItem = PricedBalance & {
  id: string;
  tokenType: TokenTypeWithCustomToken;
};

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
 *      same `assessTokenSecurity` consumer as held tokens (spec §9 +
 *      §6.4).
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
  sourceBalance: SwapBalanceItem | undefined;
  destinationBalance: SwapBalanceItem | undefined;
  destinationTokenDescriptor: DestinationTokenDescriptor | null;
  scanResults: Record<string, Blockaid.TokenScanResponse | undefined>;
  sourceTokenId: string | undefined;
}): {
  transactionSecurityAssessment: SecurityAssessment;
  sourceBalanceSecurityAssessment: SecurityAssessment;
  destBalanceSecurityAssessment: SecurityAssessment;
  showSecurityWarningForSource: boolean;
  showSecurityWarningForDestination: boolean;
  isUnableToScan: boolean;
  isMalicious: boolean;
  isSuspicious: boolean;
  transactionSecuritySeverity:
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

  const sourceBalanceSecurityAssessment = useMemo(
    () =>
      assessTokenSecurity(
        sourceBalance
          ? scanResults[sourceBalance.id.replace(":", "-")]
          : undefined,
        overriddenBlockaidResponse,
      ),
    [sourceBalance, scanResults, overriddenBlockaidResponse],
  );

  const destBalanceSecurityAssessment = useMemo(
    () =>
      assessTokenSecurity(
        destinationBalance
          ? scanResults[destinationBalance.id.replace(":", "-")]
          : synthesizeScanFromLevel(destinationTokenDescriptor?.securityLevel),
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
      sourceBalanceSecurityAssessment.isUnableToScan &&
      sourceTokenId !== NATIVE_TOKEN_CODE,
    [sourceBalanceSecurityAssessment.isUnableToScan, sourceTokenId],
  );

  const showSecurityWarningForDestination = useMemo(
    () =>
      destBalanceSecurityAssessment.isUnableToScan &&
      destinationTokenDescriptor?.id !== NATIVE_TOKEN_CODE,
    [destBalanceSecurityAssessment.isUnableToScan, destinationTokenDescriptor],
  );

  const isUnableToScan =
    showSecurityWarningForSource || showSecurityWarningForDestination;

  const securityWarnings = useMemo(() => {
    const warnings: SecurityWarning[] = [];

    if (
      transactionSecurityAssessment.isMalicious ||
      transactionSecurityAssessment.isSuspicious ||
      sourceBalanceSecurityAssessment.isMalicious ||
      sourceBalanceSecurityAssessment.isSuspicious ||
      destBalanceSecurityAssessment.isMalicious ||
      destBalanceSecurityAssessment.isSuspicious
    ) {
      const extractedWarnings = [
        ...extractSecurityWarnings(transactionScanResult),
        ...Object.values(scanResults).map((result) =>
          extractSecurityWarnings(result),
        ),
      ].flat();

      if (extractedWarnings.length > 0) {
        warnings.push(...extractedWarnings);
      }
    }

    if (showSecurityWarningForSource) {
      warnings.push({
        id: "unable-to-scan-source",
        description: t("blockaid.unableToScan.sourceToken"),
      });
    }

    if (showSecurityWarningForDestination) {
      warnings.push({
        id: "unable-to-scan-destination",
        description: t("blockaid.unableToScan.destinationToken"),
      });
    }

    return warnings;
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
    sourceBalanceSecurityAssessment.isMalicious,
    sourceBalanceSecurityAssessment.isSuspicious,
    destBalanceSecurityAssessment.isMalicious,
    destBalanceSecurityAssessment.isSuspicious,
    showSecurityWarningForDestination,
    showSecurityWarningForSource,
    transactionScanResult,
    scanResults,
    t,
  ]);

  const isMalicious =
    transactionSecurityAssessment.isMalicious ||
    sourceBalanceSecurityAssessment.isMalicious ||
    destBalanceSecurityAssessment.isMalicious;
  const isSuspicious =
    transactionSecurityAssessment.isSuspicious ||
    sourceBalanceSecurityAssessment.isSuspicious ||
    destBalanceSecurityAssessment.isSuspicious;

  const transactionSecuritySeverity = useMemo(() => {
    if (transactionSecurityAssessment.isMalicious)
      return SecurityLevel.MALICIOUS;
    if (transactionSecurityAssessment.isSuspicious)
      return SecurityLevel.SUSPICIOUS;
    if (isUnableToScan) return SecurityLevel.UNABLE_TO_SCAN;
    return undefined;
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
    isUnableToScan,
  ]);

  return {
    transactionSecurityAssessment,
    sourceBalanceSecurityAssessment,
    destBalanceSecurityAssessment,
    showSecurityWarningForSource,
    showSecurityWarningForDestination,
    isUnableToScan,
    isMalicious,
    isSuspicious,
    transactionSecuritySeverity,
    securityWarnings,
  };
};

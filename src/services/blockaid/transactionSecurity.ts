import Blockaid from "@blockaid/client";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTransactionSecurity,
  extractSecurityWarnings,
  type SecurityWarning,
  type UnfundedDestinationContext,
} from "services/blockaid/helper";

// A transaction scan as the security sheet shows it, shared by Send and Earn.
// Kept out of services/blockaid/helper so it runs on that module's exports.

function getTransactionSecurityWarnings(
  assessment: ReturnType<typeof assessTransactionSecurity>,
  scanResult: Blockaid.StellarTransactionScanResponse | undefined,
  unfundedContext?: UnfundedDestinationContext,
): SecurityWarning[] {
  if (assessment.isUnableToScan) {
    return [
      {
        id: "unable-to-scan",
        description: assessment.details || "Unable to scan transaction",
        severity: "warning",
      },
    ];
  }

  if (
    assessment.isMalicious ||
    assessment.isSuspicious ||
    assessment.isExpectedToFail
  ) {
    const warnings = extractSecurityWarnings(scanResult, unfundedContext);

    if (Array.isArray(warnings) && warnings.length > 0) {
      return warnings;
    }
  }

  return [];
}

function getTransactionSecuritySeverity(
  assessment: ReturnType<typeof assessTransactionSecurity>,
): Exclude<SecurityLevel, SecurityLevel.SAFE> | undefined {
  if (assessment.isExpectedToFail) return SecurityLevel.EXPECTED_TO_FAIL;
  if (assessment.isMalicious) return SecurityLevel.MALICIOUS;
  if (assessment.isSuspicious) return SecurityLevel.SUSPICIOUS;
  if (assessment.isUnableToScan) return SecurityLevel.UNABLE_TO_SCAN;

  return undefined;
}

/**
 * Function for getting transaction security assessment
 * Can be called at runtime with scanResult as parameter
 *
 * @param scanResult - The Blockaid scan result
 * @param overriddenBlockaidResponse - Optional override for debugging
 * @param unfundedContext - Optional context for unfunded destination detection
 */
export function getTransactionSecurity(
  scanResult: Blockaid.StellarTransactionScanResponse | undefined,
  overriddenBlockaidResponse?: SecurityLevel | null,
  unfundedContext?: UnfundedDestinationContext,
) {
  const transactionSecurityAssessment = assessTransactionSecurity(
    scanResult,
    overriddenBlockaidResponse,
    unfundedContext,
  );

  const transactionSecurityWarnings = getTransactionSecurityWarnings(
    transactionSecurityAssessment,
    scanResult,
    unfundedContext,
  );

  const transactionSecuritySeverity = getTransactionSecuritySeverity(
    transactionSecurityAssessment,
  );

  return {
    transactionSecurityAssessment,
    transactionSecurityWarnings,
    transactionSecuritySeverity,
  };
}

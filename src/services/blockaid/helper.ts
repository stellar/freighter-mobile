import Blockaid from "@blockaid/client";
import { t } from "i18next";
import {
  BLOCKAID_RESULT_TYPES,
  SecurityLevel,
  SECURITY_LEVEL_MAP,
  SECURITY_MESSAGE_KEYS,
} from "services/blockaid/constants";

/**
 * Security assessment result with type-safe level classification
 * Provides consistent interface across all scan types
 */
export interface SecurityAssessment {
  level: SecurityLevel;
  isSuspicious: boolean;
  isMalicious: boolean;
  details?: string;
}

/**
 * Determines security level from Blockaid result type
 * Centralized logic for consistent security assessment
 */
const getSecurityLevel = (resultType: string): SecurityLevel =>
  SECURITY_LEVEL_MAP[resultType as keyof typeof SECURITY_LEVEL_MAP] ||
  SecurityLevel.SAFE;

/**
 * Creates security assessment with proper i18n translation
 * Ensures user-facing messages are properly localized
 */
const createSecurityAssessment = (
  level: SecurityLevel,
  messageKey?: string,
  fallbackMessage?: string,
): SecurityAssessment => ({
  level,
  isSuspicious: level !== SecurityLevel.SAFE,
  isMalicious: level === SecurityLevel.MALICIOUS,
  details: messageKey
    ? t(messageKey, { defaultValue: fallbackMessage })
    : undefined,
});

/**
 * Asset Security Assessment
 *
 * Evaluates asset scan results using result_type for consistent security classification.
 * Matches extension behavior: any non-Benign result_type is suspicious.
 *
 * @param scanResult - The Blockaid asset scan result
 * @returns SecurityAssessment with type-safe level and localized details
 */
export const assessAssetSecurity = (
  scanResult?: Blockaid.TokenScanResponse,
): SecurityAssessment => {
  // Early return: no scan result or no result_type = safe (no message)
  if (!scanResult?.result_type) {
    return createSecurityAssessment(SecurityLevel.SAFE);
  }

  const level = getSecurityLevel(scanResult.result_type);

  switch (level) {
    case SecurityLevel.MALICIOUS:
      return createSecurityAssessment(
        level,
        SECURITY_MESSAGE_KEYS.ASSET_MALICIOUS,
      );

    case SecurityLevel.SUSPICIOUS:
      return createSecurityAssessment(
        level,
        SECURITY_MESSAGE_KEYS.ASSET_SUSPICIOUS,
      );

    default:
      return createSecurityAssessment(SecurityLevel.SAFE);
  }
};

/**
 * Site Security Assessment
 *
 * Evaluates site scan results using status + is_malicious for site-specific logic.
 * Matches extension behavior: miss = safe, hit with is_malicious = malicious, hit without = suspicious.
 *
 * @param scanResult - The Blockaid site scan result
 * @returns SecurityAssessment with type-safe level and localized details
 */
export const assessSiteSecurity = (
  scanResult?: Blockaid.SiteScanResponse,
): SecurityAssessment => {
  // Early return: no scan result = safe (no message)
  if (!scanResult) {
    return createSecurityAssessment(SecurityLevel.SAFE);
  }

  // Site not found in database = safe (no message)
  if (scanResult.status === "miss") {
    return createSecurityAssessment(SecurityLevel.SAFE);
  }

  // Site found in database
  if (scanResult.is_malicious) {
    return createSecurityAssessment(
      SecurityLevel.MALICIOUS,
      SECURITY_MESSAGE_KEYS.SITE_MALICIOUS,
    );
  }

  // Site found but not explicitly malicious = suspicious
  return createSecurityAssessment(
    SecurityLevel.SUSPICIOUS,
    SECURITY_MESSAGE_KEYS.SITE_SUSPICIOUS,
  );
};

/**
 * Transaction Security Assessment
 *
 * Evaluates transaction scan results using simulation + validation for transaction-specific logic.
 * Matches extension behavior: simulation errors = suspicious, validation result_type determines level.
 *
 * @param scanResult - The Blockaid transaction scan result
 * @returns SecurityAssessment with type-safe level and localized details
 */
export const assessTransactionSecurity = (
  scanResult?: Blockaid.StellarTransactionScanResponse,
): SecurityAssessment => {
  // Early return: no scan result = safe (no message)
  if (!scanResult) {
    return createSecurityAssessment(SecurityLevel.SAFE);
  }

  const { simulation, validation } = scanResult;

  // Check for simulation errors = suspicious
  if (simulation && "error" in simulation) {
    return createSecurityAssessment(
      SecurityLevel.SUSPICIOUS,
      SECURITY_MESSAGE_KEYS.TRANSACTION_SIMULATION_FAILED,
    );
  }

  // Check validation result_type
  if (validation && "result_type" in validation) {
    const level = getSecurityLevel(validation.result_type);

    switch (level) {
      case SecurityLevel.MALICIOUS:
        return createSecurityAssessment(
          level,
          SECURITY_MESSAGE_KEYS.TRANSACTION_MALICIOUS,
        );

      case SecurityLevel.SUSPICIOUS:
        return createSecurityAssessment(
          level,
          SECURITY_MESSAGE_KEYS.TRANSACTION_WARNING,
        );

      default:
        return createSecurityAssessment(SecurityLevel.SAFE);
    }
  }

  // No validation data = safe (no message)
  return createSecurityAssessment(SecurityLevel.SAFE);
};

/**
 * Utility function for result type warnings
 * Checks if a result type indicates a warning (suspicious but not malicious)
 *
 * @param resultType - The result type from Blockaid
 * @returns true if the result type indicates a warning, false otherwise
 */
export const isBlockaidWarning = (resultType: string): boolean =>
  resultType === BLOCKAID_RESULT_TYPES.WARNING ||
  resultType === BLOCKAID_RESULT_TYPES.SPAM;

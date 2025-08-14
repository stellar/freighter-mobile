import Blockaid from "@blockaid/client";
import BigNumber from "bignumber.js";
import { logger } from "config/logger";
import { t } from "i18next";
import {
  BLOCKAID_RESULT_TYPES,
  SecurityLevel,
  SECURITY_LEVEL_MAP,
  SECURITY_MESSAGE_KEYS,
} from "services/blockaid/constants";
// Keep this helper UI-agnostic – no UI imports/hooks here

/**
 * Security warning interface for UI display
 */
export interface SecurityWarning {
  id: string;
  description: string;
}

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
  isSuspicious:
    level !== SecurityLevel.SAFE && level !== SecurityLevel.MALICIOUS,
  isMalicious: level === SecurityLevel.MALICIOUS,
  details: messageKey
    ? t(messageKey, { defaultValue: fallbackMessage })
    : undefined,
});

/**
 * Asset Security Assessment
 *
 * Evaluates asset scan results using result_type for consistent security classification.
 *
 * @param scanResult - The Blockaid asset scan result
 * @returns SecurityAssessment with type-safe level and localized details
 */
export const assessAssetSecurity = (
  scanResult?: Blockaid.TokenScanResponse,
): SecurityAssessment => {
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
 * miss = suspicious (warning), hit with is_malicious = malicious (error), hit with is_malicious = false (safe).
 *
 * @param scanResult - The Blockaid site scan result
 * @returns SecurityAssessment with type-safe level and localized details
 */
export const assessSiteSecurity = (
  scanResult?: Blockaid.SiteScanResponse,
): SecurityAssessment => {
  if (!scanResult) {
    return createSecurityAssessment(SecurityLevel.SAFE);
  }

  // Site not found in database = suspicious (warning)
  if (scanResult.status === "miss") {
    return createSecurityAssessment(
      SecurityLevel.SUSPICIOUS,
      SECURITY_MESSAGE_KEYS.SITE_SUSPICIOUS,
    );
  }

  if (scanResult.is_malicious) {
    return createSecurityAssessment(
      SecurityLevel.MALICIOUS,
      SECURITY_MESSAGE_KEYS.SITE_MALICIOUS,
    );
  }

  // Site found but not malicious = safe
  return createSecurityAssessment(SecurityLevel.SAFE);
};

/**
 * Transaction Security Assessment
 *
 * Evaluates transaction scan results using simulation + validation for transaction-specific logic.
 *
 * @param scanResult - The Blockaid transaction scan result
 * @returns SecurityAssessment with type-safe level and localized details
 */
export const assessTransactionSecurity = (
  scanResult?: Blockaid.StellarTransactionScanResponse,
): SecurityAssessment => {
  if (!scanResult) {
    return createSecurityAssessment(SecurityLevel.SAFE);
  }

  logger.debug("assessTransactionSecurity", JSON.stringify(scanResult));

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

/**
 * Extracts security warnings from Blockaid scan results
 * Matches extension behavior: sites show simple labels, assets/transactions show detailed warnings
 *
 * @param scanResult - The Blockaid scan result (asset, site, or transaction)
 * @returns Array of security warnings with id and description
 */
export const extractSecurityWarnings = (
  scanResult?:
    | Blockaid.TokenScanResponse
    | Blockaid.SiteScanResponse
    | Blockaid.StellarTransactionScanResponse,
): Array<SecurityWarning> => {
  const warnings: Array<SecurityWarning> = [];

  if (!scanResult) {
    return warnings;
  }

  // Handle site scan results
  if ("status" in scanResult) {
    if (scanResult.status === "miss") {
      warnings.push({
        id: "site-miss",
        description: t("blockaid.security.site.suspicious"),
      });

      return warnings;
    }

    if (scanResult.status === "hit" && scanResult.is_malicious) {
      warnings.push({
        id: "site-malicious",
        description: t("blockaid.security.site.malicious"),
      });

      return warnings;
    }

    return warnings;
  }

  // Handle asset scan results
  if ("features" in scanResult && scanResult.features) {
    scanResult.features.forEach((feature) => {
      warnings.push({
        id: feature.feature_id,
        description: feature.description,
      });
    });
  }

  // Handle transaction scan results
  if ("simulation" in scanResult) {
    if (scanResult.simulation && "error" in scanResult.simulation) {
      warnings.push({
        id: "simulation-error",
        description: scanResult.simulation.error,
      });
    }

    if (
      scanResult.validation &&
      "result_type" in scanResult.validation &&
      "description" in scanResult.validation
    ) {
      const resultType = scanResult.validation.result_type;

      if (
        resultType === BLOCKAID_RESULT_TYPES.WARNING ||
        resultType === BLOCKAID_RESULT_TYPES.MALICIOUS
      ) {
        warnings.push({
          id: `validation-${resultType.toLowerCase()}`,
          description: scanResult.validation.description,
        });
      }
    }
  }

  return warnings;
};

// =============================================================================
// Transaction balance changes (domain model)
// =============================================================================

export interface TransactionBalanceChange {
  assetCode: string;
  assetIssuer?: string;
  isNative: boolean;
  /** Raw amount from Blockaid (integer scaled by 1e7), not converted/formatted */
  amount: BigNumber;
  isCredit: boolean;
}

type AccountAssetDiff = {
  asset: { type: "NATIVE" | "ASSET"; code: string; issuer?: string };
  in?: { raw_value?: number | string | null } | null;
  out?: { raw_value?: number | string | null } | null;
};

/**
 * Extracts per-asset balance changes from a Blockaid transaction simulation.
 * - Returns null when simulation is unavailable or failed ("unable to simulate")
 * - Returns [] when there are no balance changes
 * - Otherwise returns a list of signed deltas per asset
 */
export const getTransactionBalanceChanges = (
  scanResult?: Blockaid.StellarTransactionScanResponse,
): TransactionBalanceChange[] | null => {
  // Missing result or simulation error -> treat as "unable to simulate"
  if (!scanResult || !scanResult.simulation || "error" in scanResult.simulation) {
    return null;
  }

  // account_assets_diffs holds per-asset in/out raw deltas
  type SimulationSummary = {
    account_summary?: { account_assets_diffs?: AccountAssetDiff[] };
  };

  const sim = scanResult.simulation as unknown as SimulationSummary;
  const diffs = sim.account_summary?.account_assets_diffs;

  if (!Array.isArray(diffs) || diffs.length === 0) {
    return [];
  }

  const changes: TransactionBalanceChange[] = diffs
    .map((diff) => {
      const inRaw = diff.in?.raw_value;
      const outRaw = diff.out?.raw_value;

      const hasIn = inRaw !== null && inRaw !== undefined;
      const hasOut = outRaw !== null && outRaw !== undefined;

      if (!hasIn && !hasOut) {
        return undefined;
      }

      const rawValue = hasIn ? inRaw : outRaw;
      const amount = new BigNumber(rawValue as number | string).dividedBy(1e7);
      const isCredit = hasIn;
      const isNative = diff.asset.type === "NATIVE";
      const assetCode = diff.asset.code;
      const assetIssuer = isNative ? undefined : diff.asset.issuer;

      return {
        assetCode,
        assetIssuer,
        isNative,
        amount,
        isCredit,
      } as TransactionBalanceChange;
    })
    .filter(Boolean) as TransactionBalanceChange[];

  return changes;
};

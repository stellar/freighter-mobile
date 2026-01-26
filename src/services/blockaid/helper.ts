import Blockaid from "@blockaid/client";
import BigNumber from "bignumber.js";
import { t } from "i18next";
import {
  BLOCKAID_RESULT_TYPES,
  SecurityLevel,
  SECURITY_LEVEL_MAP,
  TOKEN_SECURITY_LEVEL_MESSAGE_KEYS,
  SITE_SECURITY_LEVEL_MESSAGE_KEYS,
  TRANSACTION_SECURITY_LEVEL_MESSAGE_KEYS,
  ValidationSeverity,
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
 * Scan assessment result with type-safe level classification
 * Represents the evaluation outcome from a Blockaid scan (tokens, sites, or transactions)
 * Includes both security aspects and transaction outcome aspects (e.g., expected to fail)
 */
export interface ScanAssessment {
  level: SecurityLevel;
  isSuspicious: boolean;
  isMalicious: boolean;
  isExpectedToFail?: boolean;
  isUnableToScan: boolean;
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
 * Creates scan assessment with proper i18n translation
 * Ensures user-facing messages are properly localized
 */
export const createSecurityAssessment = (
  level: SecurityLevel,
  messageKey?: string,
  fallbackMessage?: string,
): ScanAssessment => ({
  level,
  isSuspicious:
    level !== SecurityLevel.SAFE &&
    level !== SecurityLevel.MALICIOUS &&
    level !== SecurityLevel.UNABLE_TO_SCAN &&
    level !== SecurityLevel.EXPECTED_TO_FAIL,
  isMalicious: level === SecurityLevel.MALICIOUS,
  isExpectedToFail: level === SecurityLevel.EXPECTED_TO_FAIL,
  isUnableToScan: level === SecurityLevel.UNABLE_TO_SCAN,
  details: messageKey
    ? t(messageKey, { defaultValue: fallbackMessage })
    : undefined,
});

/**
 * Token Security Assessment
 *
 * Evaluates token scan results using result_type for consistent security classification.
 * Returns "Unable to scan" state when scanResult is null/undefined (scan failed).
 *
 * @param scanResult - The Blockaid token scan result
 * @returns SecurityAssessment with type-safe level and localized details
 */
export const assessTokenSecurity = (
  scanResult?: Blockaid.TokenScanResponse,
  debugOverride?: SecurityLevel | null,
): ScanAssessment => {
  // Check for debug override first
  if (debugOverride) {
    const messageKeys = TOKEN_SECURITY_LEVEL_MESSAGE_KEYS[debugOverride];
    return createSecurityAssessment(
      debugOverride,
      messageKeys.title,
      messageKeys.description,
    );
  }

  // If scanResult is null/undefined, it means the scan failed
  if (!scanResult) {
    const messageKeys =
      TOKEN_SECURITY_LEVEL_MESSAGE_KEYS[SecurityLevel.UNABLE_TO_SCAN];
    return createSecurityAssessment(
      SecurityLevel.UNABLE_TO_SCAN as SecurityLevel,
      messageKeys.title,
      messageKeys.description,
    );
  }

  if (!scanResult.result_type) {
    return createSecurityAssessment(SecurityLevel.SAFE);
  }

  const level = getSecurityLevel(scanResult.result_type);
  const messageKeys = TOKEN_SECURITY_LEVEL_MESSAGE_KEYS[level];

  return createSecurityAssessment(
    level,
    messageKeys.title,
    messageKeys.description,
  );
};

/**
 * Site Security Assessment
 *
 * Evaluates site scan results using status + is_malicious for site-specific logic.
 * miss = suspicious (warning), hit with is_malicious = malicious (error), hit with is_malicious = false (safe).
 * Returns "Unable to scan" state when scanResult is null/undefined (scan failed).
 *
 * @param scanResult - The Blockaid site scan result
 * @returns SecurityAssessment with type-safe level and localized details
 */
export const assessSiteSecurity = (
  scanResult?: Blockaid.SiteScanResponse,
  debugOverride?: SecurityLevel | null,
): ScanAssessment => {
  // Check for debug override first
  if (debugOverride) {
    const messageKeys = SITE_SECURITY_LEVEL_MESSAGE_KEYS[debugOverride];
    return createSecurityAssessment(
      debugOverride,
      messageKeys.title,
      messageKeys.description,
    );
  }

  // If scanResult is null/undefined, it means the scan failed
  if (!scanResult) {
    const messageKeys =
      SITE_SECURITY_LEVEL_MESSAGE_KEYS[SecurityLevel.UNABLE_TO_SCAN];
    return createSecurityAssessment(
      SecurityLevel.UNABLE_TO_SCAN as SecurityLevel,
      messageKeys.title,
      messageKeys.description,
    );
  }

  // Site not found in database = suspicious (warning)
  if (scanResult.status === "miss") {
    const messageKeys =
      SITE_SECURITY_LEVEL_MESSAGE_KEYS[SecurityLevel.SUSPICIOUS];
    return createSecurityAssessment(
      SecurityLevel.SUSPICIOUS,
      messageKeys.title,
      messageKeys.description,
    );
  }

  if (scanResult.is_malicious) {
    const messageKeys =
      SITE_SECURITY_LEVEL_MESSAGE_KEYS[SecurityLevel.MALICIOUS];
    return createSecurityAssessment(
      SecurityLevel.MALICIOUS,
      messageKeys.title,
      messageKeys.description,
    );
  }

  // Site found but not malicious = safe
  const messageKeys = SITE_SECURITY_LEVEL_MESSAGE_KEYS[SecurityLevel.SAFE];
  return createSecurityAssessment(
    SecurityLevel.SAFE,
    messageKeys.title,
    messageKeys.description,
  );
};

/**
 * Transaction Security Assessment
 *
 * Evaluates transaction scan results using simulation + validation for transaction-specific logic.
 * Returns "Unable to scan" state when scanResult is null/undefined (scan failed).
 *
 * @param scanResult - The Blockaid transaction scan result
 * @returns SecurityAssessment with type-safe level and localized details
 */
export const assessTransactionSecurity = (
  scanResult?: Blockaid.StellarTransactionScanResponse,
  debugOverride?: SecurityLevel | null,
): ScanAssessment => {
  // Check for debug override first
  if (debugOverride) {
    const messageKeys = TRANSACTION_SECURITY_LEVEL_MESSAGE_KEYS[debugOverride];
    return createSecurityAssessment(
      debugOverride,
      messageKeys.title,
      messageKeys.description,
    );
  }

  // If scanResult is null/undefined, it means the scan failed
  if (!scanResult) {
    const messageKeys =
      TRANSACTION_SECURITY_LEVEL_MESSAGE_KEYS[SecurityLevel.UNABLE_TO_SCAN];
    return createSecurityAssessment(
      SecurityLevel.UNABLE_TO_SCAN as SecurityLevel,
      messageKeys.title,
      messageKeys.description,
    );
  }

  const { simulation, validation } = scanResult;

  // Check for simulation errors = suspicious
  if (simulation && "error" in simulation) {
    const messageKeys =
      TRANSACTION_SECURITY_LEVEL_MESSAGE_KEYS[SecurityLevel.EXPECTED_TO_FAIL];
    return createSecurityAssessment(
      SecurityLevel.EXPECTED_TO_FAIL,
      messageKeys.title,
      messageKeys.description,
    );
  }

  // Check validation result_type
  if (validation && "result_type" in validation) {
    const level = getSecurityLevel(validation.result_type);
    const messageKeys = TRANSACTION_SECURITY_LEVEL_MESSAGE_KEYS[level];

    return createSecurityAssessment(
      level,
      messageKeys.title,
      messageKeys.description,
    );
  }

  // No validation data = safe (no message)
  const messageKeys =
    TRANSACTION_SECURITY_LEVEL_MESSAGE_KEYS[SecurityLevel.SAFE];
  return createSecurityAssessment(
    SecurityLevel.SAFE,
    messageKeys.title,
    messageKeys.description,
  );
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
 * Detects if a transaction scan result indicates an unfunded destination error
 * Checks for simulation errors or specific validation patterns that indicate
 * the transaction is expected to fail due to unfunded destination
 *
 * @param scanResult - The Blockaid transaction scan result
 * @returns true if the result indicates an unfunded destination, false otherwise
 */
export const isUnfundedDestinationError = (
  scanResult?: Blockaid.StellarTransactionScanResponse,
): boolean => {
  if (!scanResult) {
    return false;
  }

  // Check if simulation has an error (indicates transaction will fail)
  if (scanResult.simulation && "error" in scanResult.simulation) {
    return true;
  }

  // Also check for validation errors that indicate simulation failed
  // The response may include validation: { error: "simulation failed" }
  if (scanResult.validation && "error" in scanResult.validation) {
    const validation = scanResult.validation as unknown as { error?: string };
    return (
      validation.error !== undefined &&
      validation.error.toLowerCase().includes("simulation")
    );
  }

  return false;
};

/**
 * Extracts security warnings from Blockaid scan results
 * Matches extension behavior: sites show simple labels, tokens/transactions show detailed warnings
 *
 * @param scanResult - The Blockaid scan result (token, site, or transaction)
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

  const isUnfunded = isUnfundedDestinationError(
    scanResult as unknown as Blockaid.StellarTransactionScanResponse,
  );

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

  // Handle token scan results
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
    if (
      !isUnfunded &&
      scanResult.simulation &&
      "error" in scanResult.simulation
    ) {
      warnings.push({
        id: "simulation-error",
        description: scanResult.simulation.error,
      });
    }

    // Check if this scan result indicates unfunded destination (transaction expected to fail)
    if (isUnfunded) {
      // Only add the detailed explanation - the title already says "Transaction is expected to fail"
      warnings.push({
        id: "unfunded-destination-details",
        description: t("blockaid.security.transaction.unfundedDestination"),
      });

      // Do not surface Blockaid technical messages for unfunded accounts
      return warnings;
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
// Transaction validation flagged entities (addresses)
// =============================================================================

export interface ValidationFlaggedEntity {
  address: string;
  severity: ValidationSeverity;
  classification?: string;
}

/**
 * Extracts any Stellar account addresses mentioned in the Blockaid validation.description
 * and classifies them as malicious or suspicious based on the result_type.
 *
 * Example description:
 * "Gaining account GBXQAA7X3TBSXA7BUOCAR6U2BY7VQZZJMAOFLCGT6EL3RL22X5VFNSV6 is classified as custom_malicious"
 */
export const extractFlaggedEntitiesFromTransaction = (
  scanResult?: Blockaid.StellarTransactionScanResponse,
): ValidationFlaggedEntity[] => {
  if (!scanResult || !scanResult.validation) {
    return [];
  }

  const validation = scanResult.validation as unknown as {
    description?: string;
    result_type?: string;
    classification?: string;
  };

  const description = validation.description || "";
  if (!description) {
    return [];
  }

  const resultType = (validation.result_type || "").toUpperCase();
  const severity: ValidationFlaggedEntity["severity"] =
    resultType === BLOCKAID_RESULT_TYPES.MALICIOUS
      ? ValidationSeverity.MALICIOUS
      : ValidationSeverity.SUSPICIOUS;

  // Match Stellar account public keys (G... 56 chars base32)
  const ADDRESS_REGEX = /G[A-Z2-7]{55}/g;
  const matches = description.match(ADDRESS_REGEX) || [];

  // Deduplicate addresses
  const unique = Array.from(new Set(matches));

  return unique.map((address) => ({
    address,
    severity,
    classification: validation.classification,
  }));
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
  if (
    !scanResult ||
    !scanResult.simulation ||
    "error" in scanResult.simulation
  ) {
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

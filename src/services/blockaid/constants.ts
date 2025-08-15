export const BLOCKAID_ENDPOINTS = {
  SCAN_TOKEN: "/scan-asset",
  SCAN_SITE: "/scan-dapp",
  SCAN_TRANSACTION: "/scan-tx",
} as const;

export const BLOCKAID_RESULT_TYPES = {
  BENIGN: "Benign",
  MALICIOUS: "Malicious",
  WARNING: "Warning",
  SPAM: "Spam",
} as const;

export const BLOCKAID_ERROR_MESSAGES = {
  TOKEN_SCAN_FAILED: "Failed to scan token",
  SITE_SCAN_FAILED: "Failed to scan site",
  TRANSACTION_SCAN_FAILED: "Failed to scan transaction",
  NETWORK_NOT_SUPPORTED: "Scanning is not supported on this network",
} as const;

/**
 * Security levels for Blockaid assessments
 * Provides type-safe security classification
 */
export enum SecurityLevel {
  SAFE = "SAFE",
  SUSPICIOUS = "SUSPICIOUS",
  MALICIOUS = "MALICIOUS",
}

/**
 * Mapping from Blockaid result types to security levels
 * Ensures consistent security assessment across all scan types
 */
export const SECURITY_LEVEL_MAP = {
  [BLOCKAID_RESULT_TYPES.BENIGN]: SecurityLevel.SAFE,
  [BLOCKAID_RESULT_TYPES.WARNING]: SecurityLevel.SUSPICIOUS,
  [BLOCKAID_RESULT_TYPES.SPAM]: SecurityLevel.SUSPICIOUS,
  [BLOCKAID_RESULT_TYPES.MALICIOUS]: SecurityLevel.MALICIOUS,
} as const;

/**
 * Security message keys for i18n translation
 * All user-facing security messages should use these keys
 */
export const SECURITY_MESSAGE_KEYS = {
  TOKEN_MALICIOUS: "blockaid.security.token.malicious",
  TOKEN_SUSPICIOUS: "blockaid.security.token.suspicious",
  TOKEN_WARNING: "blockaid.security.token.warning",
  TOKEN_SPAM: "blockaid.security.token.spam",
  SITE_MALICIOUS: "blockaid.security.site.malicious",
  SITE_SUSPICIOUS: "blockaid.security.site.suspicious",
  TRANSACTION_SIMULATION_FAILED:
    "blockaid.security.transaction.simulationFailed",
  TRANSACTION_MALICIOUS: "blockaid.security.transaction.malicious",
  TRANSACTION_WARNING: "blockaid.security.transaction.warning",
} as const;

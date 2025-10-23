export const BLOCKAID_ENDPOINTS = {
  SCAN_TOKEN: "/scan-asset",
  SCAN_BULK_TOKENS: "/scan-asset-bulk",
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
  BULK_TOKEN_SCAN_FAILED: "Failed to bulk scan tokens",
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
  UNABLE_TO_SCAN = "UNABLE_TO_SCAN",
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
  // Unable to scan message keys
  UNABLE_TO_SCAN_TOKEN_TITLE: "blockaid.unableToScan.token.title",
  UNABLE_TO_SCAN_TOKEN_DESCRIPTION: "blockaid.unableToScan.token.description",
  UNABLE_TO_SCAN_SITE_TITLE: "blockaid.unableToScan.site.title",
  UNABLE_TO_SCAN_SITE_DESCRIPTION: "blockaid.unableToScan.site.description",
  UNABLE_TO_SCAN_TRANSACTION_TITLE: "blockaid.unableToScan.transaction",
  UNABLE_TO_SCAN_TRANSACTION_DESCRIPTION: "blockaid.unableToScan.info",
} as const;

/**
 * Security message keys organized by SecurityLevel for different contexts
 */
export const TOKEN_SECURITY_LEVEL_MESSAGE_KEYS = {
  [SecurityLevel.SAFE]: {
    title: undefined,
    description: undefined,
  },
  [SecurityLevel.SUSPICIOUS]: {
    title: SECURITY_MESSAGE_KEYS.TOKEN_SUSPICIOUS,
    description: SECURITY_MESSAGE_KEYS.TOKEN_SUSPICIOUS,
  },
  [SecurityLevel.MALICIOUS]: {
    title: SECURITY_MESSAGE_KEYS.TOKEN_MALICIOUS,
    description: SECURITY_MESSAGE_KEYS.TOKEN_MALICIOUS,
  },
  [SecurityLevel.UNABLE_TO_SCAN]: {
    title: SECURITY_MESSAGE_KEYS.UNABLE_TO_SCAN_TOKEN_TITLE,
    description: SECURITY_MESSAGE_KEYS.UNABLE_TO_SCAN_TOKEN_DESCRIPTION,
  },
} as const;

export const SITE_SECURITY_LEVEL_MESSAGE_KEYS = {
  [SecurityLevel.SAFE]: {
    title: undefined,
    description: undefined,
  },
  [SecurityLevel.SUSPICIOUS]: {
    title: SECURITY_MESSAGE_KEYS.SITE_SUSPICIOUS,
    description: SECURITY_MESSAGE_KEYS.SITE_SUSPICIOUS,
  },
  [SecurityLevel.MALICIOUS]: {
    title: SECURITY_MESSAGE_KEYS.SITE_MALICIOUS,
    description: SECURITY_MESSAGE_KEYS.SITE_MALICIOUS,
  },
  [SecurityLevel.UNABLE_TO_SCAN]: {
    title: SECURITY_MESSAGE_KEYS.UNABLE_TO_SCAN_SITE_TITLE,
    description: SECURITY_MESSAGE_KEYS.UNABLE_TO_SCAN_SITE_DESCRIPTION,
  },
} as const;

export const TRANSACTION_SECURITY_LEVEL_MESSAGE_KEYS = {
  [SecurityLevel.SAFE]: {
    title: undefined,
    description: undefined,
  },
  [SecurityLevel.SUSPICIOUS]: {
    title: SECURITY_MESSAGE_KEYS.TRANSACTION_WARNING,
    description: SECURITY_MESSAGE_KEYS.TRANSACTION_WARNING,
  },
  [SecurityLevel.MALICIOUS]: {
    title: SECURITY_MESSAGE_KEYS.TRANSACTION_MALICIOUS,
    description: SECURITY_MESSAGE_KEYS.TRANSACTION_MALICIOUS,
  },
  [SecurityLevel.UNABLE_TO_SCAN]: {
    title: SECURITY_MESSAGE_KEYS.UNABLE_TO_SCAN_TRANSACTION_TITLE,
    description: SECURITY_MESSAGE_KEYS.UNABLE_TO_SCAN_TRANSACTION_DESCRIPTION,
  },
} as const;

/**
 * Validation severity levels for flagged entities
 * Used specifically for transaction validation flagged addresses
 */
export enum ValidationSeverity {
  MALICIOUS = "malicious",
  SUSPICIOUS = "suspicious",
}

/**
 * Security context types for different scan operations
 * Used to distinguish between site and transaction security contexts
 */
export enum SecurityContext {
  SITE = "site",
  TRANSACTION = "transaction",
  TOKEN = "token",
}

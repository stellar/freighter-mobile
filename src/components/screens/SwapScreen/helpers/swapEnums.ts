/**
 * Transaction status enum for consistent status handling
 */
export enum TransactionStatus {
  SUBMITTING = "submitting",
  SUCCESS = "success",
  FAILED = "failed",
  PENDING = "pending",
}

/**
 * Swap process status enum for the processing screen
 */
export enum SwapStatus {
  SWAPPING = "swapping",
  SWAPPED = "swapped",
  FAILED = "failed",
}

/**
 * Swap button action enum
 */
export enum SwapButtonAction {
  SELECT_TOKEN = "selectToken",
  REVIEW = "review",
}

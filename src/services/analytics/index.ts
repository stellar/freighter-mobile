import {
  setAnalyticsEnabled,
  setAttRequested,
  setAnalyticsUserId,
  track,
  trackAppOpened,
} from "services/analytics/core";
import {
  getAnalyticsDebugInfo,
  clearRecentEvents,
} from "services/analytics/debug";
import {
  trackSignedTransaction,
  trackSignedMessage,
  trackSubmittedTransaction,
  trackSimulationError,
  trackReAuthSuccess,
  trackReAuthFail,
  trackCopyPublicKey,
  trackSendPaymentSuccess,
  trackSwapSuccess,
  trackTransactionError,
  trackCopyBackupPhrase,
  trackQRScanSuccess,
  trackQRScanError,
  trackAddTokenConfirmed,
  trackAddTokenRejected,
  trackRemoveTokenConfirmed,
  trackRemoveTokenRejected,
  trackAccountScreenImportAccountFail,
  trackViewPublicKeyAccountRenamed,
  trackGrantAccessSuccess,
  trackGrantAccessFail,
  trackHistoryOpenItem,
  trackSendCollectibleSuccess,
} from "services/analytics/transactions";
import { identifyUser } from "services/analytics/user";

export interface AnalyticsInstance {
  // Core functions
  readonly track: typeof track;
  readonly trackAppOpened: typeof trackAppOpened;
  readonly setAnalyticsEnabled: typeof setAnalyticsEnabled;
  readonly setAttRequested: typeof setAttRequested;
  readonly setAnalyticsUserId: typeof setAnalyticsUserId;
  readonly identifyUser: typeof identifyUser;

  // Authentication analytics
  readonly trackReAuthSuccess: typeof trackReAuthSuccess;
  readonly trackReAuthFail: typeof trackReAuthFail;

  // Transaction analytics
  readonly trackSignedTransaction: typeof trackSignedTransaction;
  readonly trackSignedMessage: typeof trackSignedMessage;
  readonly trackSubmittedTransaction: typeof trackSubmittedTransaction;
  readonly trackSimulationError: typeof trackSimulationError;
  readonly trackCopyPublicKey: typeof trackCopyPublicKey;
  readonly trackSendPaymentSuccess: typeof trackSendPaymentSuccess;
  readonly trackSendCollectibleSuccess: typeof trackSendCollectibleSuccess;
  readonly trackSwapSuccess: typeof trackSwapSuccess;
  readonly trackTransactionError: typeof trackTransactionError;
  readonly trackCopyBackupPhrase: typeof trackCopyBackupPhrase;
  readonly trackQRScanSuccess: typeof trackQRScanSuccess;
  readonly trackQRScanError: typeof trackQRScanError;

  // Token management analytics
  readonly trackAddTokenConfirmed: typeof trackAddTokenConfirmed;
  readonly trackAddTokenRejected: typeof trackAddTokenRejected;
  readonly trackRemoveTokenConfirmed: typeof trackRemoveTokenConfirmed;
  readonly trackRemoveTokenRejected: typeof trackRemoveTokenRejected;

  // Account management analytics
  readonly trackAccountScreenImportAccountFail: typeof trackAccountScreenImportAccountFail;
  readonly trackViewPublicKeyAccountRenamed: typeof trackViewPublicKeyAccountRenamed;

  // WalletConnect/dApp analytics
  readonly trackGrantAccessSuccess: typeof trackGrantAccessSuccess;
  readonly trackGrantAccessFail: typeof trackGrantAccessFail;

  // History analytics
  readonly trackHistoryOpenItem: typeof trackHistoryOpenItem;

  // Development tools
  readonly getAnalyticsDebugInfo: typeof getAnalyticsDebugInfo;
  readonly clearRecentEvents: typeof clearRecentEvents;
}

/**
 * Global analytics instance
 *
 * Provides a single, consistent API for all analytics tracking across the app.
 *
 * @example
 * ```typescript
 * import { analytics } from "services/analytics";
 *
 * // Generic event tracking
 * analytics.track("custom_event", { property: "value" });
 *
 * // Specific methods for common events
 * analytics.trackCopyPublicKey();
 * analytics.trackSwapSuccess({ amount: 100 });
 * ```
 */
export const analytics: AnalyticsInstance = {
  track,
  trackAppOpened,
  setAnalyticsEnabled,
  setAttRequested,
  setAnalyticsUserId,
  identifyUser,
  trackReAuthSuccess,
  trackReAuthFail,
  trackSignedTransaction,
  trackSignedMessage,
  trackSubmittedTransaction,
  trackSimulationError,
  trackCopyPublicKey,
  trackSendPaymentSuccess,
  trackSendCollectibleSuccess,
  trackSwapSuccess,
  trackTransactionError,
  trackCopyBackupPhrase,
  trackQRScanSuccess,
  trackQRScanError,
  trackAddTokenConfirmed,
  trackAddTokenRejected,
  trackRemoveTokenConfirmed,
  trackRemoveTokenRejected,
  trackAccountScreenImportAccountFail,
  trackViewPublicKeyAccountRenamed,
  trackGrantAccessSuccess,
  trackGrantAccessFail,
  trackHistoryOpenItem,

  // Development tools (only available in __DEV__)
  getAnalyticsDebugInfo,
  clearRecentEvents,
} as const;

export { TransactionType } from "services/analytics/types";
export type {
  SignedTransactionEvent,
  SubmittedTransactionEvent,
} from "services/analytics/types";

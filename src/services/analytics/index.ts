import {
  setAnalyticsEnabled,
  track,
  trackAppOpened,
} from "services/analytics/core";
import {
  getAnalyticsDebugInfo,
  clearRecentEvents,
} from "services/analytics/debug";
import {
  trackSignedTransaction,
  trackSimulationError,
  trackReAuthSuccess,
  trackReAuthFail,
  trackCopyPublicKey,
  trackSendPaymentSuccess,
  trackSendPaymentPathPaymentSuccess,
  trackSwapSuccess,
  trackTransactionError,
  trackSendPaymentSetMax,
  trackSendPaymentTypeSelected,
  trackSendPaymentRecentAddress,
  trackCopyBackupPhrase,
  trackQRScanSuccess,
  trackQRScanError,
  trackAddTokenConfirmed,
  trackAddTokenRejected,
  trackManageAssetListsModify,
  trackAccountScreenAddAccount,
  trackAccountScreenCopyPublicKey,
  trackAccountScreenImportAccount,
  trackAccountScreenImportAccountFail,
  trackViewPublicKeyAccountRenamed,
  trackViewPublicKeyClickedStellarExpert,
  trackGrantAccessSuccess,
  trackGrantAccessFail,
  trackHistoryOpenFullHistory,
  trackHistoryOpenItem,
} from "services/analytics/transactions";
import { identifyUser } from "services/analytics/user";

export interface AnalyticsInstance {
  // Core functions
  readonly track: typeof track;
  readonly trackAppOpened: typeof trackAppOpened;
  readonly setAnalyticsEnabled: typeof setAnalyticsEnabled;
  readonly identifyUser: typeof identifyUser;

  // Authentication analytics
  readonly trackReAuthSuccess: typeof trackReAuthSuccess;
  readonly trackReAuthFail: typeof trackReAuthFail;

  // Transaction analytics
  readonly trackSignedTransaction: typeof trackSignedTransaction;
  readonly trackSimulationError: typeof trackSimulationError;
  readonly trackCopyPublicKey: typeof trackCopyPublicKey;
  readonly trackSendPaymentSuccess: typeof trackSendPaymentSuccess;
  readonly trackSendPaymentPathPaymentSuccess: typeof trackSendPaymentPathPaymentSuccess;
  readonly trackSwapSuccess: typeof trackSwapSuccess;
  readonly trackTransactionError: typeof trackTransactionError;
  readonly trackSendPaymentSetMax: typeof trackSendPaymentSetMax;
  readonly trackSendPaymentTypeSelected: typeof trackSendPaymentTypeSelected;
  readonly trackSendPaymentRecentAddress: typeof trackSendPaymentRecentAddress;
  readonly trackCopyBackupPhrase: typeof trackCopyBackupPhrase;
  readonly trackQRScanSuccess: typeof trackQRScanSuccess;
  readonly trackQRScanError: typeof trackQRScanError;

  // Asset management analytics
  readonly trackAddTokenConfirmed: typeof trackAddTokenConfirmed;
  readonly trackAddTokenRejected: typeof trackAddTokenRejected;
  readonly trackManageAssetListsModify: typeof trackManageAssetListsModify;

  // Account management analytics
  readonly trackAccountScreenAddAccount: typeof trackAccountScreenAddAccount;
  readonly trackAccountScreenCopyPublicKey: typeof trackAccountScreenCopyPublicKey;
  readonly trackAccountScreenImportAccount: typeof trackAccountScreenImportAccount;
  readonly trackAccountScreenImportAccountFail: typeof trackAccountScreenImportAccountFail;
  readonly trackViewPublicKeyAccountRenamed: typeof trackViewPublicKeyAccountRenamed;
  readonly trackViewPublicKeyClickedStellarExpert: typeof trackViewPublicKeyClickedStellarExpert;

  // WalletConnect/dApp analytics
  readonly trackGrantAccessSuccess: typeof trackGrantAccessSuccess;
  readonly trackGrantAccessFail: typeof trackGrantAccessFail;

  // History analytics
  readonly trackHistoryOpenFullHistory: typeof trackHistoryOpenFullHistory;
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
  identifyUser,
  trackReAuthSuccess,
  trackReAuthFail,
  trackSignedTransaction,
  trackSimulationError,
  trackCopyPublicKey,
  trackSendPaymentSuccess,
  trackSendPaymentPathPaymentSuccess,
  trackSwapSuccess,
  trackTransactionError,
  trackSendPaymentSetMax,
  trackSendPaymentTypeSelected,
  trackSendPaymentRecentAddress,
  trackCopyBackupPhrase,
  trackQRScanSuccess,
  trackQRScanError,
  trackAddTokenConfirmed,
  trackAddTokenRejected,
  trackManageAssetListsModify,
  trackAccountScreenAddAccount,
  trackAccountScreenCopyPublicKey,
  trackAccountScreenImportAccount,
  trackAccountScreenImportAccountFail,
  trackViewPublicKeyAccountRenamed,
  trackViewPublicKeyClickedStellarExpert,
  trackGrantAccessSuccess,
  trackGrantAccessFail,
  trackHistoryOpenFullHistory,
  trackHistoryOpenItem,

  // Development tools (only available in __DEV__)
  getAnalyticsDebugInfo,
  clearRecentEvents,
} as const;

export { TransactionType } from "services/analytics/types";
export type { SignedTransactionEvent } from "services/analytics/types";

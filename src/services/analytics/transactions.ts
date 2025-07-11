import { AnalyticsEvent } from "config/analyticsEvents";
import { track } from "services/analytics/core";
import type {
  SignedTransactionEvent,
  TransactionSuccessEvent,
  SwapSuccessEvent,
  TransactionErrorEvent,
} from "services/analytics/types";

// -----------------------------------------------------------------------------
// TRANSACTION ANALYTICS
// -----------------------------------------------------------------------------

export const trackSignedTransaction = (data: SignedTransactionEvent): void => {
  track(AnalyticsEvent.SIGN_TRANSACTION_SUCCESS, {
    transactionHash: data.transactionHash,
    transactionType: data.transactionType,
    network: data.network,
  });
};

export const trackSimulationError = (
  error: string,
  transactionType: string,
): void => {
  track(AnalyticsEvent.SIMULATE_TOKEN_PAYMENT_ERROR, {
    error,
    transactionType,
  });
};

export const trackSendPaymentSuccess = (
  data: TransactionSuccessEvent,
): void => {
  track(AnalyticsEvent.SEND_PAYMENT_SUCCESS, {
    sourceAsset: data.sourceAsset,
    transactionType: data.transactionType,
  });
};

export const trackSendPaymentPathPaymentSuccess = (
  data: TransactionSuccessEvent,
): void => {
  track(AnalyticsEvent.SEND_PAYMENT_PATH_PAYMENT_SUCCESS, {
    sourceAsset: data.sourceAsset,
    destAsset: data.destAsset,
    allowedSlippage: data.allowedSlippage,
    transactionType: data.transactionType,
  });
};

export const trackSwapSuccess = (data: SwapSuccessEvent): void => {
  track(AnalyticsEvent.SWAP_SUCCESS, {
    sourceAsset: data.sourceAsset,
    destAsset: data.destAsset,
    allowedSlippage: data.allowedSlippage,
    isSwap: data.isSwap,
  });
};

export const trackTransactionError = (data: TransactionErrorEvent): void => {
  const event = data.isSwap
    ? AnalyticsEvent.SWAP_FAIL
    : AnalyticsEvent.SEND_PAYMENT_FAIL;

  track(event, {
    error: data.error,
    errorCode: data.errorCode,
    transactionType: data.transactionType,
    isSwap: data.isSwap,
  });
};

export const trackSendPaymentSetMax = (): void => {
  track(AnalyticsEvent.SEND_PAYMENT_SET_MAX);
};

export const trackSendPaymentTypeSelected = (
  paymentType: "payment" | "pathPayment",
): void => {
  const event =
    paymentType === "payment"
      ? AnalyticsEvent.SEND_PAYMENT_TYPE_PAYMENT
      : AnalyticsEvent.SEND_PAYMENT_TYPE_PATH_PAYMENT;

  track(event, { paymentType });
};

export const trackSendPaymentRecentAddress = (): void => {
  track(AnalyticsEvent.SEND_PAYMENT_RECENT_ADDRESS);
};

// -----------------------------------------------------------------------------
// ASSET MANAGEMENT ANALYTICS
// -----------------------------------------------------------------------------

export const trackAddTokenConfirmed = (asset?: string): void => {
  track(AnalyticsEvent.ADD_TOKEN_CONFIRMED, { asset });
};

export const trackAddTokenRejected = (asset?: string): void => {
  track(AnalyticsEvent.ADD_TOKEN_REJECTED, { asset });
};

export const trackManageAssetListsModify = (action: string): void => {
  track(AnalyticsEvent.MANAGE_ASSET_LISTS_MODIFY, { action });
};

// -----------------------------------------------------------------------------
// ACCOUNT MANAGEMENT ANALYTICS
// -----------------------------------------------------------------------------

export const trackAccountScreenAddAccount = (): void => {
  track(AnalyticsEvent.ACCOUNT_SCREEN_ADD_ACCOUNT);
};

export const trackAccountScreenCopyPublicKey = (): void => {
  track(AnalyticsEvent.ACCOUNT_SCREEN_COPY_PUBLIC_KEY);
};

export const trackAccountScreenImportAccount = (): void => {
  track(AnalyticsEvent.ACCOUNT_SCREEN_IMPORT_ACCOUNT);
};

export const trackAccountScreenImportAccountFail = (error: string): void => {
  track(AnalyticsEvent.ACCOUNT_SCREEN_IMPORT_ACCOUNT_FAIL, { error });
};

export const trackViewPublicKeyAccountRenamed = (
  oldName: string,
  newName: string,
): void => {
  track(AnalyticsEvent.VIEW_PUBLIC_KEY_ACCOUNT_RENAMED, {
    oldName,
    newName,
  });
};

export const trackViewPublicKeyClickedStellarExpert = (): void => {
  track(AnalyticsEvent.VIEW_PUBLIC_KEY_CLICKED_STELLAR_EXPERT);
};

// -----------------------------------------------------------------------------
// WALLETCONNECT/DAPP ANALYTICS
// -----------------------------------------------------------------------------

export const trackGrantAccessSuccess = (domain?: string): void => {
  track(AnalyticsEvent.GRANT_ACCESS_SUCCESS, { domain });
};

export const trackGrantAccessFail = (
  domain?: string,
  reason?: string,
): void => {
  track(AnalyticsEvent.GRANT_ACCESS_FAIL, { domain, reason });
};

// -----------------------------------------------------------------------------
// HISTORY ANALYTICS
// -----------------------------------------------------------------------------

export const trackHistoryOpenFullHistory = (): void => {
  track(AnalyticsEvent.HISTORY_OPEN_FULL_HISTORY);
};

export const trackHistoryOpenItem = (transactionHash: string): void => {
  track(AnalyticsEvent.HISTORY_OPEN_ITEM, { transactionHash });
};

// -----------------------------------------------------------------------------
// AUTHENTICATION ANALYTICS
// -----------------------------------------------------------------------------

/**
 * Generic helper for authentication events.
 */
const trackAuthEvent = (
  event: AnalyticsEvent,
  additional?: Record<string, unknown>,
): void => {
  track(event, {
    context: "user_authentication",
    method: "password", // TODO: Add other methods (eg: fingerprint, face id, etc)
    ...additional,
  });
};

export const trackReAuthSuccess = (): void => {
  trackAuthEvent(AnalyticsEvent.RE_AUTH_SUCCESS);
};

export const trackReAuthFail = (): void => {
  trackAuthEvent(AnalyticsEvent.RE_AUTH_FAIL);
};

// -----------------------------------------------------------------------------
// USER ACTION ANALYTICS
// -----------------------------------------------------------------------------

/**
 * Generic helper for simple user actions with context.
 */
const trackUserAction = (
  event: AnalyticsEvent,
  context: string,
  action: string,
): void => {
  track(event, { context, action });
};

export const trackCopyPublicKey = (): void => {
  trackUserAction(AnalyticsEvent.COPY_PUBLIC_KEY, "home_screen", "copy");
};

export const trackCopyBackupPhrase = (): void => {
  trackUserAction(AnalyticsEvent.COPY_BACKUP_PHRASE, "backup_phrase", "copy");
};

export const trackQRScanSuccess = (
  context: string,
  timeToScan?: number,
): void => {
  track(AnalyticsEvent.QR_SCAN_SUCCESS, { context, timeToScan });
};

export const trackQRScanError = (context: string, error: string): void => {
  track(AnalyticsEvent.QR_SCAN_ERROR, { context, error });
};

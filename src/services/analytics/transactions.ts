import { AnalyticsEvent } from "config/analyticsConfig";
import { track } from "services/analytics/core";
import type {
  SignedTransactionEvent,
  SubmittedTransactionEvent,
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
    ...(data.dappDomain ? { dappDomain: data.dappDomain } : {}),
  });
};

export const trackSubmittedTransaction = (
  data: SubmittedTransactionEvent,
): void => {
  track(AnalyticsEvent.SUBMIT_TRANSACTION_SUCCESS, {
    transactionHash: data.transactionHash,
    transactionType: data.transactionType,
    ...(data.dappDomain ? { dappDomain: data.dappDomain } : {}),
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
    sourceAsset: data.sourceToken,
    operationType: data.operationType,
  });
};

export const trackSendCollectibleSuccess = (
  data: TransactionSuccessEvent,
): void => {
  track(AnalyticsEvent.SEND_COLLECTIBLE_SUCCESS, {
    collectionAddress: data.collectionAddress,
    tokenId: data.tokenId,
  });
};

export const trackSwapSuccess = (data: SwapSuccessEvent): void => {
  track(AnalyticsEvent.SWAP_SUCCESS, {
    sourceAsset: data.sourceToken,
    destinationAsset: data.destToken,
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
    operationType: data.operationType,
    isSwap: data.isSwap,
  });
};

// -----------------------------------------------------------------------------
// TOKEN MANAGEMENT ANALYTICS
// -----------------------------------------------------------------------------

export const trackAddTokenConfirmed = (token?: string): void => {
  track(AnalyticsEvent.ADD_TOKEN_CONFIRMED, { asset: token });
};

export const trackAddTokenRejected = (token?: string): void => {
  track(AnalyticsEvent.ADD_TOKEN_REJECTED, { asset: token });
};

export const trackRemoveTokenConfirmed = (token?: string): void => {
  track(AnalyticsEvent.REMOVE_TOKEN_CONFIRMED, { asset: token });
};

export const trackRemoveTokenRejected = (token?: string): void => {
  track(AnalyticsEvent.REMOVE_TOKEN_REJECTED, { asset: token });
};

// -----------------------------------------------------------------------------
// ACCOUNT MANAGEMENT ANALYTICS
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// WALLETCONNECT/DAPP ANALYTICS
// -----------------------------------------------------------------------------

export const trackGrantAccessSuccess = (domain?: string): void => {
  track(AnalyticsEvent.GRANT_DAPP_ACCESS_SUCCESS, { domain });
};

export const trackGrantAccessFail = (
  domain?: string,
  reason?: string,
): void => {
  track(AnalyticsEvent.GRANT_DAPP_ACCESS_FAIL, { domain, reason });
};

// -----------------------------------------------------------------------------
// HISTORY ANALYTICS
// -----------------------------------------------------------------------------

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

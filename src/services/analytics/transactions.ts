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

export const trackSendPaymentSuccess = (
  data: TransactionSuccessEvent,
): void => {
  track(AnalyticsEvent.SEND_PAYMENT_SUCCESS, {
    sourceAsset: data.sourceAsset,
    destAsset: data.destAsset,
    allowedSlippage: data.allowedSlippage,
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
  track(AnalyticsEvent.SEND_PAYMENT_FAIL, {
    error: data.error,
    errorCode: data.errorCode,
    transactionType: data.transactionType,
    isSwap: data.isSwap,
  });
};

export const trackSimulationError = (error: string): void => {
  track(AnalyticsEvent.SEND_PAYMENT_FAIL, {
    error,
    errorType: "simulation",
    context: "transaction_preview",
  });
};

// -----------------------------------------------------------------------------
// PAYMENT FLOW ANALYTICS
// -----------------------------------------------------------------------------

export const trackSendPaymentSetMax = (): void => {
  track(AnalyticsEvent.SEND_PAYMENT_SET_MAX, {
    context: "amount_input",
    action: "set_max_amount",
  });
};

export const trackSendPaymentTypeSelected = (
  type: "payment" | "pathPayment",
): void => {
  const event =
    type === "payment"
      ? AnalyticsEvent.SEND_PAYMENT_TYPE_PAYMENT
      : AnalyticsEvent.SEND_PAYMENT_TYPE_PATH_PAYMENT;

  track(event, {
    paymentType: type,
    context: "payment_flow",
  });
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
  trackAuthEvent(AnalyticsEvent.RE_AUTH_FAIL, {
    reason: "incorrect_password",
  });
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
  trackUserAction(
    AnalyticsEvent.COPY_PUBLIC_KEY,
    "account_details",
    "copy_address",
  );
};

export const trackCopyBackupPhrase = (): void => {
  trackUserAction(
    AnalyticsEvent.COPY_BACKUP_PHRASE,
    "security_settings",
    "copy_recovery_phrase",
  );
};

// -----------------------------------------------------------------------------
// MOBILE-SPECIFIC ANALYTICS
// -----------------------------------------------------------------------------

/**
 * Generic helper for QR scan events with mobile context.
 */
const trackQRScanEvent = (
  event: AnalyticsEvent,
  context: string = "general",
  additional?: Record<string, unknown>,
): void => {
  track(event, {
    context,
    platform: "mobile",
    scanMethod: "camera",
    ...additional,
  });
};

export const trackQRScanSuccess = (context?: string): void => {
  trackQRScanEvent(AnalyticsEvent.QR_SCAN_SUCCESS, context);
};

export const trackQRScanError = (error: string, context?: string): void => {
  trackQRScanEvent(AnalyticsEvent.QR_SCAN_ERROR, context, { error });
};

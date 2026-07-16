import { AnalyticsEvent } from "config/analyticsConfig";
import { track } from "services/analytics/core";
import { TransactionOperationType } from "services/analytics/types";
import type {
  SignedTransactionEvent,
  SimulationTransactionType,
  SubmittedTransactionEvent,
  TransactionSuccessEvent,
  SwapSuccessEvent,
  TransactionErrorEvent,
} from "services/analytics/types";

export const trackSignedTransaction = (data: SignedTransactionEvent): void => {
  track(AnalyticsEvent.SIGN_TRANSACTION_SUCCESS, {
    transactionHash: data.transactionHash,
    transactionType: data.transactionType,
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSignedMessage = (data: {
  messageLength: number;
  dappDomain?: string;
}): void => {
  // NOTE: mobile has a single message-signing flow, so message_type is not
  // discriminated here; flagged for review.
  track(AnalyticsEvent.SIGN_MESSAGE_SUCCESS, {
    messageLength: data.messageLength,
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSignedAuthEntry = (data: { dappDomain?: string }): void => {
  track(AnalyticsEvent.SIGN_AUTH_ENTRY_SUCCESS, {
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSignedMessageError = (data: {
  error: string;
  dappDomain?: string;
}): void => {
  // This is the runtime signing-failure path (a caught exception while
  // signing), which is distinct from a user rejection. The user-reject case
  // is not currently instrumented on mobile (SIGN_MESSAGE_REJECTED exists in
  // the catalog for parity but has no emit site yet).
  track(AnalyticsEvent.SIGN_MESSAGE_FAIL, {
    reason_code: data.error,
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSignedAuthEntryError = (data: {
  error: string;
  dappDomain?: string;
}): void => {
  // Runtime signing-failure path; see trackSignedMessageError.
  track(AnalyticsEvent.SIGN_AUTH_ENTRY_FAIL, {
    reason_code: data.error,
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSubmittedTransaction = (
  data: SubmittedTransactionEvent,
): void => {
  track(AnalyticsEvent.SUBMIT_TRANSACTION_SUCCESS, {
    transactionHash: data.transactionHash,
    transactionType: data.transactionType,
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSimulationError = (
  error: string,
  transactionType: SimulationTransactionType,
): void => {
  track(AnalyticsEvent.SIMULATE_TOKEN_PAYMENT_ERROR, {
    reason_code: error,
    transactionType,
  });
};

export const trackSendPaymentSuccess = (
  data: TransactionSuccessEvent,
): void => {
  // Path / routed payment outcomes are reported as swaps (product decision):
  // a path-payment success emits swap.completed, a direct payment emits
  // payment.completed with payment_type=payment.
  if (data.operationType === TransactionOperationType.PathPayment) {
    track(AnalyticsEvent.SWAP_SUCCESS, {
      from_asset_code: data.sourceToken,
      operationType: data.operationType,
    });
    return;
  }

  track(AnalyticsEvent.SEND_PAYMENT_SUCCESS, {
    from_asset_code: data.sourceToken,
    payment_type: "payment",
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
    from_asset_code: data.sourceToken,
    to_asset_code: data.destToken,
    sourceAmount: data.sourceAmount,
    destinationAmount: data.destAmount,
    allowedSlippage: data.allowedSlippage,
    isSwap: data.isSwap,
  });
};

export const trackTransactionError = (data: TransactionErrorEvent): void => {
  // Route the outcome to the right terminal event:
  // - collectible sends -> collectible_send.failed
  // - swaps and path / routed payments -> swap.failed (product decision)
  // - direct payments -> payment.failed
  const isSwapLike =
    data.isSwap ||
    data.operationType === TransactionOperationType.PathPayment ||
    data.operationType === TransactionOperationType.Swap;

  let event = AnalyticsEvent.SEND_PAYMENT_FAIL;
  if (data.operationType === TransactionOperationType.SendCollectible) {
    event = AnalyticsEvent.SEND_COLLECTIBLE_FAIL;
  } else if (isSwapLike) {
    event = AnalyticsEvent.SWAP_FAIL;
  }

  track(event, {
    reason_code: data.error,
    errorCode: data.errorCode,
    operationType: data.operationType,
    isSwap: data.isSwap,
    // Swap-specific fields are gated so payment.failed events from non-swap
    // callers don't get polluted with undefined from_asset_code /
    // to_asset_code / sourceAmount / destinationAmount keys.
    ...(isSwapLike
      ? {
          from_asset_code: data.sourceToken,
          to_asset_code: data.destToken,
          sourceAmount: data.sourceAmount,
          destinationAmount: data.destAmount,
        }
      : {}),
  });
};

export const trackAddTokenConfirmed = (token?: string): void => {
  track(AnalyticsEvent.ASSET_ADD_RESPONDED, {
    decision: "confirm",
    asset: token,
  });
};

export const trackAddTokenRejected = (token?: string): void => {
  track(AnalyticsEvent.ASSET_ADD_RESPONDED, {
    decision: "reject",
    asset: token,
  });
};

export const trackRemoveTokenConfirmed = (token?: string): void => {
  track(AnalyticsEvent.ASSET_REMOVE_RESPONDED, {
    decision: "confirm",
    asset: token,
  });
};

export const trackRemoveTokenRejected = (token?: string): void => {
  track(AnalyticsEvent.ASSET_REMOVE_RESPONDED, {
    decision: "reject",
    asset: token,
  });
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

export const trackGrantAccessSuccess = (domain?: string): void => {
  track(AnalyticsEvent.GRANT_DAPP_ACCESS_SUCCESS, { origin: domain });
};

export const trackGrantAccessFail = (
  domain?: string,
  reason?: string,
): void => {
  track(AnalyticsEvent.GRANT_DAPP_ACCESS_FAIL, {
    origin: domain,
    reason_code: reason,
  });
};

export const trackHistoryOpenItem = (transactionHash: string): void => {
  track(AnalyticsEvent.HISTORY_OPEN_ITEM, { transactionHash });
};

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
  track(AnalyticsEvent.QR_SCAN_ERROR, { context, reason_code: error });
};
